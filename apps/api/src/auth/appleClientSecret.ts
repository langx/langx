import { importPKCS8, SignJWT } from 'jose'

const APPLE_AUDIENCE = 'https://appleid.apple.com'
// Apple allows at most ~6 months; stay a day under that so a token minted
// right at boot never gets rejected as over the limit by clock skew.
const APPLE_MAX_AGE_SECONDS = 15_777_000 - 86_400

export interface AppleClientSecretConfig {
  teamId: string
  keyId: string
  /** Services ID — same value passed as AppleOptions.clientId. */
  servicesId: string
  /** PEM-encoded .p8 private key from the Sign in with Apple key. */
  privateKeyPem: string
}

/**
 * Apple never hands out a client secret directly — Sign in with Apple wants a
 * short-lived ES256 JWT you sign yourself with a Sign in with Apple private
 * key. Generated once at server boot (a fresh process picks up a fresh
 * token), which is the standard approach: the token easily outlives a single
 * deploy, and regenerating per-request would just resign an identical claim
 * set on every OAuth attempt for no benefit.
 */
export async function generateAppleClientSecret(config: AppleClientSecretConfig): Promise<string> {
  const privateKey = await importPKCS8(config.privateKeyPem, 'ES256')
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + APPLE_MAX_AGE_SECONDS)
    .setAudience(APPLE_AUDIENCE)
    .setSubject(config.servicesId)
    .sign(privateKey)
}
