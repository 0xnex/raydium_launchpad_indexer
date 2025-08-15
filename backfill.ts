import { PublicKey } from "@solana/web3.js";
import { and, eq } from "drizzle-orm";
import { config } from "./config";
import { db } from "./database";
import { type TxResult } from "./raydium";
import { getConnection } from "./rpc-connection-pool";
import { syncTracking, type SyncTracking } from "./schema";
import { parseTxWithRetry, storeError } from "./utils";
import { processTransaction } from "./transaction-processor";

let isRunning = true;

// Graceful shutdown handler
(globalThis as any).process.on("SIGINT", () => {
  console.log(" Shutting down backfill process...");
  isRunning = false;
});

export async function process() {
  if (!isRunning) {
    console.log("🛑 Backfill process stopped");
    return;
  }

  const syncInfo = await markSyncTracking();
  if (!syncInfo) {
    console.log("🔍 No pending sync tracking found");
    if (isRunning) {
      setTimeout(() => {
        process().catch(console.error);
      }, 1000);
    }
    return;
  }

  console.log(
    `🔄 Processing sync range: ${syncInfo.startTx} → ${syncInfo.endTx}`
  );

  try {
    await backfill({
      programId: config.programId,
      callback: async (result) => {
        await processTransaction(result.signature, {
          source: "backfill",
          onSyncTrackingUpdate: async (signature) => {
            // Update processed transaction for checkpointing
            await db
              .update(syncTracking)
              .set({
                processedTx: signature,
              })
              .where(eq(syncTracking.id, syncInfo.id));
          },
        });
      },
      before: syncInfo.endTx,
      until: syncInfo.startTx,
      platformConfig: config.platformConfigAddress
        ? new PublicKey(config.platformConfigAddress)
        : undefined,
    });

    // Mark sync as completed
    await db
      .update(syncTracking)
      .set({
        status: "completed",
      })
      .where(eq(syncTracking.id, syncInfo.id));

    console.log(`✅ Sync completed: ${syncInfo.startTx} → ${syncInfo.endTx}`);
  } catch (error) {
    console.error(`❌ Error during backfill:`, error);

    // Mark sync as failed
    await db
      .update(syncTracking)
      .set({
        status: "failed",
      })
      .where(eq(syncTracking.id, syncInfo.id));
  }

  // Continue processing next sync tracking
  if (isRunning) {
    setTimeout(() => {
      process().catch(console.error);
    }, 1000);
  }
}

export async function backfill({
  programId,
  callback,
  platformConfig,
  before,
  until,
}: {
  programId: PublicKey;
  callback: (result: TxResult) => Promise<void>;
  platformConfig?: PublicKey;
  before: string;
  until: string;
}) {
  console.log(`🔄 Starting backfill from ${until} to ${before}`);

  let lastSignature: string | undefined = undefined;
  const limit = 1000;
  let processedCount = 0;
  let errorCount = 0;

  while (true) {
    try {
      console.log(
        `📡 Fetching signatures before ${lastSignature || before}...`
      );

      const connection = getConnection();
      const options: any = { limit };

      // Use lastSignature for pagination, fallback to before
      if (lastSignature) {
        options.before = lastSignature;
      } else {
        options.before = before;
      }

      if (until) {
        options.until = until;
      }

      const signatures = await connection.getSignaturesForAddress(
        programId,
        options,
        "confirmed"
      );

      if (signatures.length === 0) {
        console.log("✅ No more signatures to process");
        break;
      }

      console.log(`📝 Processing ${signatures.length} signatures...`);

      // Process transactions in reverse order (oldest first)
      for (let i = signatures.length - 1; i >= 0; i--) {
        const signature = signatures[i]!;

        // Stop if we've reached the until transaction
        if (until && signature.signature === until) {
          console.log(`✅ Reached until transaction: ${until}`);
          return;
        }

        try {
          console.log(`📝 Processing tx ${signature.signature}...`);
          const result = await parseTxWithRetry(signature.signature);
          await callback(result);
          processedCount++;
        } catch (error) {
          console.error(
            `❌ Error processing tx ${signature.signature}:`,
            error
          );
          errorCount++;
        }

        lastSignature = signature.signature;
      }

      // If we got fewer signatures than requested, we've reached the end
      if (signatures.length < limit) {
        console.log("✅ Reached end of available signatures");
        break;
      }
    } catch (error) {
      console.error("❌ Error fetching signatures:", error);
      throw error;
    }
  }

  console.log(
    `✅ Backfill completed: ${processedCount} processed, ${errorCount} errors`
  );
}

export async function markSyncTracking(): Promise<SyncTracking | null> {
  const syncInfo = await db
    .select()
    .from(syncTracking)
    .where(eq(syncTracking.status, "pending"))
    .orderBy(syncTracking.createdAt)
    .limit(1);

  if (syncInfo.length === 0) {
    return null;
  }

  const updated = await db
    .update(syncTracking)
    .set({
      status: "processing",
    })
    .where(
      and(
        eq(syncTracking.id, syncInfo[0]!.id),
        eq(syncTracking.status, "pending")
      )
    );

  if (updated.rowsAffected === 0) {
    return null;
  }

  return syncInfo[0]!;
}
