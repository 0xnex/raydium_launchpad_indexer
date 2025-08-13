import { PublicKey } from "@solana/web3.js";
import type { Commitment } from "@solana/web3.js";

export interface Config {
  // Solana Configuration
  rpcUrl: string;
  wsUrl: string;
  programId: PublicKey;
  platformConfigAddress?: string;
  databaseUrl: string;
}

export const config: Config = {
  // Solana Configuration
  rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  wsUrl:
    process.env.SOLANA_WEBSOCKET_URL || "wss://api.mainnet-beta.solana.com",

  // Program Configuration
  programId: new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj"),
  databaseUrl: process.env.DATABASE_URL || "file:./raydium_platform_indexer.db",
};

export function validateConfig(config: Config): void {
  if (!config.rpcUrl) {
    throw new Error("RPC URL is required");
  }

  if (!config.wsUrl) {
    throw new Error("WebSocket URL is required");
  }
}
