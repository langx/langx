import { SOCIAL_PLATFORMS, type SocialPlatform } from '@langx/shared'
import type { Db } from 'mongodb'
import type { Env } from '../../env'
import { createFacebookAdapter } from './facebook'
import { createInstagramAdapter } from './instagram'
import type { PollOptions, SocialAdapter } from './publish'
import { createTikTokAdapter } from './tiktok'
import { createYouTubeAdapter } from './youtube'

/**
 * The environment each platform needs before it can post. A platform missing
 * any of these has no adapter, and a row of it that comes due fails with
 * this list — an optional service degrading, never the boot failing.
 */
export const SOCIAL_CREDENTIALS = {
  instagram: ['IG_PAGE_TOKEN'],
  facebook: ['FB_PAGE_ID', 'FB_PAGE_TOKEN'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REFRESH_TOKEN'],
} as const satisfies Record<SocialPlatform, readonly (keyof Env)[]>

export function socialConnected(env: Env): Record<SocialPlatform, boolean> {
  const connected = {} as Record<SocialPlatform, boolean>
  for (const platform of SOCIAL_PLATFORMS) {
    connected[platform] = SOCIAL_CREDENTIALS[platform].every((key) => Boolean(env[key]))
  }
  return connected
}

export type SocialAdapters = Partial<Record<SocialPlatform, SocialAdapter>>

export interface SocialAdapterOptions {
  fetch?: typeof globalThis.fetch
  /** How Instagram and TikTok wait while they process a video. */
  poll?: PollOptions
}

/**
 * Five seconds apart, for five minutes: a twelve-second video is normally
 * ready in well under one, and the scheduler's pass waits for it.
 */
const DEFAULT_POLL: PollOptions = {
  everyMs: 5_000,
  timeoutMs: 5 * 60 * 1000,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

export function createSocialAdapters(
  env: Env,
  db: Db,
  options: SocialAdapterOptions = {},
): SocialAdapters {
  const poll = options.poll ?? DEFAULT_POLL
  const fetch = options.fetch ?? globalThis.fetch
  const adapters: SocialAdapters = {}

  if (env.IG_PAGE_TOKEN) {
    adapters.instagram = createInstagramAdapter({
      token: env.IG_PAGE_TOKEN,
      ...(env.IG_ACCOUNT_ID ? { fallbackAccountId: env.IG_ACCOUNT_ID } : {}),
      fetch,
      poll,
    })
  }
  if (env.FB_PAGE_ID && env.FB_PAGE_TOKEN) {
    adapters.facebook = createFacebookAdapter({
      pageId: env.FB_PAGE_ID,
      token: env.FB_PAGE_TOKEN,
      fetch,
    })
  }
  if (env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.YOUTUBE_REFRESH_TOKEN) {
    adapters.youtube = createYouTubeAdapter({
      clientId: env.YOUTUBE_CLIENT_ID,
      clientSecret: env.YOUTUBE_CLIENT_SECRET,
      refreshToken: env.YOUTUBE_REFRESH_TOKEN,
      fetch,
    })
  }
  if (env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REFRESH_TOKEN) {
    adapters.tiktok = createTikTokAdapter({
      db,
      credentials: {
        clientKey: env.TIKTOK_CLIENT_KEY,
        clientSecret: env.TIKTOK_CLIENT_SECRET,
        refreshToken: env.TIKTOK_REFRESH_TOKEN,
      },
      mode: env.TIKTOK_POST_MODE,
      fetch,
      poll,
    })
  }
  return adapters
}
