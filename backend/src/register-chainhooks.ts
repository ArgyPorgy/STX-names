import { registerAllChainhooks, listChainhooks } from './chainhooks.js';
import { config } from './config.js';

async function main() {
  try {
    console.log('Chainhooks Registration Script');
    console.log('==============================');
    console.log(`Network: ${config.stacks.network}`);
    console.log(`Contract: ${config.stacks.contractAddress}.${config.stacks.contractName}`);
    console.log(`Base URL: ${config.chainhooks.baseUrl}`);
    console.log('');

    // List existing chainhooks
    console.log('Checking existing chainhooks...');
    const existing = await listChainhooks();
    console.log(`Found ${existing.length} existing chainhooks`);
    console.log('');

    // Register chainhooks
    // Optionally provide a start block height to backfill from a specific block
    const startBlockHeight = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
    
    if (startBlockHeight) {
      console.log(`Starting from block height: ${startBlockHeight}`);
    }

    const result = await registerAllChainhooks(startBlockHeight);
    
    console.log('');
    console.log('Chainhooks registered successfully!');
    console.log(`Register hook UUID: ${result.register}`);
    console.log(`Transfer hook UUID: ${result.transfer}`);
    console.log(`Release hook UUID: ${result.release}`);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
