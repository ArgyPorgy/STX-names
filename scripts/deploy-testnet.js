/**
 * Testnet Deployment Script for STX Names
 * 
 * Prerequisites:
 * 1. Set DEPLOYER_MNEMONIC environment variable with your testnet wallet mnemonic
 * 2. Ensure your testnet wallet has enough STX for deployment fees
 * 3. Run: node scripts/deploy-testnet.js
 */

import { 
  makeContractDeploy, 
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const NETWORK = new StacksTestnet();
const CONTRACT_NAME = 'username-registry';

async function getPrivateKey() {
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    throw new Error('DEPLOYER_MNEMONIC environment variable is required');
  }

  // Import dynamically to avoid issues
  const { generateWallet } = await import('@stacks/wallet-sdk');
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: '',
  });

  return wallet.accounts[0].stxPrivateKey;
}

async function deployContract() {
  console.log('🚀 STX Names - Testnet Deployment');
  console.log('='.repeat(50));

  try {
    // Read contract source
    const contractPath = join(__dirname, '..', 'contracts', 'username-registry.clar');
    const codeBody = readFileSync(contractPath, 'utf8');
    console.log('✅ Contract source loaded');

    // Get private key from mnemonic
    const privateKey = await getPrivateKey();
    console.log('✅ Private key derived from mnemonic');

    // Create deploy transaction
    const txOptions = {
      contractName: CONTRACT_NAME,
      codeBody,
      senderKey: privateKey,
      network: NETWORK,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      fee: 100000n, // 0.1 STX fee
    };

    console.log('📝 Creating deployment transaction...');
    const transaction = await makeContractDeploy(txOptions);

    // Broadcast transaction
    console.log('📡 Broadcasting transaction to testnet...');
    const broadcastResponse = await broadcastTransaction(transaction, NETWORK);

    if ('error' in broadcastResponse) {
      throw new Error(`Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`);
    }

    const txId = broadcastResponse.txid;
    console.log('');
    console.log('✅ Contract deployment submitted!');
    console.log('='.repeat(50));
    console.log(`Transaction ID: ${txId}`);
    console.log(`Explorer: https://explorer.stacks.co/txid/${txId}?chain=testnet`);
    console.log('');
    console.log('⏳ Wait for transaction to be confirmed (usually 10-30 minutes on testnet)');
    console.log('');

    return txId;
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployContract();

