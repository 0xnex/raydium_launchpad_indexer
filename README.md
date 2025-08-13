# Raydium Platform Indexer

A real-time and historical transaction indexer for the Raydium launchpad platform on Solana. This tool monitors and parses Raydium launchpad events, including pool creation and trading activities.

## Features

### 🔄 Real-time Event Monitoring

- **WebSocket Integration**: Monitors Raydium launchpad transactions in real-time
- **Event Queue Processing**: Processes transactions asynchronously with configurable polling intervals
- **Multi-RPC Support**: Load balancing across multiple RPC endpoints for reliability

### 📊 Historical Data Backfilling

- **Flexible Range Queries**: Fetch historical transactions using `before` and `until` parameters
- **Pagination Support**: Efficiently processes large transaction ranges
- **Progress Tracking**: Monitor backfilling progress with event listeners

### �� Event Parsing

- **Pool Creation Events**: Parse and extract pool creation data including:

  - Pool state information
  - Creator details
  - Base mint parameters (decimals, name, symbol, URI)
  - Curve parameters (supply, total base sell, fundraising amounts)
  - Vesting parameters (locked amounts, cliff/vesting periods)

- **Trade Events**: Parse and extract trading data including:
  - Pool state changes
  - Virtual and real base/quote amounts
  - Trading amounts (in/out)
  - Fee breakdowns (protocol, platform, share fees)
  - Trading direction (Buy/Sell)
  - Pool status (Fund/Migrate/Trade)

### ��️ Developer Tools

- **Transaction Debugging**: Parse individual transactions by signature
- **Event Listeners**: Custom event processing with callback functions
- **Error Handling**: Robust error handling with detailed logging
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd raydium_platform_indexer

# Install dependencies
bun install
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

## Usage

### Real-time Monitoring

Start the real-time event listener:

```bash
bun run start
```

This will:

1. Connect to Solana WebSocket
2. Monitor Raydium launchpad transactions
3. Parse and log events in real-time

### Debug Individual Transaction

Parse a specific transaction by signature:

```bash
bun run start --debug <transaction_signature>
```

Example:

```bash
bun run start --debug
```
