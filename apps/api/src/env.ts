import { z } from 'zod'

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema)
}

/**
 * Fail fast and loudly on boot rather than at the first request that needs a
 * missing variable. Everything optional here belongs to a later phase; the
 * required set is what Faz 0 needs to serve `/health`.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required — see .env.example'),
  MONGODB_DB: z.string().min(1).default('langx_dev'),

  // Faz 1+ — blank in .env.example on purpose, so '' must mean "unset", not
  // "a 0-character secret". z's .optional() only recognises `undefined`.
  BETTER_AUTH_SECRET: emptyToUndefined(z.string().min(32).optional()),
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
