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

// Get account private key and address from mnemonic by index
async function getAccount(mnemonic: string, index: number = 0): Promise<{ privateKey: string; address: string }> {
  const { generateWallet, generateNewAccount } = await import('@stacks/wallet-sdk');
  
  // Use wallet SDK to get account
  let wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });
  
  // Generate accounts up to the requested index
  for (let i = 1; i <= index; i++) {
    wallet = await generateNewAccount(wallet);
  }
  
  if (!wallet.accounts || wallet.accounts.length === 0) {
    throw new Error('No accounts found in wallet. Make sure the mnemonic is valid.');
  }
  
  const account = wallet.accounts[index];
  if (!account || !account.stxPrivateKey) {
    throw new Error(`Account ${index} does not have a private key.`);
  }
  
  // Get private key
  const stxPrivateKey = account.stxPrivateKey;
  const privateKey = typeof stxPrivateKey === 'string' 
    ? stxPrivateKey.trim() 
    : String(stxPrivateKey).trim();
  
  // Check all possible address properties on the account object
  let address = (account as any).address || 
                (account as any).stxAddress || 
                (account as any).stacksAddress;
  
  // If we don't have address from account object, derive it from private key
  if (!address || (!address.startsWith('ST') && !address.startsWith('SP'))) {
    try {
      // The private key from wallet SDK is 66 chars with '01' prefix
      // For address derivation, we need just the 64 hex chars (32 bytes)
      let keyForAddress = privateKey;
      if (privateKey.length === 66 && privateKey.startsWith('01')) {
        keyForAddress = privateKey.substring(2);
      }
      
      // Ensure it's exactly 64 hex chars
      if (keyForAddress.length !== 64) {
        throw new Error(`Private key must be 64 hex characters, got ${keyForAddress.length}`);
      }
      
      // Validate hex format
      if (!/^[0-9a-fA-F]{64}$/.test(keyForAddress)) {
        throw new Error(`Invalid hex format for private key`);
      }
      
      // Try creating private key as Buffer first (32 bytes)
      let pk;
      try {
        const keyBuffer = Buffer.from(keyForAddress, 'hex');
        pk = createStacksPrivateKey(keyBuffer);
      } catch (e1) {
        // Fallback to hex string
        pk = createStacksPrivateKey(keyForAddress);
      }
      
      address = getAddressFromPrivateKey(pk, network.version);
    } catch (error: any) {
      // If derivation fails, we'll get address from first transaction
      console.warn(`  ⚠️  Could not derive address from private key: ${error.message}`);
      address = 'pending';
    }
  }
  
  return { privateKey, address };
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
    
    // If address is hex format (like from signer), try to query by hash
    // Otherwise assume it's ST/SP format
    let queryAddress = address;
    if (!address.startsWith('ST') && !address.startsWith('SP')) {
      // Try querying with the hash format, or convert if possible
      // For now, return 0 and let user know
      console.warn(`  ⚠️  Address "${address}" is not in ST/SP format, cannot query nonce`);
      return 0;
    }
    
    const response = await fetch(`${apiUrl}/v2/accounts/${queryAddress}?proof=0`);
    if (!response.ok) {
      if (response.status === 404) {
        // Account doesn't exist yet, nonce should be 0
        return 0;
      }
      throw new Error(`API returned ${response.status}`);
    }
    const data = await response.json();
    return data.nonce || 0;
  } catch (error: any) {
    console.error(`  ⚠️  Error getting nonce for ${address}:`, error.message);
    return 0;
  }
}

// Get random delay between 10-20 seconds
function getRandomDelay(): number {
  return Math.floor(Math.random() * 11000) + 10000; // 10000-20999ms (10-20.999 seconds)
}

