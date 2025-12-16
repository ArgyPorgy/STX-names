# Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Create .env File

Create a `.env` file in the `backend/` directory with:

```env

```

**Important Notes:**
- Get your Chainhooks API key from [Hiro Platform](https://platform.hiro.so/)
- Get your NeonDB connection string from your [Neon Dashboard](https://console.neon.tech/)
- For local development with webhooks, use [ngrok](https://ngrok.com/) to expose your local server
  - Run: `ngrok http 3001`
  - Update `API_BASE_URL` in `.env` with the ngrok URL

## Step 3: Initialize Database

```bash
npm run setup-db
```

## Step 4: Register Chainhooks

**Before registering chainhooks, make sure your server is running and accessible!**

For local development:
1. Start ngrok: `ngrok http 3001`
2. Update `.env` with the ngrok URL: `API_BASE_URL=https://your-ngrok-url.ngrok.io`
3. Restart your server

Then register chainhooks:

```bash
npm run register-chainhooks
```

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
