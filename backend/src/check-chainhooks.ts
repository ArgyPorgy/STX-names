import { chainhooksClient, listChainhooks } from './chainhooks.js';
import { config } from './config.js';

async function main() {
  try {
    console.log('Checking Chainhooks Status');
    console.log('==========================');
    console.log(`Network: ${config.stacks.network}`);
    console.log(`Contract: ${config.stacks.contractAddress}.${config.stacks.contractName}`);
    console.log('');

    const hooks = await listChainhooks();
    console.log(`Found ${hooks.length} chainhooks:\n`);

    for (const hook of hooks) {
      console.log(`Name: ${hook.definition.name}`);
      console.log(`UUID: ${hook.uuid}`);
      console.log(`Status: ${hook.status.status}`);
      console.log(`Enabled: ${hook.status.enabled}`);
      if (hook.definition.action?.type === 'http_post' && hook.definition.action.url) {
        console.log(`Webhook URL: ${hook.definition.action.url}`);
      }
      console.log(`Last Evaluated Block: ${hook.status.last_evaluated_block_height || 'N/A'}`);
      console.log(`Occurrence Count: ${hook.status.occurrence_count}`);
      console.log(`Evaluated Block Count: ${hook.status.evaluated_block_count}`);
      console.log('');
    }

    // Hook status is already included in the list results
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
