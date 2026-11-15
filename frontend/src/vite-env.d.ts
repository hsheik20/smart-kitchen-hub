/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Public base URL of the FastAPI backend, baked in at build time (e.g. a Render web service URL).
   * Leave unset for local development: requests then go to relative `/api/...` and Vite proxies them.
   * Not a secret — it is visible in the browser bundle.
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
