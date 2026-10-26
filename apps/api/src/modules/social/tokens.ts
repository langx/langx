import { createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { jsonOrThrow } from './publish'

/**
 * TikTok's tokens, kept where every API machine can see the latest.
 *
 * An access token lasts a day, so every post starts with a refresh — and the
 * refresh may answer with a **new** refresh token, after which TikTok says to
 * use that one. The environment cannot learn it, so the newest is written
 * here, and the environment's is only the seed.
 *
 * `seed` is a hash of the refresh token the environment held when this row
 * was written. Setting a new one there — Behic authorising again — changes
 * the hash, and the row is started over from it rather than going on with a
 * token from the grant that was replaced.
 */
export interface SocialToken {
  _id: 'tiktok'
  seed: string
  refreshToken: string
  accessToken: string
  accessExpiresAt: Date
  updatedAt: Date
}

/** An access token this close to its end is refreshed rather than used. */
const EXPIRY_MARGIN_MS = 10 * 60 * 1000

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'

export interface TikTokCredentials {
  clientKey: string
  clientSecret: string
  /** `TIKTOK_REFRESH_TOKEN`: the grant's first refresh token. */
  refreshToken: string
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function tiktokAccessToken(
  db: Db,
  credentials: TikTokCredentials,
  fetch: typeof globalThis.fetch,
  now: Date = new Date(),
): Promise<string> {
  const tokens = db.collection<SocialToken>(COLLECTIONS.socialTokens)
  const seed = hash(credentials.refreshToken)
  const stored = await tokens.findOne({ _id: 'tiktok' })
  const current = stored?.seed === seed ? stored : null

  if (current && current.accessExpiresAt.getTime() - EXPIRY_MARGIN_MS > now.getTime()) {
    return current.accessToken
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: credentials.clientKey,
      client_secret: credentials.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: current?.refreshToken ?? credentials.refreshToken,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  const body = await jsonOrThrow<{
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }>(response, 'tiktok token')
  if (!body.access_token) {
    throw new Error(
      `tiktok token: ${body.error ?? 'no access token'} ${body.error_description ?? ''}`,
    )
  }

  await tokens.updateOne(
    { _id: 'tiktok' },
    {
      $set: {
        seed,
        refreshToken: body.refresh_token ?? current?.refreshToken ?? credentials.refreshToken,
        accessToken: body.access_token,
        accessExpiresAt: new Date(now.getTime() + (body.expires_in ?? 0) * 1000),
        updatedAt: now,
      },
    },
    { upsert: true },
  )
  return body.access_token
}
