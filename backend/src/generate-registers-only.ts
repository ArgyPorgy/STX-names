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

// Random delay between 10-20 seconds
function getRandomDelay(): number {
  return Math.floor(Math.random() * 11) + 10; // 10-20 seconds
}

// Get account from mnemonic by index
async function getAccount(mnemonic: string, index: number): Promise<string> {
  const { generateWallet, generateNewAccount } = await import('@stacks/wallet-sdk');
  
  let wallet = await generateWallet({ secretKey: mnemonic, password: '' });
  
  // Generate accounts up to the requested index
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
async function registerUsername(privateKey: string, username: string, nonce: number): Promise<string> {
  const tx = await makeContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'register-username',
    functionArgs: [stringAsciiCV(username)],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 10000, // 0.01 STX
    nonce,
  });

  const result = await broadcastTransaction(tx, network);
  
  if (result.error) {
    throw new Error(`Transaction rejected: ${result.error} - Reason: ${result.reason}`);
  }
  
  return result.txid;
}

async function main() {
  const args = process.argv.slice(2);
  const mnemonic = process.env.WALLET_MNEMONIC;

  if (args.length < 1 || !mnemonic) {
    console.log(`
Usage: npm run generate-registers -- <count>

Environment Variables (in .env):
  WALLET_MNEMONIC    Your 12/24 word seed phrase
  START_NONCE        Starting nonce (required)
  ACCOUNT_INDEX      Account index to use (default: 0)
                     0 = SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R
                     1 = SP81HXFQEGAV4KFYYMHPAN6FK42TBE1ZFFK6A0F9

Example:
  ACCOUNT_INDEX=1 START_NONCE=0 npm run generate-registers -- 20
`);
    process.exit(1);
  }

  const count = parseInt(args[0], 10);
  const startNonce = parseInt(process.env.START_NONCE || '0', 10);
  const accountIndex = parseInt(process.env.ACCOUNT_INDEX || '0', 10);

  console.log(`🔐 Getting private key from mnemonic (Account ${accountIndex})...`);
  const privateKey = await getAccount(mnemonic, accountIndex);
  console.log('✅ Ready\n');

  console.log('🚀 Register-Only Transaction Generator');
  console.log(`📊 Account: ${accountIndex} (set ACCOUNT_INDEX to change)`);
  console.log(`📊 Count: ${count} transactions`);
  console.log(`📊 Starting nonce: ${startNonce}`);
  console.log(`📊 Delay: 10-20 seconds (random) between each\n`);

  let nonce = startNonce;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const username = generateUsername();
    console.log(`[${i + 1}/${count}] Registering "${username}" (nonce: ${nonce})...`);

    try {
      const txid = await registerUsername(privateKey, username, nonce);
      console.log(`  ✅ Tx: ${txid.slice(0, 16)}...`);
      success++;
      nonce++;
    } catch (error: any) {
      console.log(`  ❌ ${error.message}`);
      failed++;
      
      // On BadNonce, increment and retry
      if (error.message.includes('BadNonce')) {
        nonce++;
      }
      // On ConflictingNonceInMempool, skip to next nonce
      if (error.message.includes('ConflictingNonceInMempool')) {
        nonce++;
      }
    }

    // Random delay between transactions (except for last one)
    if (i < count - 1) {
      const delay = getRandomDelay();
      console.log(`  ⏳ Waiting ${delay}s...\n`);
      await new Promise(r => setTimeout(r, delay * 1000));
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 Done!`);
  console.log(`✅ Successful: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Final nonce: ${nonce}`);
  console.log(`${'='.repeat(50)}`);
}

main().catch(console.error);

