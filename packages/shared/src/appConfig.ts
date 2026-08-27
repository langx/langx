import { z } from 'zod'

/**
 * Server-controlled configuration the client reads at launch and on resume.
 *
 * This is the answer to three problems that would otherwise each need their own
 * mechanism: taking the app down for maintenance, refusing to serve a client
 * too old for the current API, and turning a misbehaving feature off without a
 * release. All three are "the server needs to tell the client something now",
 * so they share one document and one endpoint.
 */
export const maintenanceSchema = z.object({
  enabled: z.boolean(),
  /** Shown verbatim to the user. Keep it specific — "back at 14:00 UTC" beats "we'll be back soon". */
  message: z.string(),
  /** ISO timestamp the work is expected to end; the client can show a countdown. */
  until: z.string().nullable(),
})
export type Maintenance = z.infer<typeof maintenanceSchema>

/**
 * The oldest client version each platform may run.
 *
 * Needed because OTA updates are not instant: someone who has not opened the
 * app in a month is still on an old bundle, and a server change that assumes
 * a newer client would break for them silently. Raising this turns that into
 * an explicit "update to continue" screen.
 */
export const minVersionSchema = z.object({
  ios: z.string(),
  android: z.string(),
  web: z.string(),
})
export type MinVersion = z.infer<typeof minVersionSchema>

export const appConfigSchema = z.object({
  maintenance: maintenanceSchema,
  minVersion: minVersionSchema,
  /**
   * Kill switches for individual features. A provider outage should be one
   * database write, not a deploy.
   */
  flags: z.object({
    translationEnabled: z.boolean(),
    discoveryEnabled: z.boolean(),
    signupsEnabled: z.boolean(),
  }),
  updatedAt: z.string(),
})
export type AppConfig = z.infer<typeof appConfigSchema>

export const DEFAULT_APP_CONFIG: Omit<AppConfig, 'updatedAt'> = {
  maintenance: { enabled: false, message: '', until: null },
  // Deliberately permissive by default: a fresh or self-hosted instance must
  // never lock out its own clients because nobody set this yet.
  minVersion: { ios: '0.0.0', android: '0.0.0', web: '0.0.0' },
  flags: { translationEnabled: true, discoveryEnabled: true, signupsEnabled: true },
}

/** What `GET /app-config` returns: the config plus what it means for *this* caller. */
export const appConfigResponseSchema = appConfigSchema.extend({
  /** True when the calling client is older than its platform's minimum. */
  updateRequired: z.boolean(),
})
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>

/** Header the client sends so the server can decide `updateRequired`. */
export const APP_VERSION_HEADER = 'x-app-version'
export const APP_PLATFORM_HEADER = 'x-app-platform'

/** `1`, `1.2` and `1.2.3` are all accepted; anything else is not a version. */
const VERSION_PATTERN = /^\d+(\.\d+){0,2}$/

export function isVersion(value: string): boolean {
  return VERSION_PATTERN.test(value.trim())
}

/** Numeric, segment by segment — so `2.10.0` is correctly newer than `2.9.0`. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .split('.')
      .slice(0, 3)
      .map((part) => {
        const n = Number.parseInt(part, 10)
        return Number.isFinite(n) ? n : 0
      })

  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * Whether this client is too old to be served.
 *
 * A missing **or unparseable** version is never forced to update. Parsing junk
 * as `0.0.0` would compare below every minimum and lock the user out — which
 * is exactly backwards, since a header we cannot read is our problem, not
 * theirs. Being wrong permissively is the only safe direction here, and a test
 * caught this doing the opposite.
 */
export function isUpdateRequired(clientVersion: string | undefined, minimum: string): boolean {
  if (!clientVersion || !isVersion(clientVersion)) return false
  if (!isVersion(minimum)) return false
  return compareVersions(clientVersion, minimum) < 0
}
