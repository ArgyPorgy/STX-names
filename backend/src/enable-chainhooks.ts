import { enableAllChainhooks } from './chainhooks.js';
import { config } from './config.js';

async function main() {
  try {
    console.log('Enable Chainhooks Script');
    console.log('========================');
    console.log(`Network: ${config.stacks.network}`);
    console.log(`Contract: ${config.stacks.contractName}`);
    console.log('');

    const uuids = await enableAllChainhooks();
    
    console.log('');
    console.log(`✓ Enabled ${uuids.length} chainhooks!`);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();



