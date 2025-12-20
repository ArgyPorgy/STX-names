# Setup Instructions

## Current Status ✅

All chainhooks are **enabled and streaming**:
- ✅ register-username
- ✅ transfer-username  
- ✅ release-username

## To Start Everything

### 1. Start Backend Server
```bash
cd backend
npm run dev
```

The server should start on `http://localhost:3001`

### 2. Start ngrok (in a separate terminal)
```bash
ngrok http 3001
```

This will expose your local server to the internet. Copy the HTTPS URL (e.g., `https://xxxxx.ngrok-free.app`)

### 3. Update .env if needed
Make sure your `.env` has:
```
API_BASE_URL=https://xxxxx.ngrok-free.app  # (your ngrok URL)
CHAINHOOKS_API_KEY=your_key_here
DATABASE_URL=your_db_url
```

### 4. Verify Setup
Run the diagnostic script:
```bash
cd backend
npm run diagnose-setup
```

Or manually check:
```bash
# Check backend
curl http://localhost:3001/health

# Check ngrok
curl http://127.0.0.1:4040/api/tunnels

# Check chainhooks
npm run check-chainhooks
```

## Common Issues

### Backend not responding
- Kill stuck processes: `pkill -f "tsx watch"`
- Restart: `npm run dev`

### ngrok not running
- Start ngrok: `ngrok http 3001`
- Make sure API_BASE_URL matches ngrok URL

### Chainhooks interrupted
- Run: `npm run enable-chainhooks`

### Webhooks not being received
1. Make sure both backend AND ngrok are running
2. Verify chainhooks are "streaming" (not "interrupted")
3. Check ngrok dashboard: http://127.0.0.1:4040
4. Check backend logs for incoming webhooks

## Testing

Generate test transactions:
```bash
npm run generate-chainhook-txs -- 5
```

Test webhooks directly:
```bash
npm run test-webhooks -- --count 10
```