// Wait for transaction to be included in a block and check if it succeeded
async function waitForConfirmation(txId: string): Promise<boolean> {
  console.log(`  ⏳ Waiting for confirmation of tx: ${txId.slice(0, 10)}...`);
  // Wait random time between 10-20 seconds for transaction to be processed
  const delay = getRandomDelay();
  const delaySeconds = (delay / 1000).toFixed(1);
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Check transaction status
  try {
    const apiUrl = 'https://api.mainnet.hiro.so';
    const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);
    if (response.ok) {
      const data = await response.json();
      const status = data.tx_status;
      if (status === 'success') {
        console.log(`  ✅ Transaction confirmed successfully`);
        return true;
      } else if (status === 'pending') {
        console.log(`  ⏳ Transaction still pending...`);
        return true; // Assume it will succeed
      } else {
        console.error(`  ❌ Transaction failed with status: ${status}`);
        if (data.tx_result?.repr) {
          console.error(`  ❌ Error: ${data.tx_result.repr}`);
        }
        return false;
      }
    }
  } catch (error: any) {
    console.warn(`  ⚠️  Could not check transaction status: ${error.message}`);
    // Assume success if we can't check
    return true;
  }
  
  return true;
}

// Register a username
async function registerUsername(
  privateKeyString: string,
  username: string,
  nonce: number
): Promise<{ txid: string; senderAddress: string }> {
  try {
    console.log(`  📝 Registering username "${username}" (nonce: ${nonce})`);

    // Derive address from private key for nonce lookup
    // The private key from wallet SDK is 66 chars with '01' prefix
    // For address derivation, we need just the 64 hex chars
    let keyForAddress = privateKeyString;
    if (privateKeyString.length === 66 && privateKeyString.startsWith('01')) {
      keyForAddress = privateKeyString.substring(2);
    }
    
    // Derive Stacks address from private key
    let senderAddress: string;
    try {
      const pk = createStacksPrivateKey(keyForAddress);
      senderAddress = getAddressFromPrivateKey(pk, network.version);
    } catch (error: any) {
      // Fallback: extract from transaction
      console.warn(`  ⚠️  Could not derive address from private key: ${error.message}`);
      senderAddress = 'unknown';
    }

    const tx = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'register-username',
      functionArgs: [stringAsciiCV(username)],
      senderKey: privateKeyString,
      network,
      anchorMode: AnchorMode.Any,
      fee: 10000, // 0.01 STX (10,000 microSTX)
      nonce,
    });

    // If we couldn't derive address from key, try to get it from transaction
    if (senderAddress === 'unknown') {
      // Try multiple ways to get the address from transaction
      const signer = tx.auth?.spendingCondition?.signer;
      if (signer) {
        if (typeof signer === 'string') {
          senderAddress = signer;
        } else if (signer && typeof (signer as any).address === 'string') {
          // If signer is an object with address property
          senderAddress = (signer as any).address;
        } else if (typeof (signer as any).toString === 'function') {
          senderAddress = (signer as any).toString();
        } else {
          senderAddress = String(signer);
        }
      }
      
      // Also try getting from tx.senderAddress if available
      if ((senderAddress === 'unknown' || (!senderAddress.startsWith('ST') && !senderAddress.startsWith('SP'))) && (tx as any).senderAddress) {
        const txAddr = (tx as any).senderAddress;
        if (typeof txAddr === 'string' && (txAddr.startsWith('ST') || txAddr.startsWith('SP'))) {
          senderAddress = txAddr;
        }
      }
    }

    const result = await broadcastTransaction(tx, network);
    
    if ('error' in result && result.error) {
      // Include full error details
      const errorMsg = typeof result.error === 'string' 
        ? result.error 
        : JSON.stringify(result.error);
      const reason = (result as any).reason 
        ? ` - Reason: ${(result as any).reason}` 
        : '';
      
      // Attach sender address to error
      const err = new Error(`Transaction rejected: ${errorMsg}${reason}`) as any;
      err.senderAddress = senderAddress;
      throw err;
    }

    console.log(`  ✅ Registered "${username}" - Tx: ${result.txid} (from: ${senderAddress})`);
    return { txid: result.txid, senderAddress };
  } catch (error: any) {
    // Extract address from transaction even on error
    try {
      const tx = await makeContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'register-username',
        functionArgs: [stringAsciiCV(username)],
        senderKey: privateKeyString,
        network,
        anchorMode: AnchorMode.Any,
        fee: 10000, // 0.01 STX (10,000 microSTX)
        nonce,
      });
      const senderAddress = tx.auth?.spendingCondition?.signer;
      if (senderAddress) {
        // Re-throw with address info
        (error as any).senderAddress = senderAddress;
      }
    } catch {
      // Ignore errors when extracting address
    }
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
      fee: 10000, // 0.01 STX (10,000 microSTX)
      nonce,
    });

    const result = await broadcastTransaction(tx, network);
    
    if ('error' in result && result.error) {
      // Log full result for debugging
      console.error(`  ⚠️  Full broadcast result:`, JSON.stringify(result, null, 2));
      
      // Include error and reason if available
      const errorMsg = typeof result.error === 'string' 
        ? result.error 
        : JSON.stringify(result.error);
      const reason = (result as any).reason 
        ? ` - ${(result as any).reason}` 
        : '';
      throw new Error(`Transaction rejected: ${errorMsg}${reason}`);
    }

    console.log(`  ✅ Released "${username}" - Tx: ${result.txid}`);
    return result.txid;
  } catch (error: any) {
    console.error(`  ❌ Error releasing username:`, error.message);
    throw error;
  }
}

