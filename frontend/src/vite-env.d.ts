/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional API origin. When unset, the app calls the relative `/api` path
   *  (proxied to the backend by nginx in prod and by Vite in dev). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
