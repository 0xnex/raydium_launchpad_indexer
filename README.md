# Raydium Launchpad Indexer

A comprehensive indexer for Raydium launchpad events that stores `PoolCreated` and `TradeEvent` data in a local database.

## Features

- **Real-time Event Monitoring**: Listens for new Raydium launchpad transactions via WebSocket
- **Historical Backfill**: Processes past transactions to catch up on missed events
- **Comprehensive Data Storage**: Stores detailed information about pool creation and trading events
- **Database Operations**: Full CRUD operations for querying and analyzing data
- **Error Handling**: Robust error handling and logging

## Usage

### Install dependencies

```code
pnpm i
```

### Listen events

```code
bun run index.ts
```

## License

MIT License - see LICENSE file for details.
