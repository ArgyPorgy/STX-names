/**
 * Check which address will be used for deployment
 */

import 'dotenv/config';
import { createStacksPrivateKey, getAddressFromPrivateKey } from '@stacks/transactions';
import { StacksMainnet, StacksTestnet } from '@stacks/network';

async function getAddress() {
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    console.error('❌ DEPLOYER_MNEMONIC not set in .env');
    process.exit(1);
  }

  const { generateWallet } = await import('@stacks/wallet-sdk');
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });

  const account = wallet.accounts[0];
  const pk = account.stxPrivateKey;
  const privateKey = typeof pk === 'string' ? pk.trim() : String(pk).trim();
  
  let keyForAddress = privateKey;
  if (privateKey.length === 66 && privateKey.startsWith('01')) {
    keyForAddress = privateKey.substring(2);
  }

  const stacksPk = createStacksPrivateKey(keyForAddress);
  const mainnetAddress = getAddressFromPrivateKey(stacksPk, new StacksMainnet().version);
  const testnetAddress = getAddressFromPrivateKey(stacksPk, new StacksTestnet().version);

  console.log('📋 Deployment Address (Account 0):');
  console.log('='.repeat(50));
  console.log(`Mainnet: ${mainnetAddress}`);
  console.log(`Testnet: ${testnetAddress}`);
  console.log('');
}

getAddress().catch(console.error);

