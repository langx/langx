import { captionWithHashtags } from '@langx/shared'
import { createGraph } from '../growth/graph'
import {
  beforePublishing,
  jsonOrThrow,
  pollUntil,
  SocialPublishError,
  whilePublishing,
  type PollOptions,
  type SocialAdapter,
} from './publish'

/**
 * Instagram Reels on @langxapp, through "Instagram API with Instagram login" —
 * the same app and the same token as comment-to-DM (`growth/graph.ts`), which
 * is why it speaks to `graph.instagram.com`. The token must have been granted
 * `instagram_business_content_publish`; the one made for the DMs alone was
 * not, so the account is authorised once more with it added.
 *
 * Three calls: a container that Instagram fills by fetching the video from
 * our bucket, a wait until that container says FINISHED, then the publish.
 * Only the last one posts.
 */
const GRAPH = 'https://graph.instagram.com/v21.0'

export interface InstagramConfig {
  token: string
  fallbackAccountId?: string
  fetch?: typeof globalThis.fetch
  poll: PollOptions
}

export function createInstagramAdapter({
  token,
  fallbackAccountId,
  fetch = globalThis.fetch,
  poll,
}: InstagramConfig): SocialAdapter {
  const graph = createGraph({ token, fetch, ...(fallbackAccountId ? { fallbackAccountId } : {}) })
  const auth = { authorization: `Bearer ${token}` }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${GRAPH}${path}`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    return jsonOrThrow<T>(response, `instagram ${path.split('/').pop() ?? path}`)
  }

  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${GRAPH}${path}`, {
      headers: auth,
      signal: AbortSignal.timeout(60_000),
    })
    return jsonOrThrow<T>(response, 'instagram read')
  }

  return {
    platform: 'instagram',
    async publish(input) {
      const accountId = await beforePublishing('instagram account', () => graph.accountId())

      const container = await beforePublishing('instagram container', () =>
        post<{ id: string }>(`/${accountId}/media`, {
          media_type: 'REELS',
          video_url: input.videoUrl,
          cover_url: input.coverUrl,
          caption: captionWithHashtags(input.content),
          share_to_feed: true,
        }),
      )

      // EXPIRED and ERROR are final for this container, and an unpublished
      // container is never seen by anybody — a new one next time is safe.
      const status = await beforePublishing('instagram processing', () =>
        pollUntil(async () => {
          const { status_code: code } = await get<{ status_code?: string }>(
            `/${container.id}?fields=status_code`,
          )
          if (code === 'FINISHED' || code === 'ERROR' || code === 'EXPIRED') return code
          return undefined
        }, poll),
      )
      if (status !== 'FINISHED') {
        throw new SocialPublishError(
          status
            ? `instagram processing: the container ended ${status}`
            : 'instagram processing: still not finished, nothing was posted',
          true,
        )
      }

      const media = await whilePublishing('instagram publish', () =>
        post<{ id: string }>(`/${accountId}/media_publish`, { creation_id: container.id }),
      )

      // It is out. Nothing below may fail the row: the worst a failure here
      // costs is a link or a comment, and either can be added by hand.
      const url = await get<{ permalink?: string }>(`/${media.id}?fields=permalink`).then(
        (answer) => answer.permalink ?? null,
        () => null,
      )
      let note: string | null = null
      if (input.firstComment) {
        try {
          await post(`/${media.id}/comments`, { message: input.firstComment })
        } catch (caught) {
          const reason = caught instanceof Error ? caught.message : String(caught)
          note = `Posted, but the first comment failed: ${reason}`.slice(0, 300)
        }
      }
      return { id: media.id, url, note }
    },
  }
}
