/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 