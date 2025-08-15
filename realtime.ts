import { eq } from "drizzle-orm";
import { config } from "./config";
import { db } from "./database";
import { getConnection } from "./rpc-connection-pool";
import { syncTracking } from "./schema";
import { processTransaction } from "./transaction-processor";

const queue: string[] = [];
let isRunning = true;
let currentTrackingId: number | undefined = undefined;

// Fix the process.on issue
(globalThis as any).process.on("SIGINT", () => {
  console.log(" Shutting down realtime process...");
  isRunning = false;
});

export async function process() {
  console.log("🔍 Starting realtime process...");
  if (!isRunning) {
    console.log("🛑 Realtime process stopped");
    return;
  }

  const conn = getConnection();
  conn.onLogs(config.programId, (logs) => {
    if (isRunning) {
      queue.push(logs.signature);
    }
  });
  await getNextTx();
}

export async function getNextTx() {
  if (!isRunning) {
    console.log("🛑 Realtime process stopped");
    return;
  }

  const signature = queue.shift();

  if (!signature) {
    console.log("🔍 No more transactions to process");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await getNextTx();
    return;
  }

  await processTransaction(signature, {
    source: "realtime",
    onSyncTrackingUpdate: async (signature) => {
      try {
        // Update sync tracking
        if (currentTrackingId) {
          await db
            .update(syncTracking)
            .set({
              processedTx: signature,
              endTx: signature,
            })
            .where(eq(syncTracking.id, currentTrackingId));
        } else {
          const result = await db
            .insert(syncTracking)
            .values({
              startTx: signature,
              endTx: signature,
              processedTx: signature,
              status: "processing",
            })
            .returning({ id: syncTracking.id });

          currentTrackingId = result[0]!.id;
        }
      } catch (dbError) {
        console.error(`❌ Database error in sync tracking:`, dbError);
      }
    },
  }).finally(async () => {
    // Continue processing next transaction
    if (isRunning) {
      await getNextTx();
    }
  });
}
