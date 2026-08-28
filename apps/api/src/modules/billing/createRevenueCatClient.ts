import type { Env } from '../../env'
import { createFakeRevenueCat } from './fakeRevenueCat'
import { createNotConfiguredRevenueCatClient, createRevenueCatClient } from './revenueCatClient'
import type { RevenueCatClient } from './revenueCatClient'

/** Mirrors `createStorageProvider`/`createTranslationProvider` — the app boots either way, only `/billing/refresh` depends on this being real. */
export function createRevenueCatClientFromEnv(env: Env): RevenueCatClient {
  // Checked before the secret key on purpose. A developer who sets the flag on
  // a machine that still has a real key in its `.env` means the fake; the
  // reverse reading would send simulated purchases at the live dashboard.
  // `loadEnv` has already refused this combination under NODE_ENV=production.
  if (env.REVENUECAT_FAKE_STORE) return createFakeRevenueCat()
  if (env.REVENUECAT_SECRET_API_KEY) return createRevenueCatClient(env.REVENUECAT_SECRET_API_KEY)
  return createNotConfiguredRevenueCatClient()
}
