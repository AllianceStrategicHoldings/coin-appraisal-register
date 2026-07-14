/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type { calculateBulk, loadConfig } from './api/client'
import type { CartLineInput } from './api/types'

interface ImportMetaEnv {
  readonly VITE_CONFIG_LOAD_URL: string
  readonly VITE_BULK_CALC_URL: string
  readonly VITE_CUSTOMER_LOOKUP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __test?: {
      loadConfig?: typeof loadConfig
      calculateBulk?: typeof calculateBulk
      addLine?: (line: CartLineInput) => void
    }
  }
}

export {}
