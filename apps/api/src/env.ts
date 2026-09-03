import { z } from 'zod'

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema)
}

/**
 * Fail fast and loudly on boot rather than at the first request that needs a
 * missing variable. Everything optional here belongs to a later phase; the
 * required set is what the current phase needs to boot.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required — see .env.example'),
  MONGODB_DB: z.string().min(1).default('langx_dev'),

  // Faz 1: Better Auth. No safe default for a signing secret is possible —
  // baking one in would be a real vulnerability in a public repo — so this is
  // required from here on. Generate with: openssl rand -base64 32
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET is required — openssl rand -base64 32'),
  // Falls back to http://<HOST>:<PORT> in auth.ts when unset (local dev).
  BETTER_AUTH_URL: emptyToUndefined(z.url().optional()),
  /**
   * Shared with a Cloudflare transform rule, which stamps it on every request
   * that really passed through the edge. Without it `CF-IPCountry` is just a
   * header anyone can send to the origin's IP — see `requestCountry.ts`.
   * Optional: a self-hosted deployment has no edge to prove anything about.
   */
  EDGE_SECRET: emptyToUndefined(z.string().min(8).optional()),
  TRUSTED_ORIGINS: z
    .string()
    .default('')
    .transform((raw) =>
      raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // Verification and password-reset email. Without a key, sendEmail logs the
  // link instead of sending it — the app still boots and is testable, but
  // nothing is delivered until a real key is set.
  RESEND_API_KEY: emptyToUndefined(z.string().optional()),
  // resend.dev requires no domain verification, so this works immediately;
  // point it at a verified langx.io sender before Faz 13's launch.
  EMAIL_FROM: z.string().min(1).default('LangX <onboarding@resend.dev>'),

  // OAuth. Each provider activates only once both of its variables are set —
  // see socialProviders() in auth.ts — so leaving these blank still boots a
  // fully working email/password flow.
  GOOGLE_CLIENT_ID: emptyToUndefined(z.string().optional()),
  GOOGLE_CLIENT_SECRET: emptyToUndefined(z.string().optional()),

  // Apple's "client secret" is a short-lived JWT we generate ourselves (see
  // auth/appleClientSecret.ts) from a Sign in with Apple key — not a value
  // Apple ever hands you directly. APPLE_CLIENT_ID is the Services ID.
  APPLE_CLIENT_ID: emptyToUndefined(z.string().optional()),
  APPLE_TEAM_ID: emptyToUndefined(z.string().optional()),
  APPLE_KEY_ID: emptyToUndefined(z.string().optional()),
  // PEM, with real newlines escaped as literal `\n` (the only way most .env
  // loaders and host secret stores accept a multi-line value on one line).
  APPLE_PRIVATE_KEY: emptyToUndefined(
    z
      .string()
      .transform((pem) => pem.replace(/\\n/g, '\n'))
      .optional(),
  ),

  /**
   * The token Apple hands you when a domain is added to a Services ID's Web
   * Authentication Configuration, served back at
   * `/.well-known/apple-developer-domain-association.txt`. Apple refuses to
   * save the return URL until it can fetch that file over HTTPS, with no
   * redirect, from the domain the *return URL* is on — this API's host, not
   * the app's, which is why the app's `public/.well-known/` cannot carry it.
   *
   * Public, not secret: it is served to anyone who asks. It lives in the
   * environment rather than the source because it belongs to one deployment's
   * Services ID — a self-hosted install verifies a different domain with a
   * different token, and should not have to edit code to do it. Unset, the
   * path simply 404s.
   */
  APPLE_DOMAIN_ASSOCIATION: emptyToUndefined(z.string().optional()),

  // Only needed when the Expo project has enhanced push security enabled, in
  // which case an unauthenticated send is rejected outright. Expo dashboard →
  // Access tokens. Unset is the normal case and sends work without it.
  EXPO_ACCESS_TOKEN: emptyToUndefined(z.string().optional()),

  // Faz 2: avatar upload. Same S3-compatible code path works for both B2 and
  // R2 — only these values change. Left unset, the upload-url endpoint
  // returns a clear STORAGE_NOT_CONFIGURED error rather than the app failing
  // to boot; every other Faz 2 endpoint works without it.
  STORAGE_ENDPOINT: emptyToUndefined(z.url().optional()),
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_BUCKET: emptyToUndefined(z.string().optional()),
  STORAGE_ACCESS_KEY_ID: emptyToUndefined(z.string().optional()),
  STORAGE_SECRET_ACCESS_KEY: emptyToUndefined(z.string().optional()),
  STORAGE_PUBLIC_BASE_URL: emptyToUndefined(z.url().optional()),

  // Faz 6: translation. Left unset, `/translate` returns a clear
  // TRANSLATION_NOT_CONFIGURED-style error; every other route still works.
  // The service-account key's *content* goes here (not a file path like
  // Google's own `GOOGLE_APPLICATION_CREDENTIALS` convention expects) — a
  // container secret store holds strings, not files. Same reasoning as
  // APPLE_PRIVATE_KEY, the other JWT-signing credential in this file.
  GOOGLE_TRANSLATE_PROJECT_ID: emptyToUndefined(z.string().optional()),
  GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: emptyToUndefined(z.string().optional()),

  // Faz 7: billing. REVENUECAT_WEBHOOK_AUTH_HEADER is a shared secret you set
  // as the "Authorization header value" in the RevenueCat dashboard's
  // webhook config — RevenueCat doesn't sign webhooks cryptographically, this
  // literal-string check is the actual defense. REVENUECAT_SECRET_API_KEY is
  // for the reconciliation path (POST /billing/refresh) when a webhook is
  // late or lost. Left unset, both routes fail clearly; nothing else depends
  // on them — entitlement itself already lives in `profiles.entitlement`.
  REVENUECAT_SECRET_API_KEY: emptyToUndefined(z.string().optional()),
  REVENUECAT_WEBHOOK_AUTH_HEADER: emptyToUndefined(z.string().optional()),

  /**
   * Replaces RevenueCat with an in-process stand-in, so a purchase can be
   * driven end to end without an App Store or Play product existing — see
   * `docs/billing-testing.md`. It takes precedence over
   * `REVENUECAT_SECRET_API_KEY`: a machine that has both is a machine where a
   * leftover real key would otherwise silently win, and the surprise there
   * runs the wrong way round.
   *
   * `loadEnv` refuses to return with this set under `NODE_ENV=production`.
   * That check is the whole safety story — everything else about this flag is
   * a convenience, but a production API that hands out Pro to anyone who asks
   * is not a bug you find in review.
   */
  REVENUECAT_FAKE_STORE: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),

  // Faz 2: username claim. Must match what the ETL used to hash legacy
  // emails into handleReservations.legacyEmailHash, or nothing ever matches.
  LEGACY_EMAIL_HASH_SALT: emptyToUndefined(z.string().optional()),

  // Faz 2 (one-off): scripts/migrate-appwrite.ts only. Never read by the
  // running server — Appwrite BaaS itself is already shut down (30 Sep
  // 2025); this is solely for pointing the ETL at the old project's REST API
  // to pull profile/handle data out.
  APPWRITE_ENDPOINT: emptyToUndefined(z.url().optional()),
  APPWRITE_PROJECT_ID: emptyToUndefined(z.string().optional()),
  APPWRITE_API_KEY: emptyToUndefined(z.string().optional()),

  SENTRY_DSN: emptyToUndefined(z.string().optional()),

  /**
   * Hard kill switch. Checked before the database-backed flag, because it is
   * what you reach for when the database itself is the problem.
   */
  MAINTENANCE_MODE: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).default(false),
  /** User ids allowed through the maintenance gate, to verify a fix before reopening. */
  ADMIN_USER_IDS: z
    .preprocess(
      (v) => (typeof v === 'string' && v.length > 0 ? v.split(',').map((s) => s.trim()) : []),
      z.array(z.string()),
    )
    .default([]),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }

  // Refusing to boot, rather than ignoring the flag, because the two failures
  // look identical from outside and only one of them is safe: an API that
  // quietly dropped the flag would keep serving real billing while whoever set
  // it believes they are on the fake store.
  if (parsed.data.NODE_ENV === 'production' && parsed.data.REVENUECAT_FAKE_STORE) {
    throw new Error(
      'Invalid environment:\n  REVENUECAT_FAKE_STORE: refused under NODE_ENV=production — it grants entitlement with no purchase behind it',
    )
  }

  return parsed.data
}
