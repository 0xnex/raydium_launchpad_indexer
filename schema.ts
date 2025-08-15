import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mint = sqliteTable(
  "mints",
  {
    mint: text("mint").primaryKey(),
    creator: text("creator").notNull().default(""),
    poolState: text("pool_state").notNull(),
    platformConfig: text("platform_config").notNull(),
    name: text("name").notNull().default(""),
    symbol: text("symbol").notNull().default(""),
    uri: text("uri").notNull().default(""),
    decimals: integer("decimals").notNull().default(6),
    supply: text("supply").notNull().default("0"),
    totalBaseSell: text("total_base_sell").notNull().default("0"),
    totalQuoteFundRaising: text("total_quote_fund_raising")
      .notNull()
      .default("0"),
    totalLockedAmount: text("total_locked_amount").notNull().default("0"),
    cliffPeriod: text("cliff_period").notNull().default("0"),
    cliffPeriodEnd: text("cliff_period_end").notNull().default("0"),
    blockTime: integer("block_time").notNull().default(0),
    signature: text("signature").notNull().default(""),
    slot: text("slot").notNull().default("0"),
    lastTradeId: integer("last_trade_id").default(0),
    lastTradeSlot: integer("last_trade_slot").default(0),
  },
  (t) => ({
    idxCreator: index("idx_creator").on(t.creator),
    idxPlatformConfig: index("idx_platform_config").on(t.platformConfig),
    idxLastTradeId: index("idx_last_trade_id").on(t.lastTradeId),
  })
);

export const trade = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mint: text("mint").notNull(),
    platformConfig: text("platform_config").notNull(),
    poolState: text("pool_state").notNull(),
    user: text("user").notNull(),
    totalBaseSell: text("total_base_sell").notNull(),
    virtualBase: text("virtual_base").notNull(),
    virtualQuote: text("virtual_quote").notNull(),
    realBaseBefore: text("real_base_before").notNull(),
    realQuoteBefore: text("real_quote_before").notNull(),
    realBaseAfter: text("real_base_after").notNull(),
    realQuoteAfter: text("real_quote_after").notNull(),
    amountIn: text("amount_in").notNull(),
    amountOut: text("amount_out").notNull(),
    protocolFee: text("protocol_fee").notNull(),
    platformFee: text("platform_fee").notNull(),
    shareFee: text("share_fee").notNull(),
    tradeDirection: text("trade_direction", {
      enum: ["buy", "sell"],
    }).notNull(),
    poolStatus: text("pool_status", {
      enum: ["Fund", "Migrate", "Trade"],
    }).notNull(),
    signature: text("signature").unique().notNull(),
    blockTime: integer("block_time").notNull(),
    slot: integer("slot").notNull(),
  },
  (t) => ({
    idxMintUser: index("idx_mint_user").on(t.mint, t.user),
    idxMintPoolState: index("idx_mint_pool_state").on(t.mint, t.poolState),
  })
);

export const userBalance = sqliteTable(
  "user_balances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user: text("user").notNull(),
    mint: text("mint").notNull(),
    platformConfig: text("platform_config").notNull(),
    balance: text("balance").notNull(),
    blockTime: integer("block_time").notNull(),
    signature: text("signature").notNull(),
  },
  (t) => ({
    idxUserMint: index("idx_user_mint").on(t.user, t.mint),
  })
);

export const userProfits = sqliteTable(
  "user_profits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    user: text("user").notNull(),
    mint: text("mint").notNull(),
    platformConfig: text("platform_config").notNull(),
    investedAmount: text("invested_amount").notNull(),
    profitAmount: text("profit_amount").notNull(),
  },
  (t) => ({
    idxUserMint: index("idx_user_profits_user_mint").on(t.user, t.mint),
  })
);

export const klines = sqliteTable(
  "klines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mint: text("mint").notNull(),
    interval: text("interval", {
      enum: ["1m", "5m", "30m", "2h", "12h"],
    }).notNull(),
    intervalStart: integer("interval_start").notNull(),
    open: text("open").notNull(),
    high: text("high").notNull(),
    low: text("low").notNull(),
    close: text("close").notNull(),
    baseVolume: text("base_volume").notNull(),
    quoteVolume: text("quote_volume").notNull(),
  },
  (t) => ({
    idxMintIntervalIntervalStart: index("idx_mint_interval_interval_start").on(
      t.mint,
      t.interval,
      t.intervalStart
    ),
  })
);

export const syncTracking = sqliteTable(
  "sync_tracking",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    startTx: text("start_tx").notNull(), // Start transaction of this sync range, this tx is included in the sync range
    endTx: text("end_tx").notNull(), // End transaction of this sync range, this tx is not included in the sync range
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    processedTx: text("processed_tx"), // Latest tx processed during sync
    createdAt: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text()
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`) // Set initial value on creation
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    idxStartTx: index("idx_sync_tracking_start_tx").on(t.startTx),
    idxEndTx: index("idx_sync_tracking_end_tx").on(t.endTx),
  })
);

export const trackError = sqliteTable("errors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  signature: text("signature").notNull(),
  error: text("error").notNull(),
  createdAt: text()
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// Add type definitions
export type Mint = typeof mint.$inferSelect;
export type NewMint = typeof mint.$inferInsert;

export type Trade = typeof trade.$inferSelect;
export type NewTrade = typeof trade.$inferInsert;

export type UserBalance = typeof userBalance.$inferSelect;
export type NewUserBalance = typeof userBalance.$inferInsert;

export type UserProfit = typeof userProfits.$inferSelect;
export type NewUserProfit = typeof userProfits.$inferInsert;

export type Kline = typeof klines.$inferSelect;
export type NewKline = typeof klines.$inferInsert;

export type SyncTracking = typeof syncTracking.$inferSelect;
export type NewSyncTracking = typeof syncTracking.$inferInsert;

export type TrackError = typeof trackError.$inferSelect;
export type NewTrackError = typeof trackError.$inferInsert;
