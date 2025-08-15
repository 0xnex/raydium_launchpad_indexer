import { getConnection } from "./rpc-connection-pool";
import { parseTransaction, type RaydiumEventData } from "./raydium";
import { trackError } from "./schema";
import { db } from "./database";

export type TxResult = {
  error: Error | null;
  signature: string;
  events: RaydiumEventData[];
};

export async function parseTxWithRetry(
  signature: string,
  retry: number = 3
): Promise<TxResult> {
  if (retry === 0) {
    throw new Error("Failed to parse transaction");
  }

  const connection = getConnection();
  try {
    return {
      signature,
      error: null,
      events: await parseTransaction(signature, connection),
    };
  } catch (error) {
    console.log("parseTxWithRetry failed, retrying...");
    console.log(`\t parase ${signature} failed, error: ${error}`);
    if (retry > 0) {
      return parseTxWithRetry(signature, retry - 1);
    }
    return {
      signature,
      error: error as Error,
      events: [],
    };
  }
}

export async function storeError(signature: string, error: Error) {
  await db.insert(trackError).values({
    signature,
    error: error.message,
  });
}
