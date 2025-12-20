import { chainhooksClient, registerAllChainhooks, enableAllChainhooks } from './chainhooks.js';
import { config } from './config.js';

async function main() {
  try {
    console.log('Fixing Chainhooks');
    console.log('================');
    console.log(`Network: ${config.stacks.network}`);
    console.log(`Contract: ${config.stacks.contractAddress}.${config.stacks.contractName}`);
    console.log('');

    // Get current block height minus a buffer (to catch recent transactions)
    const response = await fetch('https://api.mainnet.hiro.so/v2/info');
    const info = await response.json();
    const currentBlock = info.stacks_tip_height;
    const startBlock = Math.max(1, currentBlock - 1000); // Go back 1000 blocks to be safe

    console.log(`Current block height: ${currentBlock}`);
    console.log(`Will register chainhooks starting from block: ${startBlock}`);
    console.log('');

    // Delete existing chainhooks first (ignore errors - they might already be deleted)
    console.log('Deleting existing chainhooks...');
    try {
      const existing = await chainhooksClient.getChainhooks({ limit: 60 });
      for (const hook of existing.results) {
        if (hook.definition.name.startsWith(`${config.stacks.contractName}-`)) {
          console.log(`  Deleting: ${hook.definition.name}`);
          try {
            await chainhooksClient.deleteChainhook(hook.uuid);
            console.log(`    ✓ Deleted`);
          } catch (error: any) {
            // Ignore 404 errors (already deleted)
            if (error.message.includes('404') || error.message.includes('Not Found')) {
              console.log(`    ⚠️  Already deleted (ignoring)`);
            } else {
              console.log(`    ⚠️  Could not delete: ${error.message}`);
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not list chainhooks: ${error.message}`);
    }
    console.log('');

    // Register new chainhooks with start block
    console.log('Registering new chainhooks...');
    const uuids = await registerAllChainhooks(startBlock);
    console.log('');

    // Enable chainhooks
    console.log('Enabling chainhooks...');
    await enableAllChainhooks();
    console.log('');

    console.log('✅ Chainhooks fixed!');
    console.log('');
    console.log('Webhook URLs:');
    console.log(`  Register: ${config.server.apiBaseUrl}/api/chainhooks/register-username`);
    console.log(`  Transfer: ${config.server.apiBaseUrl}/api/chainhooks/transfer-username`);
    console.log(`  Release: ${config.server.apiBaseUrl}/api/chainhooks/release-username`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

