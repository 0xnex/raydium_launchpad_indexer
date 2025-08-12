import { Connection } from "@solana/web3.js";
import { config } from "./config";
import { parseTransaction } from "./raydium";

const connections = config.rpcUrl.split(",").map(
  (url) =>
    new Connection(url, {
      wsEndpoint: config.wsUrl,
      commitment: "confirmed",
    })
);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const queue: string[] = [];
let i = 0;

function doQueue() {
  const sig = queue.shift();

  if (!sig) {
    sleep(1000).then(doQueue);
    console.log("Sleeping for 1 second");
    return;
  }
  parseTransaction(sig, connections[i++ % connections.length]!).then(doQueue);
}

function main() {
  const ws = connections[0];

  ws?.onLogs(config.programId, async (logs, ctx) => {
    queue.push(logs.signature);
  });

  doQueue();

  process.on("SIGINT", () => {
    console.log("SIGINT received, exiting...");
    process.exit(0);
  });
}

async function dump() {
  const result = await parseTransaction(
    "4EEjxchJQhYtrfDBckUTt5PEXwuRsYbsMuBFHDtmGo6ECgrgDNQCcq5AernFHn5kTZwNKndjDxxABPNdZcoztqAq",
    connections[2]!
  );
  console.log(result);
}

main();
