/**
 * Check Deployment Status Script
 * 
 * Usage: node scripts/check-deployment.js <txid> [network]
 * 
 * Examples:
 *   node scripts/check-deployment.js 0x123... testnet
 *   node scripts/check-deployment.js 0x123... mainnet
 */

import { StacksMainnet, StacksTestnet } from '@stacks/network';

const args = process.argv.slice(2);
const txId = args[0];
const networkType = args[1] || 'testnet';

if (!txId) {
  console.log('Usage: node scripts/check-deployment.js <txid> [network]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/check-deployment.js 0x123... testnet');
  console.log('  node scripts/check-deployment.js 0x123... mainnet');
  process.exit(1);
}

async function checkTransaction() {
  const network = networkType === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
  const apiUrl = networkType === 'mainnet' 
    ? 'https://api.mainnet.hiro.so' 
    : 'https://api.testnet.hiro.so';

  console.log(`🔍 Checking transaction on ${networkType}...`);
  console.log(`Transaction ID: ${txId}`);
  console.log('');

  try {
    const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('⏳ Transaction not found yet. It may still be pending.');
        return;
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('Transaction Status:');
    console.log('='.repeat(50));
    console.log(`Status: ${data.tx_status}`);
    console.log(`Type: ${data.tx_type}`);
    
    if (data.tx_type === 'smart_contract') {
      console.log(`Contract ID: ${data.smart_contract?.contract_id}`);
    }

    if (data.tx_status === 'success') {
      console.log('');
      console.log('✅ Transaction confirmed successfully!');
      
      if (data.smart_contract?.contract_id) {
        console.log('');
        console.log('Contract deployed at:');
        console.log(data.smart_contract.contract_id);
        console.log('');
        console.log(`Explorer: https://explorer.stacks.co/txid/${txId}?chain=${networkType}`);
      }
    } else if (data.tx_status === 'pending') {
      console.log('');
      console.log('⏳ Transaction is still pending...');
      console.log('Check again in a few minutes.');
    } else if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') {
      console.log('');
      console.log('❌ Transaction failed!');
      console.log(`Reason: ${data.tx_result?.repr || 'Unknown'}`);
    }

  } catch (error) {
    console.error('❌ Error checking transaction:', error.message);
    process.exit(1);
  }
}

checkTransaction();

