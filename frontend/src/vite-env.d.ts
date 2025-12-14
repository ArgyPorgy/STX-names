/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: 'devnet' | 'testnet' | 'mainnet';
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_CONTRACT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

