import { importPKCS8, SignJWT } from 'jose'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/cloud-translation'
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const TOKEN_LIFETIME_SECONDS = 3600
/** Refresh a little before actual expiry so an in-flight request never races the deadline. */
const REFRESH_MARGIN_MS = 60_000

export interface GoogleServiceAccount {
  client_email: string
  private_key: string
}

/**
 * `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON` holds the full service-account key
 * file content, not a path — Railway/Render secret stores hold strings, not
 * files, and a path (`GOOGLE_APPLICATION_CREDENTIALS`, the Google SDK
 * convention) would need a file to exist on a container that doesn't have
 * one. This is the same pragmatic choice `APPLE_PRIVATE_KEY` already makes
 * for the other JWT-signing credential in this codebase.
 */
export function parseServiceAccountJson(json: string): GoogleServiceAccount {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON is not valid JSON')
  }
  const record = parsed as Record<string, unknown>
  if (typeof record.client_email !== 'string' || typeof record.private_key !== 'string') {
    throw new Error('GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON is missing client_email or private_key')
  }
  return { client_email: record.client_email, private_key: record.private_key }
}

async function signAssertion(account: GoogleServiceAccount): Promise<string> {
  const privateKey = await importPKCS8(account.private_key, 'RS256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(account.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
    .sign(privateKey)
}

interface AccessToken {
  token: string
  expiresAt: number
}

/**
 * The service-account "JWT Bearer" OAuth2 flow — sign a short-lived
 * assertion (above), trade it for an access token. Same shape as Apple's
 * self-signed client secret (auth/appleClientSecret.ts), but this one ends
 * in a real network round trip rather than a value used as-is.
 */
async function fetchAccessToken(account: GoogleServiceAccount): Promise<AccessToken> {
  const assertion = await signAssertion(account)
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: GRANT_TYPE, assertion }),
  })
  if (!response.ok) {
    throw new Error(
      `Google OAuth2 token exchange failed (${response.status}): ${await response.text()}`,
    )
  }
  const body = (await response.json()) as { access_token: string; expires_in: number }
  return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
}

/** Memoizes the access token across calls so a translation-heavy minute doesn't re-mint one per request. */
export function createAccessTokenCache(account: GoogleServiceAccount): () => Promise<string> {
  let cached: AccessToken | null = null

  return async function getAccessToken(): Promise<string> {
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.token
    cached = await fetchAccessToken(account)
    return cached.token
  }
}
