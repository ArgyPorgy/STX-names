import dotenv from 'dotenv';

dotenv.config();

export type NetworkType = 'mainnet' | 'testnet';

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    // Remove trailing slash to avoid double slashes in URLs
    apiBaseUrl: (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, ''),
  },
  stacks: {
    network: (process.env.NETWORK || 'mainnet') as NetworkType,
    contractAddress: process.env.CONTRACT_ADDRESS || 'SPZ2TS3SCXSX01ETASV9X0HNS3C9RZGXD94JKX3R',
    contractName: process.env.CONTRACT_NAME || 'username-registry-v2',
  },
  chainhooks: {
    apiKey: process.env.CHAINHOOKS_API_KEY || '',
    baseUrl: process.env.CHAINHOOKS_BASE_URL || 'https://api.mainnet.hiro.so',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
};

// Validate required environment variables
if (!config.chainhooks.apiKey) {
  console.warn('Warning: CHAINHOOKS_API_KEY not set. Chainhooks features will not work.');
}

if (!config.database.url) {
  console.warn('Warning: DATABASE_URL not set. Database features will not work.');
}

