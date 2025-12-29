# STX Names Backend

Backend service for STX Names Registry with Chainhooks integration using NeonDB (PostgreSQL).

## Features

- 🔗 Chainhooks integration for real-time event tracking
- 🗄️ PostgreSQL database (NeonDB) for efficient data storage
- 🚀 REST API endpoints for frontend integration
- 📊 Event history tracking (registrations, transfers, releases)

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Stacks Network Configuration
NETWORK=mainnet
CONTRACT_ADDRESS=SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R
CONTRACT_NAME=username-registry-v2

# Chainhooks API Configuration
CHAINHOOKS_API_KEY=your-chainhooks-api-key-here
CHAINHOOKS_BASE_URL=https://api.mainnet.hiro.so
CHAINHOOKS_WEBHOOK_SECRET=your-webhook-secret-here

# NeonDB PostgreSQL Connection String
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# API Configuration
API_BASE_URL=http://localhost:3001
```

**Get Chainhooks API Key:**
1. Visit [Hiro Platform](https://platform.hiro.so/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key for Chainhooks

**Get NeonDB Connection String:**
1. Sign up at [Neon](https://neon.tech/)
2. Create a new project
3. Copy the connection string from the project dashboard

### 3. Initialize Database

The database schema will be automatically created when you start the server, but you can also run:

```bash
npm run setup-db
```

### 4. Register Chainhooks

Before starting the server, register the chainhooks:

```bash
npm run register-chainhooks
```

Optionally, provide a starting block height to backfill events:

```bash
npm run register-chainhooks 1000000
```

### 5. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

## API Endpoints

### Public Endpoints

- `GET /health` - Health check
- `GET /api/usernames` - List all usernames (supports `?limit=100&offset=0`)
- `GET /api/usernames/:username` - Get username details
- `GET /api/usernames/owner/:owner` - Get username by owner address
- `GET /api/events/recent` - Get recent events (supports `?limit=50`)
- `GET /api/stats` - Get statistics

### Chainhook Webhooks (Internal)

- `POST /api/chainhooks/register-username` - Handle registration events
- `POST /api/chainhooks/transfer-username` - Handle transfer events
- `POST /api/chainhooks/release-username` - Handle release events

## Database Schema

### usernames
- `username` (VARCHAR(30), PRIMARY KEY)
- `owner` (VARCHAR(255))
- `registered_at` (BIGINT)
- `tx_id` (VARCHAR(255))
- `block_height` (INTEGER)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### transfers
- `id` (SERIAL, PRIMARY KEY)
- `username` (VARCHAR(30), FOREIGN KEY)
- `from_owner` (VARCHAR(255))
- `to_owner` (VARCHAR(255))
- `tx_id` (VARCHAR(255))
- `block_height` (INTEGER)
- `timestamp` (BIGINT)
- `created_at` (TIMESTAMP)

### releases
- `id` (SERIAL, PRIMARY KEY)
- `username` (VARCHAR(30), FOREIGN KEY)
- `previous_owner` (VARCHAR(255))
- `tx_id` (VARCHAR(255))
- `block_height` (INTEGER)
- `timestamp` (BIGINT)
- `created_at` (TIMESTAMP)

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run setup-db` - Initialize database schema
- `npm run register-chainhooks` - Register chainhooks with API

## Troubleshooting

### Chainhooks not receiving events

1. Verify your `CHAINHOOKS_API_KEY` is correct
2. Check that chainhooks are registered: `npm run register-chainhooks`
3. Ensure your server is accessible from the internet (use ngrok for local development)
4. Verify webhook secret matches in both chainhook config and `.env`

### Database connection issues

1. Verify `DATABASE_URL` is correct
2. Check that your NeonDB project is active
3. Ensure SSL is enabled in connection string

## Notes

- The event handlers parse chainhook events based on the Hiro Chainhooks API format
- You may need to adjust the event parsing logic in `src/events.ts` based on actual event structure
- For production, use a process manager like PM2 or deploy to a cloud service








