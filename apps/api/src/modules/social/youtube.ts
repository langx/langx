import {
  beforePublishing,
  downloadVideo,
  jsonOrThrow,
  SocialPublishError,
  whilePublishing,
  type SocialAdapter,
} from './publish'

/**
 * YouTube Shorts, through the Data API v3's `videos.insert` as a resumable
 * upload. YouTube will not fetch a URL, so the bytes come down from our
 * bucket and go up again; a day's video is a few megabytes, and one request
 * carries all of it.
 *
 * The channel's OAuth refresh token, minted once with the
 * `youtube.upload` scope. Google does not rotate it, so the environment is
 * the only place it lives — but it dies after seven days if the consent
 * screen is left in "Testing", which is why `docs/social-autoposting.md` says
 * to publish it first.
 *
 * **Uploads stay private until Google audits the project.** A video inserted
 * by a Google Cloud project that has not passed the YouTube API audit is
 * locked to private whatever `privacyStatus` says. This sends `public`, so
 * the day the audit passes nothing here changes; until then the row is
 * marked published with a note, and the video waits on the channel for
 * somebody to make it public by hand.
 */
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'

/** Film & Animation. */
const CATEGORY_ID = '1'

export interface YouTubeConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  fetch?: typeof globalThis.fetch
}

export function createYouTubeAdapter({
  clientId,
  clientSecret,
  refreshToken,
  fetch = globalThis.fetch,
}: YouTubeConfig): SocialAdapter {
  async function accessToken(): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const body = await jsonOrThrow<{ access_token?: string }>(response, 'google token')
    if (!body.access_token) throw new Error('google token answered without an access token')
    return body.access_token
  }

  return {
    platform: 'youtube',
    async publish(input) {
      const token = await beforePublishing('youtube token', accessToken)
      const bytes = await beforePublishing('youtube download', () =>
        downloadVideo(fetch, input.videoUrl),
      )

      const session = await beforePublishing('youtube start', async () => {
        const response = await fetch(UPLOAD_URL, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json; charset=UTF-8',
            'x-upload-content-length': String(bytes.byteLength),
            'x-upload-content-type': 'video/mp4',
          },
          body: JSON.stringify({
            snippet: {
              title: input.content.title ?? '',
              description: input.content.description ?? '',
              tags: input.content.tags ?? [],
              categoryId: CATEGORY_ID,
            },
            status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
          }),
          signal: AbortSignal.timeout(60_000),
        })
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(`youtube start answered ${response.status} ${body.slice(0, 300)}`)
        }
        // The session's answer is its Location header; the body is empty.
        const location = response.headers.get('location')
        if (!location) throw new Error('youtube start answered without an upload location')
        return location
      })

      const video = await whilePublishing('youtube upload', async () => {
        const response = await fetch(session, {
          method: 'PUT',
          headers: { 'content-type': 'video/mp4' },
          body: bytes,
          signal: AbortSignal.timeout(5 * 60 * 1000),
        })
        return jsonOrThrow<{ id?: string; status?: { privacyStatus?: string } }>(
          response,
          'youtube upload',
        )
      })
      if (!video.id) {
        throw new SocialPublishError(
          'youtube upload answered without a video id — it may have posted: check the channel before retrying',
          false,
        )
      }

      return {
        id: video.id,
        url: `https://www.youtube.com/shorts/${video.id}`,
        note:
          video.status?.privacyStatus === 'public'
            ? null
            : 'Uploaded as private: the Google Cloud project has not passed the YouTube API audit yet.',
      }
    },
  }
}
