import { syncTracking } from "./schema";
import { db } from "./database";

export interface GapInfo {
  gapId: string;
  startTx: string; // End tx of last backfill, included in the backfill range
  endTx: string; // Start tx of last realtime, excluded in the backfill range
}

export class GapDetector {
  private startTx?: string | null; // the first tx

  constructor(startTx?: string | null) {
    this.startTx = startTx;
  }

  /**
   * Detect gaps between backfill and realtime processing
   * Creates backfill records for gaps found
   */
  async detectGaps() {
    console.log("🔍 Detecting gaps...");

    // Get the latest backfill tracking record
    const gap = await this.getGap();
    if (gap) {
      // create a backfill record
      await db.insert(syncTracking).values({
        startTx: gap.startTx,
        endTx: gap.endTx,
        status: "pending",
      });
      console.log(`✅ Gap detected: ${gap.gapId}`);
    } else {
      console.log("✅ No gaps detected");
      return;
    }
  }

  /**
   * Get the gap between the latest 2 sync tracking records
   */
  private async getGap(): Promise<GapInfo | null> {
    const records = await db
      .select()
      .from(syncTracking)
      .orderBy(syncTracking.updatedAt)
      .limit(2);

    if (records.length === 0) {
      return null;
    }

    if (records.length === 1) {
      const record = records[0]!;
      if (this.startTx) {
        // if startTx is provided, we need to backfill from startTx to the end of the last backfill
        return {
          gapId: `${this.startTx}-${record.startTx}`,
          startTx: this.startTx,
          endTx: record.startTx,
        };
      }
    }

    const [prev, current] = records;
    // check endTx of prev is equal to startTx of current
    if (prev!.endTx !== current!.startTx) {
      return {
        gapId: `${prev!.endTx}-${current!.startTx}`,
        startTx: prev!.endTx,
        endTx: current!.startTx,
      };
    }

    return null;
  }
}
