# Raydium Platform Indexer

A real-time and historical transaction indexer for the Raydium launchpad platform on Solana. Monitors pool creation and trading activities, storing data in SQLite for analytics.

## Features

- **Real-time Monitoring**: WebSocket-based transaction monitoring
- **Historical Backfilling**: Fetch and process past transactions
- **Gap Detection**: Automatically detect and fill missing transaction ranges
- **Database Storage**: SQLite with Drizzle ORM for type-safe operations
- **Error Handling**: Robust error handling with retry mechanisms

## Installation

```bash
git clone <repository-url>
cd raydium_platform_indexer
bun install
bun run db:generate
bun run db:migrate
```

## Usage

```bash
# Real-time monitoring
bun run index.ts --realtime

# Historical backfilling
bun run index.ts --backfill

# Debug transaction
bun run index.ts --debug <signature>

# Gap detection
bun run index.ts --gap
```

## Database Schema

- **`mints`**: Pool creation and token metadata
- **`trades`**: Trading transactions and pool state
- **`user_balances`**: User token balances
- **`user_profits`**: Investment and profit tracking
- **`klines`**: OHLCV price data
- **`sync_tracking`**: Transaction range tracking
- **`errors`**: Error logging

## Configuration

Default settings:

- **RPC URL**: `https://api.mainnet-beta.solana.com`
- **Program ID**: `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`
- **Database**: `launchpad_events.db`

## Development

```bash
# Generate migrations
bun run db:generate

# Apply migrations
bun run db:migrate

# View database
bun run db:studio
```

## License

MIT License
