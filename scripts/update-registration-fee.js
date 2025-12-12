/**
 * Update Registration Fee Script
 * 
 * Updates the registration fee on the deployed contract to 0.1 STX (100,000 microSTX)
 * 
 * Usage: node scripts/update-registration-fee.js [network]
 * 
 * Examples:
 *   node scripts/update-registration-fee.js testnet
 *   node scripts/update-registration-fee.js mainnet
 */

import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { makeContractCall, broadcastTransaction, AnchorMode, PostConditionMode, uintCV } from '@stacks/transactions';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const networkType = args[0] || 'testnet';

// Contract details
const CONTRACT_ADDRESS = networkType === 'testnet' 
  ? 'STZ2TS3SCXSX01ETASV9X0HNS3C9RZGXDBQ038TK'
  : process.env.CONTRACT_ADDRESS || '';
const CONTRACT_NAME = 'username-registry';

// New fee: 0.1 STX = 100,000 microSTX
const NEW_FEE = 100_000n;

async function getPrivateKey() {
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  
  if (!mnemonic) {
    console.error('❌ Error: DEPLOYER_MNEMONIC not found in .env file');
    console.error('Please add your mnemonic to .env:');
    console.error('DEPLOYER_MNEMONIC="your twelve word mnemonic phrase here"');
    process.exit(1);
  }

  try {
    const { generateWallet } = await import('@stacks/wallet-sdk');
    const wallet = await generateWallet({
      secretKey: mnemonic,
      password: '',
    });
    return wallet.accounts[0].stxPrivateKey;
  } catch (error) {
    console.error('❌ Error deriving private key from mnemonic:', error.message);
    process.exit(1);
  }
}

async function updateFee() {
  const network = networkType === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
  const privateKey = await getPrivateKey();
  
  // Use the contract address as sender (it's the deployer/owner)
  const senderAddress = CONTRACT_ADDRESS;
  
  console.log(`🔧 Updating registration fee to 0.1 STX on ${networkType}...`);
  console.log(`Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
  console.log(`Sender: ${senderAddress}`);
  console.log(`New fee: ${NEW_FEE} microSTX (0.1 STX)`);
  console.log('');

  try {
    const txOptions = {
      network,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'set-registration-fee',
      functionArgs: [
        uintCV(NEW_FEE),
      ],
      senderKey: privateKey,
      fee: 1000, // Transaction fee
      // Nonce will be fetched automatically by makeContractCall
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const broadcastResponse = await broadcastTransaction(transaction, network);

    if (broadcastResponse.error) {
      console.error('❌ Transaction failed:', broadcastResponse.error);
      if (broadcastResponse.reason) {
        console.error('Reason:', broadcastResponse.reason);
      }
      process.exit(1);
    }

    console.log('✅ Transaction broadcasted successfully!');
    console.log(`Transaction ID: ${broadcastResponse.txid}`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');
    console.log(`Explorer: https://explorer.stacks.co/txid/${broadcastResponse.txid}?chain=${networkType}`);
    console.log('');
    console.log('Once confirmed, the registration fee will be updated to 0.1 STX.');

  } catch (error) {
    console.error('❌ Error updating fee:', error.message);
    process.exit(1);
  }
}

updateFee();

