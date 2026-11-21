/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin, e.g. http://localhost:4000. Leave empty in dev to use the Vite proxy. */
  readonly VITE_API_URL?: string
  /** Comma-separated SMU email domains, mirrors ALLOWED_EMAIL_DOMAINS on the server. */
  readonly VITE_ALLOWED_EMAIL_DOMAINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