// Release any existing username first (to clear ERR_ALREADY_HAS_USERNAME)
async function releaseExistingUsername(
  privateKeyString: string,
  nonce: number
): Promise<{ nonce: number; address: string }> {
  // We need to find what username the wallet has - but we can't query without address
  // So we'll just try to release a dummy name and see if it fails
  // Actually, we need to know the username to release it
  // For now, let's skip this and just proceed
  return { nonce, address: 'unknown' };
}

// Process one iteration: register -> wait -> release -> wait
async function processIteration(
  privateKeyString: string,
  username: string,
  nonce: number
): Promise<{ nonce: number; address: string }> {
  // Register username
  const registerResult = await registerUsername(privateKeyString, username, nonce);
  nonce++;
  const registerSuccess = await waitForConfirmation(registerResult.txid);
  
  const address = registerResult.senderAddress;
  
  if (!registerSuccess) {
    console.log(`  ⚠️  Register failed, skipping release`);
    return { nonce, address };
  }

  // Wait random time between 10-20 seconds
  const delay1 = getRandomDelay();
  const delay1Seconds = (delay1 / 1000).toFixed(1);
  console.log(`  ⏸️  Waiting ${delay1Seconds} seconds before release...`);
  await new Promise(resolve => setTimeout(resolve, delay1));

  // Release username
  const releaseTxId = await releaseUsername(privateKeyString, username, nonce);
  nonce++;
  await waitForConfirmation(releaseTxId);

  // Wait random time between 10-20 seconds before next iteration
  const delay2 = getRandomDelay();
  const delay2Seconds = (delay2 / 1000).toFixed(1);
  console.log(`  ⏸️  Waiting ${delay2Seconds} seconds before next iteration...`);
  await new Promise(resolve => setTimeout(resolve, delay2));
  
  return { nonce, address };
}

