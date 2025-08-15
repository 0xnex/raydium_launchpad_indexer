import { Connection } from "@solana/web3.js";
import { config } from "./config";

const websocket = config.wsUrl;
const rpcs = config.rpcUrl
  .split(",")
  .map(
    (url) =>
      new Connection(url, { wsEndpoint: websocket, commitment: "confirmed" })
  );

let currentIndex = 0;

export function getConnection(): Connection {
  const rpc = rpcs[currentIndex++ % rpcs.length];
  return rpc!;
}
