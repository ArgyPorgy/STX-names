import 'dotenv/config';
import { db } from './db.js';
import { config } from './config.js';

const CONTRACT_ID = `${config.stacks.contractAddress}.${config.stacks.contractName}`;
const API_URL = 'https://api.mainnet.hiro.so';
const POLL_INTERVAL = 30000; // 30 seconds

// Track processed transactions to avoid duplicates
const processedTxIds = new Set<string>();

interface StacksTx {
  tx_id: string;
  tx_status: string;
  block_height: number;
  burn_block_time: number;
  sender_address: string;
  contract_call?: {
    contract_id: string;
    function_name: string;
    function_args?: Array<{
      repr: string;
      type: string;
    }>;
  };
}

async function fetchRecentTransactions(): Promise<StacksTx[]> {
  try {
    const url = `${API_URL}/extended/v1/address/${CONTRACT_ID}/transactions?limit=50`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error: any) {
    console.error('Error fetching transactions:', error.message);
    return [];
  }
}

function extractUsername(args: Array<{ repr: string; type: string }> | undefined): string | null {
  if (!args || args.length === 0) return null;
  
  // The first arg should be the username (string-ascii)
  const usernameArg = args[0];
  if (usernameArg && usernameArg.repr) {
    // repr format: "username" or 0x... 
    return usernameArg.repr.replace(/^"|"$/g, '');
  }
  return null;
}

async function processTransaction(tx: StacksTx): Promise<void> {
  if (tx.tx_status !== 'success') return;
  if (!tx.contract_call) return;
  if (processedTxIds.has(tx.tx_id)) return;
  
  const { function_name, function_args } = tx.contract_call;
  const username = extractUsername(function_args);
  
  if (!username) {
    console.log(`  ⚠️  Could not extract username from tx ${tx.tx_id.slice(0, 10)}...`);
    return;
  }
  
  const timestamp = tx.burn_block_time;
  
  try {
    if (function_name === 'register-username') {
      await db.insertUsername({
        username,
        owner: tx.sender_address,
        registeredAt: timestamp,
        txId: tx.tx_id,
        blockHeight: tx.block_height,
      });
      console.log(`  ✅ Stored register: ${username} -> ${tx.sender_address}`);
      
    } else if (function_name === 'transfer-username') {
      // For transfer, we need the new owner from args
      const newOwner = function_args && function_args[1] ? 
        function_args[1].repr.replace(/^'|'$/g, '') : tx.sender_address;
      
      await db.updateUsernameOwner(username, newOwner);
      console.log(`  ✅ Stored transfer: ${username} -> ${newOwner}`);
      
    } else if (function_name === 'release-username') {
      await db.deleteUsername(username);
      console.log(`  ✅ Stored release: ${username}`);
    }
    
    processedTxIds.add(tx.tx_id);
  } catch (error: any) {
    // Ignore duplicate key errors
    if (error.message.includes('duplicate') || error.code === '23505') {
      processedTxIds.add(tx.tx_id);
    } else {
      console.error(`  ❌ Error processing tx ${tx.tx_id.slice(0, 10)}:`, error.message);
    }
  }
}

async function poll(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Polling for new transactions...`);
  
  const transactions = await fetchRecentTransactions();
  console.log(`  Found ${transactions.length} recent transactions`);
  
  let newCount = 0;
  for (const tx of transactions) {
    if (!processedTxIds.has(tx.tx_id) && tx.tx_status === 'success' && tx.contract_call) {
      const funcName = tx.contract_call.function_name;
      if (['register-username', 'transfer-username', 'release-username'].includes(funcName)) {
        await processTransaction(tx);
        newCount++;
      }
    }
  }
  
  if (newCount === 0) {
    console.log('  No new transactions to process');
  } else {
    console.log(`  Processed ${newCount} new transactions`);
  }
}

async function main() {
  console.log('🔄 Transaction Poller Started');
  console.log('=============================');
  console.log(`Contract: ${CONTRACT_ID}`);
  console.log(`Poll interval: ${POLL_INTERVAL / 1000} seconds`);
  console.log('');
  
  // Initialize database
  const { initializeDatabase } = await import('./db.js');
  await initializeDatabase();
  console.log('Database initialized');
  
  // Initial poll
  await poll();
  
  // Start polling loop
  setInterval(poll, POLL_INTERVAL);
  
  console.log('\nPolling started. Press Ctrl+C to stop.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

