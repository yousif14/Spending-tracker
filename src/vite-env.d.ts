/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_N8N_API_KEY: string
  readonly VITE_DEFAULT_FROM: string
  readonly VITE_DEFAULT_TO: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
