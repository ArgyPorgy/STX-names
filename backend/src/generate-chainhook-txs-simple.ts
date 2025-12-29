import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  stringAsciiCV,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
} from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';
import { config } from './config.js';
import 'dotenv/config';

// Enforce mainnet only
if (config.stacks.network !== 'mainnet') {
  console.error('❌ Error: This script only works on mainnet');
  console.error(`Current network configuration: ${config.stacks.network}`);
  console.error('Please set NETWORK=mainnet in your .env file');
  process.exit(1);
}

const network = new StacksMainnet();
const CONTRACT_ADDRESS = config.stacks.contractAddress;
const CONTRACT_NAME = config.stacks.contractName;

// Get account 0 private key from mnemonic
async function getAccount0PrivateKey(mnemonic: string): Promise<string> {
  const { generateWallet } = await import('@stacks/wallet-sdk');
  
  // Use wallet SDK to get account 0
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });
  
  if (!wallet.accounts || wallet.accounts.length === 0) {
    throw new Error('No accounts found in wallet. Make sure the mnemonic is valid.');
  }
  
  const account = wallet.accounts[0];
  if (!account || !account.stxPrivateKey) {
    throw new Error('Account 0 does not have a private key.');
  }
  
  // Return the private key as-is (wallet SDK should return it in the correct format)
  return typeof account.stxPrivateKey === 'string' 
    ? account.stxPrivateKey.trim() 
    : String(account.stxPrivateKey).trim();
}

// Generate a 3-letter username repeated (e.g., "abcabc")
function generateUsername(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += letters[Math.floor(Math.random() * letters.length)];
  }
  return result + result; // Repeat to get 6 chars (e.g., "abcabc")
}

// Get nonce for an address (mainnet only)
async function getNonce(address: string): Promise<number> {
  try {
    const apiUrl = 'https://api.mainnet.hiro.so';
    const response = await fetch(`${apiUrl}/v2/accounts/${address}?proof=0`);
    const data = await response.json();
    return data.nonce || 0;
  } catch (error: any) {
    console.error(`Error getting nonce for ${address}:`, error.message);
    return 0;
  }
}

// Wait for transaction to be included in a block (simple version - just wait)
async function waitForConfirmation(txId: string) {
  console.log(`  ⏳ Waiting for confirmation of tx: ${txId.slice(0, 10)}...`);
  // Wait 10 seconds for transaction to be processed
  await new Promise(resolve => setTimeout(resolve, 10000));
}

// Register a username
async function registerUsername(
  privateKeyString: string,
  username: string,
  nonce: number
): Promise<string> {
  try {
    console.log(`  📝 Registering username "${username}" (nonce: ${nonce})`);

    const tx = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'register-username',
      functionArgs: [stringAsciiCV(username)],
      senderKey: privateKeyString,
      network,
      anchorMode: AnchorMode.Any,
      fee: 5000,
      nonce,
    });

    const result = await broadcastTransaction(tx, network);
    
    if (result.error) {
      throw new Error(result.error);
    }

    console.log(`  ✅ Registered "${username}" - Tx: ${result.txid}`);
    return result.txid;
  } catch (error: any) {
    console.error(`  ❌ Error registering username:`, error.message);
    throw error;
  }
}

// Release a username
async function releaseUsername(
  privateKeyString: string,
  username: string,
  nonce: number
): Promise<string> {
  try {
    console.log(`  🗑️  Releasing username "${username}" (nonce: ${nonce})`);

    const tx = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'release-username',
      functionArgs: [stringAsciiCV(username)],
      senderKey: privateKeyString,
      network,
      anchorMode: AnchorMode.Any,
      fee: 5000,
      nonce,
    });

    const result = await broadcastTransaction(tx, network);
    
    if (result.error) {
      throw new Error(result.error);
    }

    console.log(`  ✅ Released "${username}" - Tx: ${result.txid}`);
    return result.txid;
  } catch (error: any) {
    console.error(`  ❌ Error releasing username:`, error.message);
    throw error;
  }
}

