import { Connection, type SignaturesForAddressOptions } from "@solana/web3.js";
import { config, validateConfig } from "./config";
import { parseTransaction, type RaydiumEventData } from "./raydium";
import { parseArgs } from "util";
import { processAndImportEvents } from "./event_importer";

// Validate configuration
validateConfig(config);

export type TransactionResult = {
  signature: string;
  events: RaydiumEventData[];
};

export type BackfillResult = TransactionResult[];

export type EventListener = (result: TransactionResult) => void;

class IndexerError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = "IndexerError";
  }
}

// Enhanced error handling for parseTransaction
async function parseTransactionWithRetry(
  signature: string,
  maxRetries: number = 3
): Promise<RaydiumEventData[]> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await parseTransaction(
        signature,
        getConnection(),
        config.platformConfigAddress
      );
    } catch (error) {
      lastError = error as Error;
      console.error(
        `❌ Attempt ${attempt}/${maxRetries} failed for ${signature}:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new IndexerError(
    `Failed to parse transaction after ${maxRetries} attempts: ${lastError?.message}`,
    "PARSE_FAILED",
    false
  );
}

class ConnectionManager {
  private connections: Connection[] = [];
  private currentIndex = 0;
  constructor(rpcUrls: string[], wsUrl: string) {
    this.connections = rpcUrls.map((url) => {
      const conn = new Connection(url, {
        commitment: "confirmed",
        wsEndpoint: wsUrl,
      });
      return conn;
    });
  }

  getHealthyConnection(): Connection {
    return this.connections[this.currentIndex++ % this.connections.length]!;
  }
}

const connectionManager = new ConnectionManager(
  config.rpcUrl.split(","),
  config.wsUrl
);

const queue: string[] = [];
const QueuePollingInterval = 1000;

interface BackfillCheckpoint {
  lastSignature: string;
  processedCount: number;
  failedCount: number;
  startTime: Date;
  lastUpdateTime: Date;
}

class BackfillManager {
  checkpoint: BackfillCheckpoint | null = null;
  private checkpointFile = "./backfill-checkpoint.json";

  async loadCheckpoint(): Promise<BackfillCheckpoint | null> {
    try {
      const content = await Bun.file(this.checkpointFile).text();
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async saveCheckpoint(checkpoint: BackfillCheckpoint): Promise<void> {
    await Bun.write(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  async backfillWithCheckpoint(
    before?: string,
    until?: string,
    listener?: EventListener
  ): Promise<BackfillResult> {
    const result: BackfillResult = [];

    // Load checkpoint if exists
    this.checkpoint = await this.loadCheckpoint();

    if (this.checkpoint && !before) {
      before = this.checkpoint.lastSignature;
      console.log(`📍 Resuming from checkpoint: ${before}`);
    }

    const opt: SignaturesForAddressOptions = {};
    if (before) opt.before = before;
    if (until) opt.until = until;

    let lastSignature: string | undefined = undefined;

    while (true) {
      try {
        if (lastSignature) {
          opt.before = lastSignature;
        }

        const signatures = await getConnection().getSignaturesForAddress(
          config.programId,
          opt,
          "confirmed"
        );

        if (signatures.length === 0) {
          console.log("✅ Backfill completed - no more signatures");
          break;
        }

        lastSignature = signatures[signatures.length - 1]?.signature;

        for (const signature of signatures) {
          try {
            const events = await parseTransactionWithRetry(signature.signature);
            if (listener) {
              listener({ signature: signature.signature, events });
            }
            result.push({ signature: signature.signature, events });
          } catch (error) {
            console.error(
              `❌ Error processing signature ${signature.signature}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error("❌ Error fetching signatures:", error);
        break;
      }
    }

    // Final checkpoint save
    if (this.checkpoint) {
      this.checkpoint.lastUpdateTime = new Date();
      await this.saveCheckpoint(this.checkpoint);
    }
    return result;
  }
}

const backfillManager = new BackfillManager();

class GracefulShutdown {
  private isShuttingDown = false;
  private shutdownHandlers: (() => Promise<void>)[] = [];

  addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    console.log("🛑 Starting graceful shutdown...");

    // Save final checkpoint
    if (backfillManager.checkpoint) {
      await backfillManager.saveCheckpoint(backfillManager.checkpoint);
    }

    // Run shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error("❌ Error in shutdown handler:", error);
      }
    }

    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  }

  isShuttingDownState(): boolean {
    return this.isShuttingDown;
  }
}

const gracefulShutdown = new GracefulShutdown();

// Setup shutdown handlers
process.on("SIGINT", () => gracefulShutdown.shutdown());
process.on("SIGTERM", () => gracefulShutdown.shutdown());

// Add shutdown handlers
gracefulShutdown.addShutdownHandler(async () => {
  console.log("💾 Saving final checkpoint...");
  if (backfillManager.checkpoint) {
    await backfillManager.saveCheckpoint(backfillManager.checkpoint);
  }
});

function getConnection(): Connection {
  return connectionManager.getHealthyConnection();
}

function getNextTx(listener?: EventListener) {
  if (gracefulShutdown.isShuttingDownState()) return;

  if (queue.length === 0) {
    console.log("No transactions to process, waiting...");
    setTimeout(() => {
      getNextTx(listener);
    }, QueuePollingInterval);
    return;
  }
  const signature = queue.shift()!;
  parseTransactionWithRetry(signature)
    .then((events) => {
      if (listener) {
        listener({ signature, events });
      }
      getNextTx(listener);
    })
    .catch((err) => {
      console.error(`❌ Error processing transaction ${signature}:`, err);
    });
}

function realtimeListener(listener?: EventListener) {
  const conn = connectionManager.getHealthyConnection();
  conn.onLogs(config.programId, (logs) => {
    queue.push(logs.signature);
  });
  getNextTx(listener);
}

async function parseTransactionBySignature(
  signature: string
): Promise<TransactionResult> {
  const events = await parseTransactionWithRetry(signature);
  return { signature, events };
}

async function backfill(
  before?: string,
  until?: string,
  listener?: EventListener
): Promise<BackfillResult> {
  return backfillManager.backfillWithCheckpoint(before, until, listener);
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      debug: {
        type: "string",
      },
      backfill: {
        type: "boolean",
      },
      before: {
        type: "string",
        optional: true,
      },
      until: {
        type: "string",
        optional: true,
      },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.debug) {
    const result = await parseTransactionBySignature(values.debug);
    console.log(result.events);
  } else if (values.backfill) {
    const result = await backfill(values.before, values.until);
    console.log(result);
  } else {
    realtimeListener(async (result) => {
      await processAndImportEvents(result.events);
    });
  }
}

main();
