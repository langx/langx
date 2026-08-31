import { apiFetch } from './apiFetch'
import { ERROR_CODES } from '@langx/shared'
import { router } from 'expo-router'
import { currentLocale } from '../i18n/runtime'

export class ApiRequestError extends Error {
  readonly code: string
  readonly status: number
  /** Present on UPGRADE_REQUIRED — tells the UI which paywall to open. */
  readonly feature?: string
  /** Present on QUOTA_EXCEEDED — ISO timestamp the next slot frees up. */
  readonly retryAt?: string

  constructor(
    status: number,
    body: { code?: string; message?: string; feature?: string; retryAt?: string },
  ) {
    // English on purpose: this is what lands in a log or a crash report, and
    // a screen that shows it to a user is a screen with a bug — every caller
    // branches on `code` and words its own message.
    super(body.message ?? 'Request failed')
    this.name = 'ApiRequestError'
    this.status = status
    this.code = body.code ?? 'INTERNAL'
    if (body.feature) this.feature = body.feature
    if (body.retryAt) this.retryAt = body.retryAt
  }
}

/**
 * Every call to our own API goes through here, so the error contract the
 * server documents (`ERROR_CODES`) survives the network boundary as a typed
 * `code` the UI can branch on — a paywall for UPGRADE_REQUIRED, a quota sheet
 * for QUOTA_EXCEEDED — instead of a stringly-typed message nobody can match on.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      // What language to word anything the server sends back in. Only the
      // emails use it today — the API's own errors are codes — but it costs
      // one header and it is the only signal a signed-out request carries.
      'accept-language': currentLocale(),
      ...init.headers,
    },
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const error = new ApiRequestError(response.status, body as { code?: string; message?: string })
    /*
     * The third net under `requireAccount`.
     *
     * The gate is meant to be applied at the call site, where the screen knows
     * what the person was trying to do. This catches the one that forgot: a
     * guest gets the sign-up screen rather than an error toast, which is the
     * same outcome by a duller route. The same pattern the socket rate limiter
     * uses — one place decides, the transport catches the leak.
     */
    if (error.code === ERROR_CODES.GUEST_ACCOUNT) router.push('/(auth)/sign-up')
    throw error
  }
  return body as T
}

export const api = {
  request,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
