import { test, expect } from "bun:test";
import { parseTransaction, type PoolCreatedEvent } from "../raydium";
import { config } from "../config";
import { Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const connections = config.rpcUrl
  .split(",")
  .map((url) => new Connection(url, { commitment: "confirmed" }));

const getConnection = () => {
  return connections[Math.floor(Math.random() * connections.length)];
};

test("raydium initialize and buy", async () => {
  const events = await parseTransaction(
    "4EEjxchJQhYtrfDBckUTt5PEXwuRsYbsMuBFHDtmGo6ECgrgDNQCcq5AernFHn5kTZwNKndjDxxABPNdZcoztqAq",
    getConnection()!
  );

  const expectedPoolCreatedEvent: PoolCreatedEvent = {
    pool_state: new PublicKey("ECnREgF2Lrn8LRFV948X18EQfJidgBJSmkv4zZYZ8Wv3"),
    creator: new PublicKey("AyemPFVkNarEB1ThjYsctH4NLjFzdiXT3zWVviB9LFFN"),
    config: new PublicKey("6s1xP3hpbAfFoNtUNF8mfHsjr2Bd97JxFJRWLbL6aHuX"),
    base_mint_param: {
      decimals: 6,
      name: "Cat wif Boba",
      symbol: "CatBoba",
      uri: "https://ipfs.io/ipfs/bafkreihe2utpkvnjd2xcxjdbdgeqhwsolc4bp5uuncw2qn2dryp6x4ptyu",
    },
    curve_param: {
      Constant: {
        data: {
          supply: new BN("1000000000000000"),
          total_base_sell: new BN("800000000000000"),
          total_quote_fund_raising: new BN("85000000000"),
          migrate_type: 1,
        },
      },
    },
    vesting_param: {
      total_locked_amount: new BN("0"),
      cliff_period: new BN("0"),
      vesting_period: new BN("0"),
    },
  };

  expect(events.length).toBe(2);
  expect(events[0]!.eventType).toBe("PoolCreateEvent");
  const poolCreatedEvent = events[0]!.data as PoolCreatedEvent;
  expect(poolCreatedEvent.pool_state.toBase58()).toEqual(
    expectedPoolCreatedEvent.pool_state.toBase58()
  );
  expect(poolCreatedEvent.creator.toBase58()).toEqual(
    expectedPoolCreatedEvent.creator.toBase58()
  );
  expect(poolCreatedEvent.config.toBase58()).toEqual(
    expectedPoolCreatedEvent.config.toBase58()
  );
  expect(poolCreatedEvent.base_mint_param.decimals).toEqual(
    expectedPoolCreatedEvent.base_mint_param.decimals
  );
  expect(poolCreatedEvent.base_mint_param.name).toEqual(
    expectedPoolCreatedEvent.base_mint_param.name
  );
  expect(events[1]!.eventType).toBe("TradeEvent");
});
