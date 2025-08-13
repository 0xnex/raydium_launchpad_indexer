# Raydium Platform Indexer

A real-time and historical transaction indexer for the Raydium launchpad platform on Solana. This tool monitors and parses Raydium launchpad events, including pool creation and trading activities, and stores them in a SQLite database for analytics and tracking.

## Features

### 🔄 Real-time Event Monitoring

- **WebSocket Integration**: Monitors Raydium launchpad transactions in real-time
- **Event Queue Processing**: Processes transactions asynchronously with configurable polling intervals
- **Multi-RPC Support**: Load balancing across multiple RPC endpoints for reliability
- **Event Listeners**: Custom event processing with callback functions

### 📊 Historical Data Backfilling

- **Flexible Range Queries**: Fetch historical transactions using `before` and `until` parameters
- **Pagination Support**: Efficiently processes large transaction ranges
- **Progress Tracking**: Monitor backfilling progress with event listeners

### 🗄️ Database Storage & Analytics

- **SQLite Database**: Local storage with Drizzle ORM for type-safe database operations
- **Comprehensive Schema**: Store mints, trades, user balances, profits, and price data
- **Real-time Updates**: Automatic database updates as events are processed
- **Data Integrity**: Proper indexing and foreign key relationships

### 📈 Data Models

#### **Mints (Pool Creation)**

- Token metadata (name, symbol, decimals, URI)
- Pool state and creator information
- Curve parameters (supply, fundraising amounts)
- Vesting parameters (locked amounts, cliff periods)
- Pool status tracking (Fund/Migrate/Trade)

#### **Trades**

- Buy/sell transaction details
- Virtual and real base/quote amounts
- Fee breakdowns (protocol, platform, share fees)
- Trading direction and pool status
- Transaction signatures and timestamps

#### **User Balances**

- Real-time token balances per user
- Balance change tracking with signatures
- Historical balance snapshots

#### **User Profits**

- Investment tracking per user
- Profit/loss calculations
- Performance analytics

#### **Klines (Price Data)**

- OHLCV data for different time intervals
- Volume tracking (base and quote)
- Price history for charts and analysis

### 🧰 Developer Tools

- **Transaction Debugging**: Parse individual transactions by signature
- **Event Importing**: Structured database import functions
- **Error Handling**: Robust error handling with detailed logging
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd raydium_platform_indexer

# Install dependencies
bun install

# Generate database schema
bun run db:generate

# Run database migrations
bun run db:migrate
```

## Configuration

Create a `.env` file or set environment variables:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WEBSOCKET_URL=wss://api.mainnet-beta.solana.com

# For multiple RPC endpoints (comma-separated)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com,https://solana-api.projectserum.com
```

### Default Configuration

- **RPC URL**: `https://api.mainnet-beta.solana.com`
- **WebSocket URL**: `wss://api.mainnet-beta.solana.com`
- **Program ID**: `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj` (Raydium Launchpad)
- **Commitment**: `confirmed`
- **Database**: `raydium_events.db` (SQLite)

## Usage

### Real-time Monitoring

Start the real-time event listener:

```bash
bun run start
```

This will:

1. Connect to Solana WebSocket
2. Monitor Raydium launchpad transactions
3. Parse events and store them in the database
4. Log processing status in real-time

### Historical Data Backfilling

Backfill historical data with custom range:

```typescript
// In your code
await backfill(
  "before_signature", // Optional: start from this signature
  "until_signature", // Optional: stop at this signature
  (event) => {
    console.log(`Processing: ${event.signature}`);
    // Custom processing logic
  }
);
```

### Debug Individual Transaction

Parse a specific transaction by signature:

```bash
bun run start --debug <transaction_signature>
```

### Database Queries

Query the stored data:

```typescript
import { db } from "./database";
import { mint, trade, userBalance } from "./schema";

// Get recent trades
const recentTrades = await db.select().from(trade).limit(10);

// Get token information
const tokenInfo = await db
  .select()
  .from(mint)
  .where(eq(mint.mint, "token_address"));

// Get user balances
const userBalances = await db
  .select()
  .from(userBalance)
  .where(eq(userBalance.user, "user_address"));
```

## Database Schema

### Core Tables

- **`mints`**: Pool creation and token metadata
- **`trades`**: Trading transactions and pool state changes
- **`user_balances`**: Real-time user token balances
- **`user_profits`**: User investment and profit tracking
- **`klines`**: OHLCV price data for different intervals

### Key Features

- **Automatic Indexing**: Optimized queries with proper indexes
- **Type Safety**: Full TypeScript integration with Drizzle ORM
- **Data Integrity**: Foreign key relationships and constraints
- **Conflict Resolution**: Handles duplicate transactions gracefully

## Development

### Project Structure

```
raydium_platform_indexer/
├── index.ts # Main indexer logic
├── raydium.ts # Event parsing and transaction handling
├── event_importer.ts # Database import functions
├── schema.ts # Database schema definitions
├── database.ts # Database connection and utilities
├── config.ts # Configuration management
└── launchpad_idl.json # Raydium program IDL
```

### Adding New Event Types

1. **Update Schema**: Add new table in `schema.ts`
2. **Create Import Function**: Add import logic in `event_importer.ts`
3. **Update Parser**: Add event type handling in `raydium.ts`
4. **Test**: Verify with sample transaction data

### Database Operations

```bash
# Generate new migrations
bun run db:generate

# Apply migrations
bun run db:migrate

# Reset database
bun run db:reset

# View database
bun run db:studio
```

## Monitoring & Analytics

### Available Data

- **Token Performance**: Track token prices, volume, and market cap
- **User Activity**: Monitor user trading patterns and profits
- **Pool Analytics**: Analyze pool creation and trading activity
- **Fee Tracking**: Monitor protocol and platform fee collection

### Query Examples

```sql
-- Top performing tokens
SELECT m.symbol, m.name, COUNT(t.id) as trade_count,
       SUM(CAST(t.amount_in AS REAL)) as total_volume
FROM mints m
JOIN trades t ON m.mint = t.mint
GROUP BY m.mint
ORDER BY total_volume DESC;

-- User profit analysis
SELECT up.user, up.mint, up.invested_amount, up.profit_amount,
       (CAST(up.profit_amount AS REAL) / CAST(up.invested_amount AS REAL)) * 100 as roi_percent
FROM user_profits up
ORDER BY roi_percent DESC;
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
