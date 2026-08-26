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
