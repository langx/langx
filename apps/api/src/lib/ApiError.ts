import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '@langx/shared'

/**
 * What a repository function throws for a domain-level failure (handle
 * taken, underage, quota exceeded, ...). The global error handler in app.ts
 * reads `.code`/`.statusCode` straight off this — repositories never touch
 * Fastify's `reply` object themselves (see CONTRIBUTING.md's "handlers never
 * query collections directly" rule; the mirror of that is repositories never
 * reach into the HTTP layer either).
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly feature?: string
  readonly retryAt?: string

  constructor(code: ErrorCode, message?: string, extra?: { feature?: string; retryAt?: string }) {
    super(message ?? code)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = ERROR_STATUS[code]
    if (extra?.feature !== undefined) this.feature = extra.feature
    if (extra?.retryAt !== undefined) this.retryAt = extra.retryAt
  }

  toBody(): ApiErrorBody {
    const body: ApiErrorBody = { code: this.code, message: this.message }
    if (this.feature !== undefined) body.feature = this.feature
    if (this.retryAt !== undefined) body.retryAt = this.retryAt
    return body
  }
}
