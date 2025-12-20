import { ChainhooksClient, CHAINHOOKS_BASE_URL, ChainhookDefinition } from '@hirosystems/chainhooks-client';
import { config } from './config.js';

export const chainhooksClient = new ChainhooksClient({
  baseUrl: config.chainhooks.baseUrl,
  apiKey: config.chainhooks.apiKey,
});

export function createRegisterUsernameChainhook(startBlockHeight?: number): ChainhookDefinition {
  const definition: ChainhookDefinition = {
    name: `${config.stacks.contractName}-register-username`,
    version: '1',
    chain: 'stacks',
    network: config.stacks.network,
    filters: {
      events: [
        {
          type: 'contract_call',
          contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`,
          function_name: 'register-username',
        },
      ],
    },
    action: {
      type: 'http_post',
      url: `${config.server.apiBaseUrl}/api/chainhooks/register-username`,
    },
  };
  
  // Only add options if startBlockHeight is provided
  if (startBlockHeight) {
    definition.options = { start_at_block_height: startBlockHeight };
  }
  
  return definition;
}

export function createTransferUsernameChainhook(startBlockHeight?: number): ChainhookDefinition {
  const definition: ChainhookDefinition = {
    name: `${config.stacks.contractName}-transfer-username`,
    version: '1',
    chain: 'stacks',
    network: config.stacks.network,
    filters: {
      events: [
        {
          type: 'contract_call',
          contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`,
          function_name: 'transfer-username',
        },
      ],
    },
    action: {
      type: 'http_post',
      url: `${config.server.apiBaseUrl}/api/chainhooks/transfer-username`,
    },
  };
  
  if (startBlockHeight) {
    definition.options = { start_at_block_height: startBlockHeight };
  }
  
  return definition;
}

export function createReleaseUsernameChainhook(startBlockHeight?: number): ChainhookDefinition {
  const definition: ChainhookDefinition = {
    name: `${config.stacks.contractName}-release-username`,
    version: '1',
    chain: 'stacks',
    network: config.stacks.network,
    filters: {
      events: [
        {
          type: 'contract_call',
          contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`,
          function_name: 'release-username',
        },
      ],
    },
    action: {
      type: 'http_post',
      url: `${config.server.apiBaseUrl}/api/chainhooks/release-username`,
    },
  };
  
  if (startBlockHeight) {
    definition.options = { start_at_block_height: startBlockHeight };
  }
  
  return definition;
}

export async function registerAllChainhooks(startBlockHeight?: number) {
  if (!config.chainhooks.apiKey) {
    throw new Error('CHAINHOOKS_API_KEY is required. Please set it in your .env file.');
  }

  try {
    console.log('Registering chainhooks...');

    const registerHook = createRegisterUsernameChainhook(startBlockHeight);
    const transferHook = createTransferUsernameChainhook(startBlockHeight);
    const releaseHook = createReleaseUsernameChainhook(startBlockHeight);

    // Check if chainhooks already exist and delete them first
    try {
      const existing = await chainhooksClient.getChainhooks({ limit: 60 });
      for (const hook of existing.results) {
        if (
          hook.definition.name === registerHook.name ||
          hook.definition.name === transferHook.name ||
          hook.definition.name === releaseHook.name
        ) {
          console.log(`Deleting existing chainhook: ${hook.definition.name}`);
          try {
            await chainhooksClient.deleteChainhook(hook.uuid);
          } catch (error: any) {
            // Ignore 404 errors (already deleted)
            if (error.message.includes('404') || error.message.includes('Not Found')) {
              console.log(`  (Already deleted, continuing...)`);
            } else {
              throw error;
            }
          }
        }
      }
    } catch (error: any) {
      // If we can't list chainhooks, continue anyway - they might not exist
      console.log(`Warning: Could not check existing chainhooks: ${error.message}`);
    }

    const registerResult = await chainhooksClient.registerChainhook(registerHook);
    console.log(`Registered chainhook: ${registerHook.name} (UUID: ${registerResult.uuid})`);

    const transferResult = await chainhooksClient.registerChainhook(transferHook);
    console.log(`Registered chainhook: ${transferHook.name} (UUID: ${transferResult.uuid})`);

    const releaseResult = await chainhooksClient.registerChainhook(releaseHook);
    console.log(`Registered chainhook: ${releaseHook.name} (UUID: ${releaseResult.uuid})`);

    return {
      register: registerResult.uuid,
      transfer: transferResult.uuid,
      release: releaseResult.uuid,
    };
  } catch (error: any) {
    console.error('Error registering chainhooks:', error.message);
    throw error;
  }
}

export async function listChainhooks() {
  try {
    const result = await chainhooksClient.getChainhooks({ limit: 60 });
    return result.results;
  } catch (error: any) {
    console.error('Error listing chainhooks:', error.message);
    throw error;
  }
}

export async function enableAllChainhooks() {
  if (!config.chainhooks.apiKey) {
    throw new Error('CHAINHOOKS_API_KEY is required. Please set it in your .env file.');
  }

  try {
    const hooks = await listChainhooks();
    const contractName = config.stacks.contractName;
    
    const targetHooks = hooks.filter(hook => 
      hook.definition.name.startsWith(`${contractName}-`)
    );

    console.log(`Found ${targetHooks.length} chainhooks to enable...`);

    for (const hook of targetHooks) {
      if (!hook.status.enabled) {
        await chainhooksClient.enableChainhook(hook.uuid, true);
        console.log(`✓ Enabled chainhook: ${hook.definition.name}`);
      } else {
        console.log(`- Chainhook already enabled: ${hook.definition.name}`);
      }
    }

    return targetHooks.map(h => h.uuid);
  } catch (error: any) {
    console.error('Error enabling chainhooks:', error.message);
    throw error;
  }
}
