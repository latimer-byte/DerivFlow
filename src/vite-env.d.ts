/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DERIV_APP_ID: string;
  readonly GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
