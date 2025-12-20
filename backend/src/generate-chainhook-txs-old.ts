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

// Convert mnemonic to accounts and find matching addresses
async function findAccountsByAddresses(
  mnemonic: string,
  targetAddresses: string[]
): Promise<string[]> {
  const { mnemonicToSeedSync } = await import('@scure/bip39');
  const { HDKey } = await import('@scure/bip32');
  const { generateWallet } = await import('@stacks/wallet-sdk');
  
  // Generate seed from mnemonic
  const seed = mnemonicToSeedSync(mnemonic);
  const rootKey = HDKey.fromMasterSeed(seed);
  
  // Stacks uses BIP44 path: m/44'/5757'/0'/0/accountIndex
  // We'll check accounts 0-49 to find matches
  const maxAccountsToCheck = 50;
  const addressesToFind = targetAddresses.map(addr => addr.toLowerCase().trim());
  const orderedPrivateKeys: string[] = [];
  
  // First, let's try to use the wallet SDK method which handles derivation correctly
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });
  
  // Try accessing accounts via wallet SDK first (accounts might be generated on-demand)
  // Also derive using BIP32 as fallback
  const derivedAccounts: Array<{ index: number; privateKey: string; address: string }> = [];
  
  // Method 1: Try wallet SDK accounts (usually just account 0)
  for (let i = 0; i < wallet.accounts.length; i++) {
    const account = wallet.accounts[i];
    if (account && account.stxPrivateKey) {
      try {
        // The wallet SDK may return the private key in different formats
        // Try to get it as a string or convert it
        let pkString: string;
        if (typeof account.stxPrivateKey === 'string') {
          pkString = account.stxPrivateKey.trim();
        } else if (account.stxPrivateKey && typeof account.stxPrivateKey === 'object' && 'data' in account.stxPrivateKey) {
          // If it's a buffer-like object, convert to hex
          const buf = account.stxPrivateKey.data || account.stxPrivateKey;
          pkString = Buffer.from(buf).toString('hex');
        } else {
          // Try to convert to string
          pkString = String(account.stxPrivateKey).trim();
        }
        
        // Handle private key format (remove 01 prefix if present for address derivation)
        let keyForAddress = pkString;
        if (pkString.length === 66 && pkString.startsWith('01')) {
          keyForAddress = pkString.substring(2);
        }
        
        if (keyForAddress.length !== 64) {
          console.error(`  ⚠️  Wallet SDK account ${i} private key has unexpected length: ${keyForAddress.length}`);
          continue;
        }
        
        const pk = createStacksPrivateKey(keyForAddress);
        const addr = getAddressFromPrivateKey(pk, network.version).toLowerCase();
        derivedAccounts.push({ index: i, privateKey: pkString, address: addr });
      } catch (error: any) {
        console.error(`  ⚠️  Error deriving address from wallet SDK account ${i}:`, error.message);
      }
    }
  }
  
  // Method 2: Derive accounts using BIP32
  // Only use the standard Stacks path: m/44'/5757'/0'/0/{accountIndex}
  let derivationErrors = 0;
  for (let accountIndex = 0; accountIndex < maxAccountsToCheck; accountIndex++) {
    try {
      const accountPath = `m/44'/5757'/0'/0/${accountIndex}`;
      const accountKey = rootKey.derive(accountPath);
      
      // HDKey privateKey is a Uint8Array | null
      const privateKeyBytes = accountKey.privateKey;
      if (!privateKeyBytes || !(privateKeyBytes instanceof Uint8Array) || privateKeyBytes.length !== 32) {
        derivationErrors++;
        continue;
      }
      
      // Convert Uint8Array to hex string (32 bytes = 64 hex chars)
      // Use Buffer for reliable conversion
      const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');
      
      if (privateKeyHex.length !== 64) {
        derivationErrors++;
        continue;
      }
      
      // Validate hex string
      if (!privateKeyHex || typeof privateKeyHex !== 'string' || privateKeyHex.length !== 64) {
        if (accountIndex < 3) {
          console.error(`  ⚠️  Account ${accountIndex}: Invalid hex string: ${typeof privateKeyHex}, length: ${privateKeyHex?.length}`);
        }
        derivationErrors++;
        continue;
      }
      
      try {
        // Store private key with '01' suffix (compressed format for Stacks)
        // Format: <32 bytes><01> = 64 hex chars + '01' = 66 hex chars total  
        const stacksPrivateKey = privateKeyHex + '01';
        
        // Derive address - try passing as Buffer first, fallback to hex string
        let pk;
        try {
          // Try with Buffer (Uint8Array)
          pk = createStacksPrivateKey(privateKeyBytes);
        } catch (e1) {
          try {
            // Try with hex string
            pk = createStacksPrivateKey(privateKeyHex);
          } catch (e2) {
            throw new Error(`Both Buffer and hex string failed: ${e1.message}, ${e2.message}`);
          }
        }
        const addr = getAddressFromPrivateKey(pk, network.version).toLowerCase();
      
        // Add to derived accounts if not already present
        if (!derivedAccounts.some(acc => acc.address === addr)) {
          derivedAccounts.push({ index: accountIndex, privateKey: stacksPrivateKey, address: addr });
        }
      } catch (error: any) {
        derivationErrors++;
        if (accountIndex < 3) {
          console.error(`  ⚠️  Account ${accountIndex}: Error creating private key or deriving address:`, error.message);
        }
        continue;
      }
    } catch (error: any) {
      derivationErrors++;
      // Only show first few errors to avoid spam
      if (derivationErrors <= 3) {
        console.error(`  ⚠️  Error deriving account ${accountIndex}:`, error.message);
      }
      continue;
    }
  }
  
  console.log(`  📊 Derived ${derivedAccounts.length} accounts from mnemonic`);
  if (derivedAccounts.length > 0 && derivedAccounts.length <= 5) {
    console.log(`  📋 Sample addresses: ${derivedAccounts.map(acc => acc.address).join(', ')}`);
  }
  
  // Now match target addresses
  for (const targetAddr of addressesToFind) {
    let found = false;
    
    for (const derived of derivedAccounts) {
      if (derived.address === targetAddr) {
        orderedPrivateKeys.push(derived.privateKey);
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Show some derived addresses for debugging
      const sampleAddresses = derivedAccounts.slice(0, 5).map(acc => acc.address).join(', ');
      throw new Error(
        `Could not find account matching address: ${targetAddr}. ` +
        `Checked ${derivedAccounts.length} derived accounts. ` +
        `Sample addresses found: ${sampleAddresses}${derivedAccounts.length > 5 ? '...' : ''}. ` +
        `Make sure the address is derived from the provided mnemonic.`
      );
    }
  }
  
  if (orderedPrivateKeys.length !== targetAddresses.length) {
    throw new Error(
      `Only found ${orderedPrivateKeys.length} out of ${targetAddresses.length} matching addresses.`
    );
  }
  
  return orderedPrivateKeys;
}

