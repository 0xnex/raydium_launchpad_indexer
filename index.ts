import { Connection, type SignaturesForAddressOptions } from "@solana/web3.js";
import { config, validateConfig } from "./config";
import { parseTransaction, type RaydiumEventData } from "./raydium";
import { parseArgs } from "util";

// Validate configuration
validateConfig(config);

export type TransactionResult = {
  signature: string;
  events: RaydiumEventData[];
};

export type BackfillResult = TransactionResult[];

export type EventListener = (result: TransactionResult) => void;

const connections = config.rpcUrl.split(",").map(
  (url) =>
    new Connection(url, {
      commitment: "confirmed",
      wsEndpoint: config.wsUrl,
    })
);

const queue: string[] = [];
const QueuePollingInterval = 1000;
let connIndex = 0;

process.on("SIGINT", () => {
  console.log("SIGINT received, exiting...");
  process.exit(0);
});

function getNextTx(listener?: EventListener) {
  if (queue.length === 0) {
    console.log("No transactions to process, waiting...");
    setTimeout(() => {
      getNextTx(listener); // Fix: pass listener parameter
    }, QueuePollingInterval);
    return;
  }
  const signature = queue.shift()!;
  const conn = connections[connIndex++ % connections.length]!;

  parseTransaction(signature, conn)
    .then((events) => {
      const result: TransactionResult = { signature, events };
      if (listener) {
        listener(result);
      } else {
        console.log(result);
      }
    })
    .catch((error) => {
      console.error(`Error processing transaction ${signature}:`, error);
    });

  getNextTx(listener);
}

function realtimeListener(listener?: EventListener) {
  const conn = connections[connIndex++ % connections.length]!;
  conn.onLogs(config.programId, (logs) => {
    queue.push(logs.signature);
  });
  getNextTx(listener);
}

// Rename function to be more descriptive
async function parseTransactionBySignature(
  signature: string
): Promise<TransactionResult> {
  const conn = getConnection();
  const events = await parseTransaction(signature, conn);
  return { signature, events };
}

function getConnection() {
  return connections[connIndex++ % connections.length]!;
}

async function backfill(
  before?: string,
  until?: string,
  listener?: EventListener
): Promise<BackfillResult> {
  const result: BackfillResult = [];

  const opt: SignaturesForAddressOptions = {};
  if (before) {
    opt.before = before;
  }
  if (until) {
    opt.until = until;
  }
  let lastSignature: string | undefined = undefined;

  while (true) {
    if (lastSignature) {
      opt.before = lastSignature;
    }

    try {
      const signatures = await getConnection().getSignaturesForAddress(
        config.programId,
        opt,
        "confirmed"
      );

      if (signatures.length === 0) {
        break;
      }

      lastSignature = signatures[signatures.length - 1]?.signature;

      for (const signature of signatures) {
        try {
          const events = await parseTransaction(
            signature.signature,
            getConnection()
          );

          const transactionResult: TransactionResult = {
            signature: signature.signature,
            events,
          };

          if (listener) {
            listener(transactionResult);
          }
          result.push(transactionResult);
        } catch (error) {
          console.error(
            `Error processing signature ${signature.signature}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error fetching signatures:", error);
      break;
    }
  }
  return result;
}

async function main() {
  const { values, positionals } = parseArgs({
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
    realtimeListener();
  }
}

main();
