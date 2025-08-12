import { PublicKey } from "@solana/web3.js";

export interface Config {
  rpcUrl: string;
  wsUrl: string;
  programId: PublicKey;
}

export const config: Config = {
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  wsUrl:
    process.env.SOLANA_WEBSOCKET_URL || "wss://api.mainnet-beta.solana.com",

  // Program Configuration
  programId: new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"),
};

export function validateConfig(config: Config): void {
  if (!config.rpcUrl) {
    throw new Error("RPC URL is required");
  }

  if (!config.wsUrl) {
    throw new Error("WebSocket URL is required");
  }
}
