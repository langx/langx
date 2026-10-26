import { captionWithHashtags } from '@langx/shared'
import type { Db } from 'mongodb'
import {
  beforePublishing,
  downloadVideo,
  jsonOrThrow,
  pollUntil,
  SocialPublishError,
  whilePublishing,
  type PollOptions,
  type SocialAdapter,
} from './publish'
import { tiktokAccessToken, type TikTokCredentials } from './tokens'

/**
 * TikTok, through the Content Posting API, in one of two modes.
 *
 * **`inbox`, the default.** The video is uploaded as a draft to the
 * account's TikTok inbox (`video.upload` scope) and Behic finishes the post
 * in the app with one tap, pasting the caption the panel shows — the upload
 * endpoint takes no caption. This is the mode that works before TikTok
 * audits the app: an unaudited app may direct-post only `SELF_ONLY`, which
 * nobody but the account can see.
 *
 * **`direct`, after the audit.** `TIKTOK_POST_MODE=direct` posts publicly
 * with the caption (`video.publish` scope). It asks `creator_info` first, as
 * TikTok requires, and refuses rather than posting privately when the
 * account is not offered `PUBLIC_TO_EVERYONE` — a private post on the
 * calendar's day would look like a post and reach nobody.
 *
 * Both upload the bytes (`FILE_UPLOAD`) rather than having TikTok fetch the
 * URL: `PULL_FROM_URL` needs media.langx.io verified as ours in TikTok's
 * portal, one more setup step for nothing a twelve-second file needs.
 */
const API = 'https://open.tiktokapis.com/v2/post/publish'

/**
 * TikTok's post ids are 64-bit integers sent as bare JSON numbers, past what
 * a JavaScript number holds exactly: parsed as they come, the last digits are
 * rounded away and the post's link opens somebody else's video. Every integer
 * too long to be exact is quoted before parsing, so it stays as written.
 */
function keepLongIds(text: string): unknown {
  return JSON.parse(text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"'))
}

/** TikTok takes one chunk up to this size; a day's video is a small fraction of it. */
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024

export type TikTokPostMode = 'inbox' | 'direct'

export interface TikTokConfig {
  db: Db
  credentials: TikTokCredentials
  mode: TikTokPostMode
  fetch?: typeof globalThis.fetch
  poll: PollOptions
}

interface TikTokAnswer<T> {
  data?: T
  error?: { code?: string; message?: string }
}

export function createTikTokAdapter({
  db,
  credentials,
  mode,
  fetch = globalThis.fetch,
  poll,
}: TikTokConfig): SocialAdapter {
  async function call<T>(token: string, path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    const answer = await jsonOrThrow<TikTokAnswer<T>>(response, `tiktok ${path}`, keepLongIds)
    if (answer.error?.code && answer.error.code !== 'ok') {
      throw new Error(`tiktok ${path}: ${answer.error.code} ${answer.error.message ?? ''}`)
    }
    if (!answer.data) throw new Error(`tiktok ${path} answered without data`)
    return answer.data
  }

  return {
    platform: 'tiktok',
    async publish(input) {
      const token = await beforePublishing('tiktok token', () =>
        tiktokAccessToken(db, credentials, fetch),
      )
      const bytes = await beforePublishing('tiktok download', () =>
        downloadVideo(fetch, input.videoUrl),
      )
      if (bytes.byteLength > MAX_SINGLE_CHUNK) {
        throw new SocialPublishError(
          'tiktok: the video is over 64 MB, too big for one chunk',
          false,
        )
      }
      const sourceInfo = {
        source: 'FILE_UPLOAD',
        video_size: bytes.byteLength,
        chunk_size: bytes.byteLength,
        total_chunk_count: 1,
      }

      let username: string | null = null
      let init: { publish_id: string; upload_url?: string }
      if (mode === 'direct') {
        const creator = await beforePublishing('tiktok creator info', () =>
          call<{ creator_username?: string; privacy_level_options?: string[] }>(
            token,
            '/creator_info/query/',
            {},
          ),
        )
        if (!creator.privacy_level_options?.includes('PUBLIC_TO_EVERYONE')) {
          throw new SocialPublishError(
            'tiktok: this app may not post publicly yet (not audited) — set TIKTOK_POST_MODE=inbox',
            false,
          )
        }
        username = creator.creator_username ?? null
        init = await beforePublishing('tiktok init', () =>
          call(token, '/video/init/', {
            post_info: {
              title: captionWithHashtags(input.content),
              privacy_level: 'PUBLIC_TO_EVERYONE',
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
              // Our own account promoting our own app: TikTok's "your brand"
              // disclosure, not a paid partnership.
              brand_content_toggle: false,
              brand_organic_toggle: true,
            },
            source_info: sourceInfo,
          }),
        )
      } else {
        init = await beforePublishing('tiktok init', () =>
          call(token, '/inbox/video/init/', { source_info: sourceInfo }),
        )
      }
      const uploadUrl = init.upload_url
      if (!uploadUrl)
        throw new SocialPublishError('tiktok init answered without an upload URL', true)

      // From the moment the bytes are in, a direct post will go out by itself.
      const upload = mode === 'direct' ? whilePublishing : beforePublishing
      await upload('tiktok upload', async () => {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'content-type': 'video/mp4',
            'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
          },
          body: bytes,
          signal: AbortSignal.timeout(5 * 60 * 1000),
        })
        if (!response.ok) throw new Error(`tiktok upload answered ${response.status}`)
      })

      let status: {
        status?: string
        fail_reason?: string
        publicaly_available_post_id?: (string | number)[]
      }
      try {
        status =
          (await pollUntil(async () => {
            const answer = await call<typeof status>(token, '/status/fetch/', {
              publish_id: init.publish_id,
            })
            const done = ['SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE', 'FAILED']
            return done.includes(answer.status ?? '') ? answer : undefined
          }, poll)) ?? {}
      } catch {
        status = {}
      }

      if (status.status === 'FAILED') {
        // TikTok's own word: only `internal` is worth another go.
        throw new SocialPublishError(
          `tiktok: ${status.fail_reason ?? 'failed'}`,
          status.fail_reason === 'internal',
        )
      }

      if (mode === 'inbox') {
        return {
          id: init.publish_id,
          url: null,
          note:
            status.status === 'SEND_TO_USER_INBOX' || status.status === 'PUBLISH_COMPLETE'
              ? 'In the TikTok inbox: open TikTok and post it with the caption shown here.'
              : 'Uploaded; TikTok was still processing it. It will arrive in the TikTok inbox.',
        }
      }

      if (status.status !== 'PUBLISH_COMPLETE') {
        throw new SocialPublishError(
          'tiktok: uploaded but not confirmed as posted — check the account before retrying',
          false,
        )
      }
      const postId = status.publicaly_available_post_id?.[0]
      const id = postId === undefined ? init.publish_id : String(postId)
      return {
        id,
        url:
          postId !== undefined && username
            ? `https://www.tiktok.com/@${username}/video/${id}`
            : null,
      }
    },
  }
}
