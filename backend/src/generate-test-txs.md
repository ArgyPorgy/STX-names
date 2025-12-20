# Generating Test Transactions for Chainhook Usage

To increase chainhook usage (for bounty purposes), you have a few options:

## Option 1: Test Webhooks Directly (Fast, No Blockchain Fees)

This tests your webhook endpoints directly without going through the blockchain:

```bash
# Send 100 test webhooks
npm run test-webhooks -- --count 100 --prefix testuser

# Custom sender address
npm run test-webhooks -- --count 50 --sender SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R --prefix mytest
```

This will:
- Generate test webhook payloads
- Send them directly to your server
- Store test usernames in the database
- **Does NOT trigger actual chainhooks** (since it bypasses the blockchain)

## Option 2: Real On-Chain Transactions (Triggers Chainhooks, Costs STX)

To actually trigger chainhooks (which counts toward usage), you need to make real on-chain transactions.

### Using Stacks.js Script

Create a script that calls your contract multiple times:

```typescript
// scripts/generate-txs.ts
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import { broadcastTransaction, makeContractCall, AnchorMode } from '@stacks/transactions';
import { privateKeyToString } from '@stacks/transactions';

const network = new StacksMainnet(); // or StacksTestnet
const privateKey = process.env.PRIVATE_KEY; // Your private key
const count = 100; // Number of transactions

for (let i = 0; i < count; i++) {
  const username = `testuser${Date.now()}${i}`;
  
  const tx = await makeContractCall({
    contractAddress: 'SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R',
    contractName: 'username-registry-v2',
    functionName: 'register-username',
    functionArgs: [stringAsciiCV(username)],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 5000, // Adjust fee as needed
  });
  
  const result = await broadcastTransaction(tx, network);
  console.log(`Transaction ${i + 1}: ${result.txid}`);
  
  // Wait between transactions to avoid nonce issues
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### Using curl with Stacks API

You can also use the Stacks API directly, but you'll need to sign transactions properly.

## Option 3: Batch Script for Multiple Transactions

For real on-chain transactions, you'll want to:
1. Use different accounts/keys to avoid nonce conflicts
2. Space out transactions (wait for confirmations)
3. Handle errors gracefully

**Note:** Real transactions cost STX fees, so you'll need to fund the account(s) you're using.

## Recommendation

For bounty purposes:
- **If the bounty counts webhook deliveries**: Use Option 1 (test webhooks) - it's fast and free
- **If the bounty counts actual chainhook triggers**: Use Option 2 (real transactions) - requires STX but actually triggers chainhooks
- **If the bounty counts chainhook evaluations**: The chainhooks will evaluate blocks anyway, but transactions trigger more evaluations

Check the bounty requirements to see what specifically counts toward usage!



