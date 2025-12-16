import { ChainhooksClient, CHAINHOOKS_BASE_URL, ChainhookDefinition } from '@hirosystems/chainhooks-client';
import { config } from './config.js';

export const chainhooksClient = new ChainhooksClient({
  baseUrl: config.chainhooks.baseUrl,
  apiKey: config.chainhooks.apiKey,
});

export function createRegisterUsernameChainhook(startBlockHeight?: number): ChainhookDefinition {
  return {
    name: `${config.stacks.contractName}-register-username`,
    chain: 'stacks',
    network: config.stacks.network,
    filters: {
      contract_calls: [
        {
          contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`,
          function_name: 'register-username',
        },
      ],
    },
    options: startBlockHeight ? { start_at_block_height: startBlockHeight } : undefined,
    action: {
      http: {
        url: `${config.server.apiBaseUrl}/api/chainhooks/register-username`,
        method: 'POST',
        authorization_header: process.env.CHAINHOOKS_WEBHOOK_SECRET || 'default-secret',
      },
    },
  };
}

export function createTransferUsernameChainhook(startBlockHeight?: number): ChainhookDefinition {
  return {
    name: `${config.stacks.contractName}-transfer-username`,
    chain: 'stacks',
    network: config.stacks.network,
    filters: {
      contract_calls: [
        {
          contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`,
          function_name: 'transfer-username',
        },
      ],
    },
    options: startBlockHeight ? { start_at_block_height: startBlockHeight } : undefined,
    action: {
      http: {
        url: `${config.server.apiBaseUrl}/api/chainhooks/transfer-username`,
        method: 'POST',
        authorization_header: process.env.CHAINHOOKS_WEBHOOK_SECRET || 'default-secret',
      },
    },
  };
}

export function createReleaseUsernameChainhook(startBlockHeight?: number): ChainhookDefinition {
  return {
    name: `${config.stacks.contractName}-release-username`,
    chain: 'stacks',
    network: config.stacks.network,
    filters: {
      contract_calls: [
        {
          contract_identifier: `${config.stacks.contractAddress}.${config.stacks.contractName}`,
          function_name: 'release-username',
        },
      ],
    },
    options: startBlockHeight ? { start_at_block_height: startBlockHeight } : undefined,
    action: {
      http: {
        url: `${config.server.apiBaseUrl}/api/chainhooks/release-username`,
        method: 'POST',
        authorization_header: process.env.CHAINHOOKS_WEBHOOK_SECRET || 'default-secret',
      },
    },
  };
}

export async function registerAllChainhooks(startBlockHeight?: number) {
  try {
    console.log('Registering chainhooks...');

    const registerHook = createRegisterUsernameChainhook(startBlockHeight);
    const transferHook = createTransferUsernameChainhook(startBlockHeight);
    const releaseHook = createReleaseUsernameChainhook(startBlockHeight);

    // Check if chainhooks already exist and delete them first
    const existing = await chainhooksClient.getChainhooks({ limit: 100 });
    for (const hook of existing.results) {
      if (
        hook.definition.name === registerHook.name ||
        hook.definition.name === transferHook.name ||
        hook.definition.name === releaseHook.name
      ) {
        console.log(`Deleting existing chainhook: ${hook.definition.name}`);
        await chainhooksClient.deleteChainhook(hook.uuid);
      }
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
    const result = await chainhooksClient.getChainhooks({ limit: 100 });
    return result.results;
  } catch (error: any) {
    console.error('Error listing chainhooks:', error.message);
    throw error;
  }
}
