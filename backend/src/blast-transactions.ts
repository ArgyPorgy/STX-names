import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  stringAsciiCV,
} from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';
import { config } from './config.js';
import 'dotenv/config';

// Enforce mainnet only
if (config.stacks.network !== 'mainnet') {
  console.error('❌ Error: This script only works on mainnet');
  process.exit(1);
}

const network = new StacksMainnet();
const CONTRACT_ADDRESS = config.stacks.contractAddress;
const CONTRACT_NAME = config.stacks.contractName;

// Generate random username (6 chars)
function generateUsername(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get account from mnemonic by index
async function getAccount(mnemonic: string, index: number): Promise<string> {
  const { generateWallet, generateNewAccount } = await import('@stacks/wallet-sdk');
  
  let wallet = await generateWallet({ secretKey: mnemonic, password: '' });
  
  for (let i = 1; i <= index; i++) {
    wallet = await generateNewAccount(wallet);
  }
  
  if (!wallet.accounts?.[index]?.stxPrivateKey) {
    throw new Error(`Account ${index} not found in wallet`);
  }
  
  const pk = wallet.accounts[index].stxPrivateKey;
  return typeof pk === 'string' ? pk.trim() : String(pk).trim();
}

// Register a username
async function register(privateKey: string, username: string, nonce: number): Promise<string> {
  const tx = await makeContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'register-username',
    functionArgs: [stringAsciiCV(username)],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 10000,
    nonce,
  });

  const result = await broadcastTransaction(tx, network);
  if (result.error) throw new Error(`${result.reason}`);
  return result.txid;
}

// Release a username
async function release(privateKey: string, username: string, nonce: number): Promise<string> {
  const tx = await makeContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'release-username',
    functionArgs: [stringAsciiCV(username)],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 10000,
    nonce,
  });

  const result = await broadcastTransaction(tx, network);
  if (result.error) throw new Error(`${result.reason}`);
  return result.txid;
}

async function main() {
  const args = process.argv.slice(2);
  const mnemonic = process.env.WALLET_MNEMONIC;

  if (args.length < 1 || !mnemonic) {
    console.log(`
🚀 BLAST MODE - Fast Register+Release pairs

Usage: npm run blast -- <pairs>

Environment Variables (in .env):
  WALLET_MNEMONIC    Your seed phrase
  START_NONCE        Starting nonce (required)
  ACCOUNT_INDEX      Account index (default: 0)

Example:
  ACCOUNT_INDEX=0 START_NONCE=123 npm run blast -- 20
`);
    process.exit(1);
  }

  const pairs = parseInt(args[0], 10);
  const startNonce = parseInt(process.env.START_NONCE || '0', 10);
  const accountIndex = parseInt(process.env.ACCOUNT_INDEX || '0', 10);

  console.log(`🔐 Getting Account ${accountIndex}...`);
  const privateKey = await getAccount(mnemonic, accountIndex);
  console.log('✅ Ready\n');

  console.log('💥 BLAST MODE - Register+Release Pairs');
  console.log(`📊 Account: ${accountIndex}`);
  console.log(`📊 Pairs: ${pairs} (= ${pairs * 2} transactions)`);
  console.log(`📊 Starting nonce: ${startNonce}`);
  console.log(`📊 Strategy: Send register+release back-to-back, no waiting`);
  console.log('');

  let nonce = startNonce;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < pairs; i++) {
    const username = generateUsername();
    console.log(`\n[Pair ${i + 1}/${pairs}] Username: "${username}"`);

    // Register
    try {
      const regTx = await register(privateKey, username, nonce);
      console.log(`  📝 Register (nonce ${nonce}): ${regTx.slice(0, 16)}...`);
      success++;
      nonce++;
    } catch (e: any) {
      console.log(`  ❌ Register failed: ${e.message}`);
      failed++;
      if (e.message.includes('BadNonce') || e.message.includes('ConflictingNonce')) {
        nonce++;
      }
      continue; // Skip release if register failed
    }

    // Release immediately (no wait!)
    try {
      const relTx = await release(privateKey, username, nonce);
      console.log(`  🗑️  Release (nonce ${nonce}): ${relTx.slice(0, 16)}...`);
      success++;
      nonce++;
    } catch (e: any) {
      console.log(`  ❌ Release failed: ${e.message}`);
      failed++;
      if (e.message.includes('BadNonce') || e.message.includes('ConflictingNonce')) {
        nonce++;
      }
    }

    // Tiny delay just to not overwhelm the API (500ms)
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 Done!`);
  console.log(`✅ Successful broadcasts: ${success}`);
  console.log(`❌ Failed broadcasts: ${failed}`);
  console.log(`📊 Final nonce: ${nonce}`);
  console.log(`${'='.repeat(50)}`);
}

main().catch(console.error);





