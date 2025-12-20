import 'dotenv/config';
import { config } from './config.js';
import { createStacksPrivateKey, getAddressFromPrivateKey } from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';

const network = new StacksMainnet();

// Get account 0 private key and address from mnemonic
async function getAccount0(mnemonic: string): Promise<{ privateKey: string; address: string }> {
  const { generateWallet } = await import('@stacks/wallet-sdk');
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

  const privateKey = typeof account.stxPrivateKey === 'string'
    ? account.stxPrivateKey.trim()
    : String(account.stxPrivateKey).trim();

  // Derive address from the private key
  let address: string;
  
  // First, check if account object has address property
  const accountAny = account as any;
  if (accountAny.address && (accountAny.address.startsWith('ST') || accountAny.address.startsWith('SP'))) {
    address = accountAny.address;
  } else {
    // Try to derive from private key using the same method as generate-chainhook-txs
    try {
      // Use the same approach as generate-chainhook-txs.ts
      // The private key from wallet SDK is 66 chars with '01' prefix
      // For address derivation, we need just the 64 hex chars
      let keyForAddress = privateKey;
      if (privateKey.length === 66 && privateKey.startsWith('01')) {
        keyForAddress = privateKey.substring(2);
      }
      // Ensure valid hex
      if (!/^[0-9a-fA-F]{64}$/.test(keyForAddress)) {
        throw new Error(`Invalid hex format for private key`);
      }
      const pk = createStacksPrivateKey(keyForAddress);
      address = getAddressFromPrivateKey(pk, network.version);
    } catch (error: any) {
      // If derivation fails, suggest user provides address directly
      throw new Error(`Could not derive address from mnemonic: ${error.message}.\n\nSolution: Run with address directly:\n  npm run check-nonce YOUR_ADDRESS\n\nOr check manually:\n  curl https://api.mainnet.hiro.so/v2/accounts/YOUR_ADDRESS?proof=0 | jq .nonce`);
    }
  }

  return { privateKey, address };
}

async function getNonce(address: string): Promise<number> {
  try {
    const apiUrl = 'https://api.mainnet.hiro.so';
    const response = await fetch(`${apiUrl}/v2/accounts/${address}?proof=0`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return 0; // Account doesn't exist yet
      }
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.nonce || 0;
  } catch (error: any) {
    throw new Error(`Error getting nonce: ${error.message}`);
  }
}


async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(`
Usage: npm run check-nonce [address]

Options:
  [address]    Stacks address (ST/SP format) to check nonce for
               If not provided, will derive address from WALLET_MNEMONIC

Examples:
  npm run check-nonce
  npm run check-nonce SP1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ012345
  
Note: Requires WALLET_MNEMONIC in .env if address is not provided
    `);
    process.exit(0);
  }

  let address: string;
  
  if (args.length > 0) {
    address = args[0];
    console.log(`Checking nonce for address: ${address}\n`);
  } else {
    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
      console.error('❌ Error: Either provide an address as argument or set WALLET_MNEMONIC in .env');
      console.error('   Usage: npm run check-nonce SP123...');
      process.exit(1);
    }
    
    console.log('Deriving address from WALLET_MNEMONIC (account 0)...\n');
    try {
      const account = await getAccount0(mnemonic);
      address = account.address;
      console.log(`Address: ${address}\n`);
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  try {
    const nonce = await getNonce(address);
    console.log(`✅ Current nonce: ${nonce}`);
    console.log(`\nNext transaction should use nonce: ${nonce}`);
    console.log(`(Set START_NONCE=${nonce} in .env if needed)`);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

