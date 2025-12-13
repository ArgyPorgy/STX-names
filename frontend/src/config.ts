import { StacksMainnet, StacksTestnet, StacksMocknet } from '@stacks/network';

// Network configuration
export type NetworkType = 'mainnet' | 'testnet' | 'devnet';

export const NETWORK_TYPE: NetworkType = (import.meta.env.VITE_NETWORK || 'testnet') as NetworkType;

// Contract configuration
// Update this after deploying to testnet with your actual contract address
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
export const CONTRACT_NAME = 'username-registry-v12';

// Network instances
export const getNetwork = () => {
  switch (NETWORK_TYPE) {
    case 'mainnet':
      return new StacksMainnet();
    case 'testnet':
      return new StacksTestnet();
    case 'devnet':
    default:
      return new StacksMocknet();
  }
};

// API URLs
export const getApiUrl = () => {
  switch (NETWORK_TYPE) {
    case 'mainnet':
      return 'https://api.mainnet.hiro.so';
    case 'testnet':
      return 'https://api.testnet.hiro.so';
    case 'devnet':
    default:
      return 'http://localhost:3999';
  }
};

// Explorer URLs
export const getExplorerUrl = (txId: string) => {
  switch (NETWORK_TYPE) {
    case 'mainnet':
      return `https://explorer.stacks.co/txid/${txId}?chain=mainnet`;
    case 'testnet':
      return `https://explorer.stacks.co/txid/${txId}?chain=testnet`;
    case 'devnet':
    default:
      return `http://localhost:8000/txid/${txId}`;
  }
};

// App metadata for wallet connection
export const APP_METADATA = {
  name: 'STX Names',
  icon: '/stx-icon.svg',
};

// Username constraints (must match contract)
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9_-]+$/;

// Fee display helper (convert microSTX to STX)
export const microStxToStx = (microStx: bigint | number): string => {
  const stx = Number(microStx) / 1_000_000;
  return stx.toFixed(6).replace(/\.?0+$/, '');
};

export const stxToMicroStx = (stx: number): bigint => {
  return BigInt(Math.floor(stx * 1_000_000));
};

