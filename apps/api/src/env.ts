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
  return parsed.data
}
