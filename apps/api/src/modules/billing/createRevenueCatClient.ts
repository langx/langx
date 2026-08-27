import type { Env } from '../../env'
import { createNotConfiguredRevenueCatClient, createRevenueCatClient } from './revenueCatClient'
import type { RevenueCatClient } from './revenueCatClient'

/** Mirrors `createStorageProvider`/`createTranslationProvider` — the app boots either way, only `/billing/refresh` depends on this being real. */
export function createRevenueCatClientFromEnv(env: Env): RevenueCatClient {
  if (env.REVENUECAT_SECRET_API_KEY) return createRevenueCatClient(env.REVENUECAT_SECRET_API_KEY)
  return createNotConfiguredRevenueCatClient()
}
