import { processAndImportEvents } from "./event-importer";
import { parseTxWithRetry, storeError } from "./utils";

export interface ProcessingContext {
  source: "backfill" | "realtime";
  onSyncTrackingUpdate?: (signature: string) => Promise<void>;
}

export async function processTransaction(
  signature: string,
  context: ProcessingContext
): Promise<void> {
  let error: Error | undefined = undefined;

  try {
    console.log(`📝 Processing ${context.source} transaction: ${signature}`);

    const result = await parseTxWithRetry(signature);

    if (result.error) {
      console.error(
        `❌ Error processing transaction ${signature}:`,
        result.error
      );
      error = result.error;
    } else {
      if (result.events.length > 0) {
        await processAndImportEvents(result.events, context.source);
        console.log(
          `✅ Processed ${result.events.length} events from ${signature}`
        );
      }
    }
  } catch (err) {
    console.error(`❌ Error processing transaction ${signature}:`, err);
    error = err as Error;
  }

  // Handle errors
  if (error) {
    await storeError(signature, error);
  }

  // Call custom sync tracking update if provided
  if (context.onSyncTrackingUpdate) {
    await context.onSyncTrackingUpdate(signature);
  }
}
