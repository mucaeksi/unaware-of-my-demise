/// <reference types="vite/client" />
declare const __CLIENT_VERSION__: string;
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_CONTENT_CHANNEL?: 'dev' | 'staging' | 'production';
  readonly VITE_PATCH_LAB?: string;
}
