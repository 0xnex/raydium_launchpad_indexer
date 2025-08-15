import { db } from "./database";
import {
  InitializeAccountIndex,
  TradeAccountIndex,
  type PoolCreatedEvent,
  type RaydiumEventData,
  type TradeEvent,
} from "./raydium";
import { mint, trade, type NewMint, type NewTrade } from "./schema";
import { and, eq, lt, lte } from "drizzle-orm";

export async function importMintEvent(mintEvent: RaydiumEventData) {
  const data = mintEvent.data as unknown as PoolCreatedEvent;
  const mintAddress =
    mintEvent.accounts[InitializeAccountIndex.BaseMint]?.toString() ?? "";

  // check if mint already exists
  const existingMint = await db
    .select()
    .from(mint)
    .where(eq(mint.mint, mintAddress))
    .limit(1);

  if (existingMint.length > 0) {
    console.log(`⏭️ Mint ${mintAddress} already exists, skipping...`);
    return;
  }

  const newMint: NewMint = {
    mint: mintAddress,
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
    signature: mintEvent.signature,
    blockTime: mintEvent.blockTime,
    slot: mintEvent.slot.toString(),
  };

  await db.insert(mint).values(newMint);
  console.log(`✅ Created new mint: ${mintAddress}`);
}

const getPoolStatus = (
  poolStatus: { Fund: {} } | { Migrate: {} } | { Trade: {} }
) => {
  if ("Fund" in poolStatus) return "Fund";
  if ("Migrate" in poolStatus) return "Migrate";
  if ("Trade" in poolStatus) return "Trade";
  return "Trade";
};

export async function importTradeEvent(
  tradeEvent: RaydiumEventData
): Promise<{ id: number }> {
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
    slot: tradeEvent.slot,
  };
  const e = await db.insert(trade).values(newTrade).returning({ id: trade.id });
  return e[0]!;
}

export async function processAndImportEvents(
  events: RaydiumEventData[],
  source: "backfill" | "realtime"
) {
  for (const event of events) {
    console.log(`\t📊 processAndImportEvents: ${event.eventType}...`);
    if (event.eventType === "PoolCreateEvent") {
      await importMintEvent(event);
    } else if (event.eventType === "TradeEvent") {
      await processTradeEvent(event, source);
    } else {
      console.log(`\t🔮 Unknown event type: ${event.eventType}`);
    }
  }
}

async function processTradeEvent(
  event: RaydiumEventData,
  source: "backfill" | "realtime"
) {
  const trade = await importTradeEvent(event);

  const poolStateAddress =
    event.accounts[TradeAccountIndex.PoolState]?.toString() ?? "";

  // Get current mint data from database
  const currentMint = await db
    .select()
    .from(mint)
    .where(eq(mint.poolState, poolStateAddress))
    .limit(1);

  if (currentMint.length > 0) {
    const mintData = currentMint[0]!;

    if (mintData) {
      if (source === "backfill") {
        await db
          .update(mint)
          .set({ lastTradeSlot: event.slot, lastTradeId: trade.id })
          .where(
            and(
              eq(mint.poolState, poolStateAddress),
              lt(mint.lastTradeSlot, event.slot)
            )
          );
      } else {
        await db
          .update(mint)
          .set({ lastTradeSlot: event.slot, lastTradeId: trade.id })
          .where(
            and(
              eq(mint.poolState, poolStateAddress),
              lte(mint.lastTradeSlot, event.slot)
            )
          );
      }
    }
  } else {
    console.log(
      `\t🔮 Mint not found for pool state ${poolStateAddress}, creating new mint...`
    );
    await db.insert(mint).values({
      mint: event.accounts[TradeAccountIndex.BaseTokenMint]?.toString() ?? "",
      platformConfig:
        event.accounts[TradeAccountIndex.PlatformConfig]?.toString() ?? "",
      poolState: poolStateAddress,
      lastTradeSlot: event.slot,
      lastTradeId: trade.id,
    });
  }
}
