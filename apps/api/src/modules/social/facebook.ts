import { captionWithHashtags } from '@langx/shared'
import { beforePublishing, jsonOrThrow, whilePublishing, type SocialAdapter } from './publish'

/**
 * Reels on the LangX Facebook Page, through the Page's `video_reels` edge:
 * start an upload session, hand Facebook the video's URL to fetch, then
 * finish with `video_state=PUBLISHED`. Only the finish posts — a session
 * that is started and never finished is discarded by Facebook unseen.
 *
 * A Page access token, which does not expire when it is derived from a
 * long-lived user token, with `pages_manage_posts`, `pages_read_engagement`
 * and `pages_show_list`. Sent as a header, never in the query string.
 */
const GRAPH = 'https://graph.facebook.com/v21.0'
const UPLOAD = 'https://rupload.facebook.com/video-upload/v21.0'

export interface FacebookConfig {
  pageId: string
  token: string
  fetch?: typeof globalThis.fetch
}

export function createFacebookAdapter({
  pageId,
  token,
  fetch = globalThis.fetch,
}: FacebookConfig): SocialAdapter {
  async function reels<T>(body: Record<string, string>): Promise<T> {
    const response = await fetch(`${GRAPH}/${pageId}/video_reels`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    return jsonOrThrow<T>(response, `facebook ${body.upload_phase ?? 'reels'}`)
  }

  return {
    platform: 'facebook',
    async publish(input) {
      const session = await beforePublishing('facebook start', () =>
        reels<{ video_id: string; upload_url?: string }>({ upload_phase: 'start' }),
      )

      await beforePublishing('facebook upload', async () => {
        const response = await fetch(session.upload_url ?? `${UPLOAD}/${session.video_id}`, {
          method: 'POST',
          headers: { authorization: `OAuth ${token}`, file_url: input.videoUrl },
          signal: AbortSignal.timeout(2 * 60 * 1000),
        })
        const answer = await jsonOrThrow<{ success?: boolean }>(response, 'facebook upload')
        if (answer.success !== true) throw new Error('facebook upload did not report success')
      })

      await whilePublishing('facebook finish', async () => {
        const answer = await reels<{ success?: boolean }>({
          upload_phase: 'finish',
          video_id: session.video_id,
          video_state: 'PUBLISHED',
          description: captionWithHashtags(input.content),
        })
        if (answer.success !== true) throw new Error('facebook finish did not report success')
      })

      return {
        id: session.video_id,
        url: `https://www.facebook.com/reel/${session.video_id}`,
      }
    },
  }
}