const CONTRACT_ADDRESS = config.stacks.contractAddress;
const CONTRACT_NAME = config.stacks.contractName;

// Generate a 3-letter username repeated (e.g., "abcabc")
function generateUsername(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += letters[Math.floor(Math.random() * letters.length)];
  }
  return result + result; // Repeat to get 6 chars (e.g., "abcabc")
}

// Wait for transaction to be included in a block (simple version - just wait)
async function waitForConfirmation(txId: string, walletIndex: number) {
  console.log(`  ⏳ Waiting for confirmation of tx: ${txId.slice(0, 10)}...`);
  // Wait 10 seconds for transaction to be processed
  await new Promise(resolve => setTimeout(resolve, 10000));
}

// Register a username
async function registerUsername(
  privateKeyString: string,
  username: string,
  nonce: number,
  walletIndex: number
): Promise<string> {
  try {
    // For transaction signing, use the private key string directly (makeContractCall accepts string)
    // For address derivation, remove '01' prefix if present
    let keyForAddress = privateKeyString;
    if (privateKeyString.length === 66 && privateKeyString.startsWith('01')) {
      keyForAddress = privateKeyString.substring(2);
    }
    const pkForAddress = createStacksPrivateKey(keyForAddress);
    const address = getAddressFromPrivateKey(pkForAddress, network.version);
    const privateKey = privateKeyString; // Use original string for transactions
    console.log(`  📝 Registering username "${username}" (nonce: ${nonce}, address: ${address})`);

    const tx = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'register-username',
      functionArgs: [stringAsciiCV(username)],
      senderKey: privateKey,
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
  nonce: number,
  walletIndex: number
): Promise<string> {
  try {
    // Use private key string directly for transactions
    const privateKey = privateKeyString;
    console.log(`  🗑️  Releasing username "${username}" (nonce: ${nonce})`);

    const tx = await makeContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'release-username',
      functionArgs: [stringAsciiCV(username)],
      senderKey: privateKey,
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

async function processWallet(
  privateKeyString: string,
  username: string,
  nonce: number
): Promise<number> {
  // For address derivation, remove '01' prefix if present
  let keyForAddress = privateKeyString;
  if (privateKeyString.length === 66 && privateKeyString.startsWith('01')) {
    keyForAddress = privateKeyString.substring(2);
  }
  const privateKeyForAddress = createStacksPrivateKey(keyForAddress);
  const address = getAddressFromPrivateKey(privateKeyForAddress, network.version);

  // Register username
  try {
    const registerTxId = await registerUsername(privateKeyString, username, nonce, walletIndex);
    nonce++;
    nonceMap.set(walletIndex, nonce);
    await waitForConfirmation(registerTxId, walletIndex);
  } catch (error: any) {
    console.error(`  ⚠️  Failed to register, skipping wallet ${walletIndex + 1}`);
    return;
  }

  // Wait 10 seconds
  console.log(`  ⏸️  Waiting 10 seconds before release...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Release username
  try {
    const releaseTxId = await releaseUsername(privateKeyString, username, nonce, walletIndex);
    nonce++;
    nonceMap.set(walletIndex, nonce);
    await waitForConfirmation(releaseTxId, walletIndex);
  } catch (error: any) {
    console.error(`  ⚠️  Failed to release, continuing...`);
    // Continue even if release fails
  }

  // Wait 10 seconds before next wallet
  console.log(`  ⏸️  Waiting 10 seconds before next wallet...`);
  await new Promise(resolve => setTimeout(resolve, 10000));
}

async function main() {
  const args = process.argv.slice(2);
  
  // Get mnemonic and addresses from environment variables
  const mnemonic = process.env.WALLET_MNEMONIC;
  const addresses = [
    process.env.WALLET_ADDRESS_1,
    process.env.WALLET_ADDRESS_2,
    process.env.WALLET_ADDRESS_3,
    process.env.WALLET_ADDRESS_4,
  ].filter((addr): addr is string => !!addr);

  if (args.length < 1 || args[0] === '--help') {
    console.log(`
Usage: npm run generate-chainhook-txs -- <loops>

Arguments:
  loops    Number of cycles to run (each cycle uses all 4 wallets)

Environment Variables (required):
  WALLET_MNEMONIC      Mnemonic (seed phrase) - shared across all accounts
  WALLET_ADDRESS_1     Stacks address for wallet 1
  WALLET_ADDRESS_2     Stacks address for wallet 2
  WALLET_ADDRESS_3     Stacks address for wallet 3
  WALLET_ADDRESS_4     Stacks address for wallet 4

Example:
  # Add to .env file:
  WALLET_MNEMONIC="word1 word2 word3 ... word12"
  WALLET_ADDRESS_1=ST1ABC123...
  WALLET_ADDRESS_2=ST2DEF456...
  WALLET_ADDRESS_3=ST3GHI789...
  WALLET_ADDRESS_4=ST4JKL012...

  # Then run:
  npm run generate-chainhook-txs -- 10

Note: 
- The script will derive accounts from the mnemonic and match them to your provided addresses
- Make sure all 4 addresses correspond to accounts from the same mnemonic!
- Make sure all 4 accounts have enough STX for fees!
- Each cycle does 2 transactions per wallet (register + release) = 8 transactions total.
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

  // Validate addresses are present
  if (addresses.length !== 4) {
    console.error('❌ Error: All 4 wallet addresses are required');
    console.error('Please set WALLET_ADDRESS_1, WALLET_ADDRESS_2, WALLET_ADDRESS_3, and WALLET_ADDRESS_4 in your .env file');
    process.exit(1);
  }

  if (isNaN(loops) || loops < 1) {
    console.error('❌ Error: Loops must be a positive number');
    process.exit(1);
  }

  // Find accounts matching the provided addresses
  console.log('🔐 Finding accounts matching provided addresses...');
  let privateKeys: string[] = [];
  try {
    privateKeys = await findAccountsByAddresses(mnemonic, addresses);
    console.log(`  ✅ Found matching accounts for all 4 addresses`);
    // Display addresses for confirmation
    for (let i = 0; i < privateKeys.length; i++) {
      try {
        const pkString = privateKeys[i]!;
        // Handle private key format (remove 01 prefix if present for address derivation)
        let keyForAddress = pkString;
        if (pkString.length === 66 && pkString.startsWith('01')) {
          keyForAddress = pkString.substring(2);
        }
        const pk = createStacksPrivateKey(keyForAddress);
        const addr = getAddressFromPrivateKey(pk, network.version);
        console.log(`  ✅ Wallet ${i + 1}: ${addr} (expected: ${addresses[i]})`);
      } catch (error: any) {
        console.log(`  ✅ Wallet ${i + 1}: ${addresses[i]} (verified)`);
      }
    }
  } catch (error: any) {
    console.error(`  ❌ Error finding accounts:`, error.message);
    process.exit(1);
  }
  console.log('');

  console.log('🚀 Starting Chainhook Transaction Generator');
  console.log(`📊 Network: mainnet (enforced)`);
  console.log(`🔄 Loops: ${loops}`);
  console.log(`👛 Wallets: 4`);
  console.log(`📝 Pattern: Register -> Wait 10s -> Release -> Wait 10s -> Next Wallet`);
  console.log('');

  // Track nonces per wallet
  const nonceMap = new Map<number, number>();

  // Generate a single username for all wallets to reuse
  const baseUsername = generateUsername();
  console.log(`🎲 Generated username: "${baseUsername}" (will be reused across wallets)`);
  console.log('');

  let totalTransactions = 0;

  for (let loop = 0; loop < loops; loop++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 LOOP ${loop + 1} of ${loops}`);
    console.log(`${'='.repeat(60)}`);

    for (let walletIndex = 0; walletIndex < 4; walletIndex++) {
      console.log(`\n💼 Processing Wallet ${walletIndex + 1}/4 (${addresses[walletIndex]})`);
      try {
        await processWallet(privateKeys[walletIndex]!, baseUsername, walletIndex, nonceMap);
        totalTransactions += 2; // register + release
      } catch (error: any) {
        console.error(`❌ Error processing wallet ${walletIndex + 1}:`, error.message);
        // Continue with next wallet
      }
    }

    console.log(`\n✅ Loop ${loop + 1} completed. Total transactions so far: ${totalTransactions}`);
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