// Process one iteration: register -> wait -> release -> wait
async function processIteration(
  privateKeyString: string,
  username: string,
  nonce: number
): Promise<number> {
  // Register username
  const registerTxId = await registerUsername(privateKeyString, username, nonce);
  nonce++;
  await waitForConfirmation(registerTxId);

  // Wait 10 seconds
  console.log(`  ⏸️  Waiting 10 seconds before release...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Release username
  const releaseTxId = await releaseUsername(privateKeyString, username, nonce);
  nonce++;
  await waitForConfirmation(releaseTxId);

  // Wait 10 seconds before next iteration
  console.log(`  ⏸️  Waiting 10 seconds before next iteration...`);
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  return nonce;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Get mnemonic from environment variable
  const mnemonic = process.env.WALLET_MNEMONIC;

  if (args.length < 1 || args[0] === '--help') {
    console.log(`
Usage: npm run generate-chainhook-txs -- <loops>

Arguments:
  loops    Number of cycles to run (each cycle: register -> wait 10s -> release -> wait 10s)

Environment Variables (required):
  WALLET_MNEMONIC      Mnemonic (seed phrase) - will use account 0

Example:
  # Add to .env file:
  WALLET_MNEMONIC="word1 word2 word3 ... word12"

  # Then run:
  npm run generate-chainhook-txs -- 10

Note: 
- The script will use account 0 from your mnemonic (standard BIP44 derivation via Leather wallet)
- Make sure the account has enough STX for fees!
- Each loop does 2 transactions (register + release)
- 10 loops = 20 transactions total
    `);
    process.exit(0);
  }

  const loops = parseInt(args[0]);

  // Validate mnemonic is present
  if (!mnemonic) {
    console.error('❌ Error: WALLET_MNEMONIC environment variable is required');
    console.error('Please set WALLET_MNEMONIC in your .env file');
    process.exit(1);
  }

  if (isNaN(loops) || loops < 1) {
    console.error('❌ Error: Loops must be a positive number');
    process.exit(1);
  }

  // Get account 0 private key from mnemonic
  console.log('🔐 Getting account 0 from mnemonic...');
  let privateKey: string;
  let walletAddress: string;
  try {
    privateKey = await getAccount0PrivateKey(mnemonic);
    
    // Derive address for display
    let keyForAddress = privateKey;
    if (privateKey.length === 66 && privateKey.startsWith('01')) {
      keyForAddress = privateKey.substring(2);
    }
    const pk = createStacksPrivateKey(keyForAddress);
    walletAddress = getAddressFromPrivateKey(pk, network.version);
    
    console.log(`  ✅ Account 0 ready: ${walletAddress}`);
  } catch (error: any) {
    console.error(`  ❌ Error getting account 0:`, error.message);
    process.exit(1);
  }
  console.log('');

  console.log('🚀 Starting Chainhook Transaction Generator');
  console.log(`📊 Network: mainnet (enforced)`);
  console.log(`👛 Wallet: ${walletAddress}`);
  console.log(`🔄 Loops: ${loops}`);
  console.log(`📝 Pattern: Register -> Wait 10s -> Release -> Wait 10s -> Repeat`);
  console.log('');

  // Get initial nonce
  let nonce = await getNonce(walletAddress);
  console.log(`📊 Starting nonce: ${nonce}`);
  console.log('');

  // Generate a single username to reuse (release makes it available again)
  const baseUsername = generateUsername();
  console.log(`🎲 Generated username: "${baseUsername}" (will be reused)`);
  console.log('');

  let totalTransactions = 0;

  for (let loop = 0; loop < loops; loop++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 LOOP ${loop + 1} of ${loops}`);
    console.log(`${'='.repeat(60)}`);

    try {
      nonce = await processIteration(privateKey, baseUsername, nonce);
      totalTransactions += 2; // register + release
      console.log(`\n✅ Loop ${loop + 1} completed. Total transactions: ${totalTransactions}`);
    } catch (error: any) {
      console.error(`❌ Error in loop ${loop + 1}:`, error.message);
      // Continue with next loop
      continue;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 All done!`);
  console.log(`📊 Total transactions: ${totalTransactions}`);
  console.log(`📊 Expected chainhook triggers: ${totalTransactions} (each tx triggers a chainhook)`);
  console.log(`📊 Final nonce: ${nonce}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});





