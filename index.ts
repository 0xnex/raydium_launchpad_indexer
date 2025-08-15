import { parseArgs } from "util";
import { process as backfill } from "./backfill";
import { process as realtime } from "./realtime";
import { GapDetector } from "./gap-detector";
import { parseTxWithRetry } from "./utils";

let isRunning = true;

// Graceful shutdown handler
(globalThis as any).process.on("SIGINT", () => {
  console.log(" Shutting down indexer...");
  isRunning = false;
});

(globalThis as any).process.on("SIGTERM", () => {
  console.log(" Terminating indexer...");
  isRunning = false;
});

async function main() {
  try {
    const { values } = parseArgs({
      args: Bun.argv,
      options: {
        debug: {
          type: "string",
        },
        backfill: {
          type: "boolean",
        },
        realtime: {
          type: "boolean",
        },
        gap: {
          type: "boolean",
        },
      },
      strict: true,
      allowPositionals: true,
    });

    if (values.debug) {
      // Validate signature format (basic check)
      if (!values.debug.match(/^[A-Za-z0-9]{88}$/)) {
        console.error("❌ Invalid signature format");
        process.exit(1);
      }

      console.log(`🔍 Debugging transaction: ${values.debug}`);
      const result = await parseTxWithRetry(values.debug);
      console.log(" Transaction events:", result.events);
    } else if (values.backfill) {
      console.log("🔄 Starting backfill process...");
      await backfill();
    } else if (values.realtime) {
      console.log("📡 Starting realtime monitoring...");
      await realtime();
    } else if (values.gap) {
      console.log("🔍 Starting gap detection...");
      const gapDetector = new GapDetector(
        "4Fc2ZZK7sRZ5bBGN9mhxh9Ka9LjsTuS8QmZWUj5MTSxTniGdT8B76w2h6CH376uzsEzgiRuGauJZsGj7yCH1J6Ne"
      );
      await gapDetector.detectGaps();
    } else {
      console.log("Raydium Platform Indexer");
      console.log("");
      console.log("Usage:");
      console.log(
        "  bun index.ts --backfill                    # Start backfill process"
      );
      console.log(
        "  bun index.ts --realtime                    # Start realtime monitoring"
      );
      console.log(
        "  bun index.ts --debug <signature>           # Debug a specific transaction"
      );
      console.log("");
      console.log("Examples:");
      console.log("  bun index.ts --backfill");
      console.log("  bun index.ts --realtime");
      console.log("  bun index.ts --debug 5J7X...");
    }
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
(globalThis as any).process.on(
  "unhandledRejection",
  (reason: any, promise: any) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  }
);

main();
