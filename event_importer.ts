import { db } from "./database";
import { mint, trade, type NewMint, type NewTrade } from "./schema";
import { BN } from "@coral-xyz/anchor";
import {
  type PoolCreatedEvent,
  type RaydiumEventData,
  type TradeEvent,
  InitializeAccountIndex,
} from "./raydium";
import { eq } from "drizzle-orm";

export async function importMint(mintEvent: RaydiumEventData) {
  const data = mintEvent.data as unknown as PoolCreatedEvent;
  const newMint: NewMint = {
    mint: mintEvent.accounts[InitializeAccountIndex.BaseMint]?.toString() ?? "",
    creator:
      mintEvent.accounts[InitializeAccountIndex.Creator]?.toString() ?? "",
    poolState:
      mintEvent.accounts[InitializeAccountIndex.PoolState]?.toString() ?? "",
    platformConfig:
      mintEvent.accounts[InitializeAccountIndex.PlatformConfig]?.toString() ??
      "",
    name: data.base_mint_param.name,
    symbol: data.base_mint_param.symbol,
    uri: data.base_mint_param.uri,
    decimals: data.base_mint_param.decimals,
    supply: data.curve_param.Constant.data.supply.toString(),
    totalBaseSell: data.curve_param.Constant.data.total_base_sell.toString(),
    totalQuoteFundRaising:
      data.curve_param.Constant.data.total_quote_fund_raising.toString(),
    totalLockedAmount: data.vesting_param.total_locked_amount.toString(),
    cliffPeriod: data.vesting_param.cliff_period.toString(),
    cliffPeriodEnd: data.vesting_param.cliff_period.toString(),
    createdSignature: mintEvent.signature,
    createdBlockTime: mintEvent.blockTime,
    virtualBase: new BN(0).toString(),
    virtualQuote: new BN(0).toString(),
    realBase: new BN(0).toString(),
    realQuote: new BN(0).toString(),
    poolStatus: "Fund",
    updatedSignature: mintEvent.signature,
    updatedBlockTime: mintEvent.blockTime,
  };
  await db.insert(mint).values(newMint).onConflictDoNothing();
}

const getPoolStatus = (
  poolStatus: { Fund: {} } | { Migrate: {} } | { Trade: {} }
) => {
  if ("Fund" in poolStatus) return "Fund";
  if ("Migrate" in poolStatus) return "Migrate";
  if ("Trade" in poolStatus) return "Trade";
  return "Trade";
};

export async function importTrade(tradeEvent: RaydiumEventData) {
  const data = tradeEvent.data as unknown as TradeEvent;
  const newTrade: NewTrade = {
    mint:
      tradeEvent.accounts[InitializeAccountIndex.BaseMint]?.toString() ?? "",
    platformConfig:
      tradeEvent.accounts[InitializeAccountIndex.PlatformConfig]?.toString() ??
      "",
    poolState:
      tradeEvent.accounts[InitializeAccountIndex.PoolState]?.toString() ?? "",
    user: tradeEvent.accounts[InitializeAccountIndex.Creator]?.toString() ?? "",
    totalBaseSell: data.total_base_sell.toString(),
    virtualBase: data.virtual_base.toString(),
    virtualQuote: data.virtual_quote.toString(),
    realBaseBefore: data.real_base_before.toString(),
    realQuoteBefore: data.real_quote_before.toString(),
    realBaseAfter: data.real_base_after.toString(),
    realQuoteAfter: data.real_quote_after.toString(),
    amountIn: data.amount_in.toString(),
    amountOut: data.amount_out.toString(),
    protocolFee: data.protocol_fee.toString(),
    platformFee: data.platform_fee.toString(),
    shareFee: data.share_fee.toString(),
    tradeDirection: "Buy" in data.trade_direction ? "buy" : "sell",
    poolStatus: getPoolStatus(data.pool_status),
    signature: tradeEvent.signature,
    blockTime: tradeEvent.blockTime,
  };
  await db.insert(trade).values(newTrade).onConflictDoNothing();
  await db
    .update(mint)
    .set({
      virtualBase: data.virtual_base.toString(),
      virtualQuote: data.virtual_quote.toString(),
      realBase: data.real_base_after.toString(),
      realQuote: data.real_quote_after.toString(),
      poolStatus: getPoolStatus(data.pool_status),
      updatedSignature: tradeEvent.signature,
      updatedBlockTime: tradeEvent.blockTime,
    })
    .where(
      eq(
        mint.mint,
        tradeEvent.accounts[InitializeAccountIndex.BaseMint]?.toString() ?? ""
      )
    );
}

export async function processAndImportEvents(events: RaydiumEventData[]) {
  for (const event of events) {
    console.log(`\t📊 processAndImportEvents: ${event.eventType}...`);
    if (event.eventType === "PoolCreateEvent") {
      await importMint(event);
    } else if (event.eventType === "TradeEvent") {
      await importTrade(event);
    } else {
      throw new Error(`Unknown event type: ${event.eventType}`);
    }
  }
}
