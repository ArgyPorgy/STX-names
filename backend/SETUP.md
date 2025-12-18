# Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Create .env File

**⚠️ IMPORTANT: You MUST get your API keys BEFORE running the registration script!**

1. **Get Chainhooks API Key:**
   - Sign up/login at [Hiro Platform](https://platform.hiro.so/)
   - Navigate to API Keys section
   - Generate a new API key for Chainhooks
   - Copy the key

2. **Get NeonDB Connection String:**
   - Sign up at [Neon](https://neon.tech/)
   - Create a new project
   - Copy the connection string from the dashboard

3. **Create `.env` file** in the `backend/` directory:

```env
PORT=3001
NODE_ENV=development

NETWORK=mainnet
CONTRACT_ADDRESS=SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R
CONTRACT_NAME=username-registry-v2

# ⚠️ REQUIRED: Get this from https://platform.hiro.so/
CHAINHOOKS_API_KEY=your-api-key-here
CHAINHOOKS_BASE_URL=https://api.mainnet.hiro.so
CHAINHOOKS_WEBHOOK_SECRET=your-secret-here

# ⚠️ REQUIRED: Get this from https://console.neon.tech/
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require

# For local development with webhooks, use ngrok:
# 1. Run: ngrok http 3001
# 2. Copy the https URL and paste here
API_BASE_URL=http://localhost:3001
```

**Note:** If you don't set `CHAINHOOKS_API_KEY`, the registration script will fail with a clear error message.

## Step 3: Initialize Database

```bash
npm run setup-db
```

## Step 4: Register Chainhooks

**⚠️ Make sure you've set `CHAINHOOKS_API_KEY` in your `.env` file first!**

**Before registering chainhooks, make sure your server is running and accessible!**

For local development:
1. Start your server: `npm run dev` (in a separate terminal)
2. Start ngrok: `ngrok http 3001`
3. Update `.env` with the ngrok URL: `API_BASE_URL=https://your-ngrok-url.ngrok.io`
4. Restart your server to pick up the new `API_BASE_URL`

Then register chainhooks (the script will validate the API key first):

```bash
npm run register-chainhooks
```

**If you see an error about missing API key, go back to Step 2 and add it to `.env`**

Optionally, provide a starting block height to backfill events:

```bash
npm run register-chainhooks 1000000
```

## Step 5: Start the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## Testing the API

Once running, test the endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Get all usernames
curl http://localhost:3001/api/usernames

# Get username by name
curl http://localhost:3001/api/usernames/alice

# Get username by owner
curl http://localhost:3001/api/usernames/owner/SP123...

# Get recent events
curl http://localhost:3001/api/events/recent

# Get stats
curl http://localhost:3001/api/stats
```

## Next Steps

After the backend is running:
1. The chainhooks will automatically start receiving events
2. Events will be stored in your NeonDB database
3. You can query the API from your frontend
4. Update your frontend to use the backend API instead of direct contract calls for read operations

