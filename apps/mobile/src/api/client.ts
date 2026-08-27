import { apiFetch } from './apiFetch'

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
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new ApiRequestError(response.status, body as { code?: string; message?: string })
  }
  return body as T
}

export const api = {
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
