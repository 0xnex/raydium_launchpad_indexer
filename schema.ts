import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mint = sqliteTable(
  "mints",
  {
    mint: text("mint").primaryKey(),
    creator: text("creator").notNull(),
    poolState: text("pool_state").notNull(),
    platformConfig: text("platform_config"),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    uri: text("uri"),
    decimals: integer("decimals").notNull(),
    supply: text("supply").notNull(),
    totalBaseSell: text("total_base_sell").notNull(),
    totalQuoteFundRaising: text("total_quote_fund_raising").notNull(),
    totalLockedAmount: text("total_locked_amount").notNull(),
    cliffPeriod: text("cliff_period").notNull(),
    cliffPeriodEnd: text("cliff_period_end").notNull(),
    createdBlockTime: integer("created_block_time").notNull(),
    createdSignature: text("created_signature").notNull(),
    updatedBlockTime: integer("updated_block_time"),
    updatedSignature: text("updated_signature"),
    virtualBase: text("virtual_base").notNull(),
    virtualQuote: text("virtual_quote").notNull(),
    realBase: text("real_base").notNull(),
    realQuote: text("real_quote").notNull(),
    poolStatus: text("pool_status", {
      enum: ["Fund", "Migrate", "Trade"],
    }).notNull(),
  },
  (t) => ({
    idxCreator: index("idx_creator").on(t.creator),
    idxPlatformConfig: index("idx_platform_config").on(t.platformConfig),
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
  },
  (t) => ({
    idxMintUser: index("idx_mint_user").on(t.mint, t.user),
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