async function main() {
  const args = process.argv.slice(2);
  
  // Get mnemonic from environment variable
  const mnemonic = process.env.WALLET_MNEMONIC;

  if (args.length < 1 || args[0] === '--help') {
    console.log(`
Usage: npm run generate-chainhook-txs -- <loops>

Arguments:
  loops    Number of cycles to run (each cycle: register -> wait 10-20s -> release -> wait 10-20s)

Environment Variables (required):
  WALLET_MNEMONIC      Mnemonic (seed phrase)

Environment Variables (optional):
  ACCOUNT_INDEX        Account index to use (default: 0)
                       0 = SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R
                       1 = SP81HXFQEGAV4KFYYMHPAN6FK42TBE1ZFFK6A0F9
  START_NONCE          Starting nonce for transactions (default: 0)
                       If you get BadNonce errors, set this to your account's current nonce
                       You can find your nonce at: https://explorer.stacks.co (search your address)

Example:
  # Add to .env file:
  WALLET_MNEMONIC="word1 word2 word3 ... word12"
  ACCOUNT_INDEX=1  # Use account 1 instead of 0
  START_NONCE=5    # Optional: if your account has been used before

  # Then run:
  npm run generate-chainhook-txs -- 10

Note: 
- The script will use account 0 from your mnemonic (standard BIP44 derivation via Leather wallet)
- Make sure the account has enough STX for fees!
- Each loop does 2 transactions (register + release)
- 10 loops = 20 transactions total
- If you get "BadNonce" errors, set START_NONCE to your account's current nonce
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

  // Get account private key and address from mnemonic
  const accountIndex = parseInt(process.env.ACCOUNT_INDEX || '0', 10);
  console.log(`🔐 Getting account ${accountIndex} from mnemonic...`);
  let privateKey: string;
  let walletAddress: string;
  try {
    const account = await getAccount(mnemonic, accountIndex);
    privateKey = account.privateKey;
    walletAddress = account.address;
    console.log(`  ✅ Account ${accountIndex} ready: ${walletAddress}`);
  } catch (error: any) {
    console.error(`  ❌ Error getting account ${accountIndex}:`, error.message);
    process.exit(1);
  }
  console.log('');

  console.log('🚀 Starting Chainhook Transaction Generator');
  console.log(`📊 Network: mainnet (enforced)`);
  if (walletAddress !== 'pending') {
    console.log(`👛 Wallet: ${walletAddress}`);
  } else {
    console.log(`👛 Wallet: Address will be determined from first transaction`);
  }
  console.log(`🔄 Loops: ${loops}`);
  console.log(`📝 Pattern: Register -> Wait 10-20s (random) -> Release -> Wait 10-20s (random) -> Repeat`);
  console.log('');

  // Get initial nonce
  // Allow user to provide starting nonce via environment variable
  const startNonceEnv = process.env.START_NONCE;
  let nonce = 0;
  
  if (startNonceEnv && !isNaN(parseInt(startNonceEnv))) {
    nonce = parseInt(startNonceEnv);
    console.log(`📊 Starting nonce: ${nonce} (from START_NONCE env var)`);
  } else if (walletAddress !== 'pending') {
    nonce = await getNonce(walletAddress);
    console.log(`📊 Starting nonce: ${nonce} (from API)`);
  } else {
    console.log(`📊 Starting nonce: 0 (set START_NONCE env var to specify starting nonce)`);
    console.log(`   Example: START_NONCE=5 npm run generate-chainhook-txs -- 10`);
  }
  console.log('');

  // Generate a new username for each loop to avoid conflicts
  // (even if release works, there's a delay before it's available again)
  console.log(`🎲 Username will be generated fresh for each loop`);
  console.log('');

  let totalTransactions = 0;

  for (let loop = 0; loop < loops; loop++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 LOOP ${loop + 1} of ${loops}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Generate a fresh username for each loop to avoid conflicts
      const username = generateUsername();
      console.log(`🎲 Generated username for this loop: "${username}"`);
      
      const result = await processIteration(privateKey, username, nonce);
      nonce = result.nonce;
      
      // Update wallet address if we got it from first transaction
      if (result.address && walletAddress === 'pending') {
        walletAddress = result.address;
        console.log(`  📍 Wallet address determined: ${walletAddress}`);
        // Don't override nonce with API call - we already have the correct nonce from the successful transactions
        // The nonce is already incremented correctly in processIteration
      }
      
      totalTransactions += 2; // register + release
      console.log(`\n✅ Loop ${loop + 1} completed. Total transactions: ${totalTransactions}`);
    } catch (error: any) {
      // Try to extract address from error for first loop
      if (loop === 0 && walletAddress === 'pending' && (error as any).senderAddress) {
        let extractedAddr = (error as any).senderAddress;
        // Convert to string if it's an object
        if (typeof extractedAddr !== 'string') {
          extractedAddr = extractedAddr.toString();
        }
        walletAddress = extractedAddr;
        console.log(`  📍 Wallet address extracted: ${walletAddress}`);
        
        // Try to get nonce - getNonce will handle hex format gracefully
        const actualNonce = await getNonce(walletAddress);
        if (actualNonce > 0 || walletAddress.startsWith('ST') || walletAddress.startsWith('SP')) {
          nonce = actualNonce;
          console.log(`  📊 Updated nonce from API: ${nonce}`);
        } else {
          // Don't override START_NONCE - keep the current nonce value
          console.log(`  ⚠️  Could not fetch nonce from API. Continuing with current nonce: ${nonce}`);
        }
      } else if (error.message.includes('BadNonce')) {
        // If we get BadNonce, try incrementing nonce and retry
        const currentNonce = nonce;
        nonce = currentNonce + 1;
        console.log(`  ⚠️  BadNonce error with nonce ${currentNonce}, will try nonce ${nonce} in next loop`);
        
        // If this was the first loop and we still don't have address, continue to next loop to try new nonce
        if (loop === 0 && walletAddress === 'pending') {
          continue; // Skip to next loop with incremented nonce
        }
      }
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
