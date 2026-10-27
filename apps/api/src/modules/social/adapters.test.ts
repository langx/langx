import type { Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { loadEnv } from '../../env'
import { createSocialAdapters, socialConnected } from './adapters'
import { createFacebookAdapter } from './facebook'
import { createInstagramAdapter } from './instagram'
import { SocialPublishError, type PollOptions, type SocialPublishInput } from './publish'
import { createTikTokAdapter } from './tiktok'
import { createYouTubeAdapter } from './youtube'

/**
 * Every platform against a scripted `fetch`. Nothing here reaches a network:
 * the point is the order of the calls and which failures may be retried,
 * because the one thing worse than a missing day is the same day twice.
 */

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

type Reply = (call: Call) => Response | Promise<Response>

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

/**
 * A `fetch` that answers from `routes` — the first whose key the URL
 * contains — and records every call. A route given as an array answers its
 * replies in turn, then repeats the last.
 */
function scripted(routes: [string, Reply | Reply[]][]) {
  const calls: Call[] = []
  const turns = new Map<string, number>()
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers = Object.fromEntries(new Headers(init.headers).entries())
    let body: unknown = init.body
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    } else if (init.body instanceof URLSearchParams) {
      body = Object.fromEntries(init.body.entries())
    }
    const call: Call = { method: init.method ?? 'GET', url, headers, body }
    calls.push(call)
    const route = routes.find(([key]) => url.includes(key))
    if (!route) return new Response('no route', { status: 404 })
    const [key, reply] = route
    if (!Array.isArray(reply)) return reply(call)
    const turn = turns.get(key) ?? 0
    turns.set(key, turn + 1)
    const answer = reply[Math.min(turn, reply.length - 1)]
    if (!answer) throw new Error(`no reply for ${key}`)
    return answer(call)
  }
  return { fetch, calls }
}

const poll: PollOptions = { everyMs: 1, timeoutMs: 5, sleep: () => Promise.resolve() }

const VIDEO = 'https://media.langx.io/venus/v1/en/venus-day001-en.mp4'
const BYTES = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])

function input(overrides: Partial<SocialPublishInput> = {}): SocialPublishInput {
  return {
    videoUrl: VIDEO,
    coverUrl: VIDEO.replace('.mp4', '.jpg'),
    lang: 'en',
    content: { caption: 'Day 1. Meet Venus.', hashtags: ['#LangXVenus', '#cats'] },
    firstComment: 'Say hi to Venus.',
    ...overrides,
  }
}

async function rejection(promise: Promise<unknown>): Promise<SocialPublishError> {
  const caught = await promise.then(
    () => null,
    (error: unknown) => error,
  )
  if (!(caught instanceof SocialPublishError)) throw new Error(`expected a SocialPublishError`)
  return caught
}

describe('Instagram Reels', () => {
  const routes = (overrides: [string, Reply | Reply[]][] = []): [string, Reply | Reply[]][] => [
    ...overrides,
    ['/me?fields=id', () => json({ id: 'ig-account' })],
    ['/ig-account/media_publish', () => json({ id: 'media-1' })],
    ['/ig-account/media', () => json({ id: 'container-1' })],
    [
      '/container-1?fields=status_code',
      [() => json({ status_code: 'IN_PROGRESS' }), () => json({ status_code: 'FINISHED' })],
    ],
    ['/media-1?fields=permalink', () => json({ permalink: 'https://www.instagram.com/reel/abc/' })],
    ['/media-1/comments', () => json({ id: 'comment-1' })],
  ]

  it('makes a container, waits for FINISHED, publishes, then comments', async () => {
    const { fetch, calls } = scripted(routes())
    const adapter = createInstagramAdapter({ token: 'ig-token', fetch, poll })

    const result = await adapter.publish(input())

    expect(result).toEqual({
      id: 'media-1',
      url: 'https://www.instagram.com/reel/abc/',
      note: null,
    })
    const order = calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)
    expect(order).toEqual([
      'GET /v21.0/me',
      'POST /v21.0/ig-account/media',
      'GET /v21.0/container-1',
      'GET /v21.0/container-1',
      'POST /v21.0/ig-account/media_publish',
      'GET /v21.0/media-1',
      'POST /v21.0/media-1/comments',
    ])
    expect(calls[1]?.body).toEqual({
      media_type: 'REELS',
      video_url: VIDEO,
      cover_url: VIDEO.replace('.mp4', '.jpg'),
      caption: 'Day 1. Meet Venus.\n\n#LangXVenus #cats',
      share_to_feed: true,
    })
    expect(calls[4]?.body).toEqual({ creation_id: 'container-1' })
    expect(calls[6]?.body).toEqual({ message: 'Say hi to Venus.' })
    // The token travels in a header, never in a URL that could be logged.
    expect(calls.every((call) => !call.url.includes('ig-token'))).toBe(true)
    expect(calls[1]?.headers.authorization).toBe('Bearer ig-token')
  })

  it('leaves the comment out when the slot has none', async () => {
    const { fetch, calls } = scripted(routes())
    await createInstagramAdapter({ token: 't', fetch, poll }).publish(input({ firstComment: null }))
    expect(calls.some((call) => call.url.includes('/comments'))).toBe(false)
  })

  it('may retry a container that ended in ERROR: nothing was posted', async () => {
    const { fetch, calls } = scripted(
      routes([['/container-1?fields=status_code', () => json({ status_code: 'ERROR' })]]),
    )
    const error = await rejection(
      createInstagramAdapter({ token: 't', fetch, poll }).publish(input()),
    )
    expect(error.retryable).toBe(true)
    expect(calls.some((call) => call.url.includes('media_publish'))).toBe(false)
  })

  it('may retry a container still processing when the wait runs out', async () => {
    const { fetch } = scripted(
      routes([['/container-1?fields=status_code', () => json({ status_code: 'IN_PROGRESS' })]]),
    )
    const error = await rejection(
      createInstagramAdapter({ token: 't', fetch, poll }).publish(input()),
    )
    expect(error.retryable).toBe(true)
  })

  it('never retries a publish call that failed: it may have gone out', async () => {
    const { fetch } = scripted(
      routes([['/ig-account/media_publish', () => new Response('boom', { status: 500 })]]),
    )
    const error = await rejection(
      createInstagramAdapter({ token: 't', fetch, poll }).publish(input()),
    )
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('check the account')
  })

  it('counts a post whose first comment failed as posted, and says so', async () => {
    const { fetch } = scripted(
      routes([['/media-1/comments', () => new Response('nope', { status: 400 })]]),
    )
    const result = await createInstagramAdapter({ token: 't', fetch, poll }).publish(input())
    expect(result.id).toBe('media-1')
    expect(result.note).toContain('first comment failed')
  })
})

describe('Facebook Page reels', () => {
  const routes = (finish: Reply = () => json({ success: true })): [string, Reply | Reply[]][] => [
    ['rupload.facebook.com', () => json({ success: true })],
    [
      '/page-1/video_reels',
      (call) =>
        (call.body as { upload_phase?: string }).upload_phase === 'start'
          ? json({
              video_id: 'video-9',
              upload_url: 'https://rupload.facebook.com/video-upload/v21.0/video-9',
            })
          : finish(call),
    ],
  ]

  it('starts, hands Facebook the URL, then finishes as PUBLISHED with the caption', async () => {
    const { fetch, calls } = scripted(routes())
    const result = await createFacebookAdapter({
      pageId: 'page-1',
      token: 'fb-token',
      fetch,
    }).publish(input())

    expect(result).toEqual({ id: 'video-9', url: 'https://www.facebook.com/reel/video-9' })
    expect(calls.map((call) => call.body)).toEqual([
      { upload_phase: 'start' },
      undefined,
      {
        upload_phase: 'finish',
        video_id: 'video-9',
        video_state: 'PUBLISHED',
        description: 'Day 1. Meet Venus.\n\n#LangXVenus #cats',
      },
    ])
    expect(calls[1]?.headers.file_url).toBe(VIDEO)
    expect(calls[1]?.headers.authorization).toBe('OAuth fb-token')
    expect(calls.every((call) => !call.url.includes('fb-token'))).toBe(true)
  })

  it('never retries a finish that failed', async () => {
    const { fetch } = scripted(routes(() => new Response('later', { status: 503 })))
    const error = await rejection(
      createFacebookAdapter({ pageId: 'page-1', token: 't', fetch }).publish(input()),
    )
    expect(error.retryable).toBe(false)
  })
})

describe('YouTube Shorts', () => {
  const youtube = {
    clientId: 'client',
    clientSecret: 'secret',
    refreshToken: 'refresh',
  }
  const routes = (upload: Reply): [string, Reply | Reply[]][] => [
    ['oauth2.googleapis.com/token', () => json({ access_token: 'yt-access', expires_in: 3599 })],
    [VIDEO, () => new Response(BYTES)],
    [
      'upload/youtube/v3/videos?uploadType=resumable',
      () =>
        new Response(null, {
          status: 200,
          headers: { location: 'https://upload.example/session-1' },
        }),
    ],
    ['upload.example/session-1', upload],
  ]

  it('refreshes, downloads, opens a resumable session and uploads the bytes into it', async () => {
    const { fetch, calls } = scripted(
      routes(() => json({ id: 'yt-1', status: { privacyStatus: 'private' } })),
    )
    const result = await createYouTubeAdapter({ ...youtube, fetch }).publish(
      input({ content: { title: 'Day 1 with Venus', description: 'Meet her.', tags: ['Venus'] } }),
    )

    expect(result.id).toBe('yt-1')
    expect(result.url).toBe('https://www.youtube.com/shorts/yt-1')
    // An unaudited project's upload stays private, and the row says why.
    expect(result.note).toContain('audit')
    expect(calls[0]?.body).toEqual({
      client_id: 'client',
      client_secret: 'secret',
      refresh_token: 'refresh',
      grant_type: 'refresh_token',
    })
    const session = calls[2]
    expect(session?.headers.authorization).toBe('Bearer yt-access')
    expect(session?.headers['x-upload-content-length']).toBe(String(BYTES.byteLength))
    expect(session?.body).toEqual({
      snippet: {
        title: 'Day 1 with Venus',
        description: 'Meet her.',
        tags: ['Venus'],
        categoryId: '1',
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    })
    expect(calls[3]?.method).toBe('PUT')
  })

  it('has no note once uploads come back public', async () => {
    const { fetch } = scripted(
      routes(() => json({ id: 'yt-2', status: { privacyStatus: 'public' } })),
    )
    const result = await createYouTubeAdapter({ ...youtube, fetch }).publish(
      input({ content: { title: 'T', description: 'D', tags: [] } }),
    )
    expect(result.note).toBeNull()
  })

  it('never retries an upload that broke: the video may exist', async () => {
    const { fetch } = scripted(routes(() => new Response('reset', { status: 502 })))
    const error = await rejection(
      createYouTubeAdapter({ ...youtube, fetch }).publish(
        input({ content: { title: 'T', description: 'D', tags: [] } }),
      ),
    )
    expect(error.retryable).toBe(false)
  })
})

describe('TikTok, and which accounts are connected', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_social_adapters_test')
    db = handle.db
  })

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await db.collection(COLLECTIONS.socialTokens).deleteMany({})
  })

  const credentials = { clientKey: 'key', clientSecret: 'secret', refreshToken: 'rft.first' }

  function routes(extra: [string, Reply | Reply[]][] = []): [string, Reply | Reply[]][] {
    let refreshes = 0
    return [
      ...extra,
      [
        '/v2/oauth/token/',
        () => {
          refreshes++
          return json({
            access_token: `act.${refreshes}`,
            refresh_token: `rft.rotated${refreshes}`,
            expires_in: 86_400,
          })
        },
      ],
      [VIDEO, () => new Response(BYTES)],
      [
        '/inbox/video/init/',
        () =>
          json({
            data: { publish_id: 'v_inbox_file~1', upload_url: 'https://upload.tiktok.example/1' },
            error: { code: 'ok' },
          }),
      ],
      [
        '/video/init/',
        () =>
          json({
            data: { publish_id: 'v_pub_file~1', upload_url: 'https://upload.tiktok.example/1' },
            error: { code: 'ok' },
          }),
      ],
      ['upload.tiktok.example', () => new Response(null, { status: 201 })],
      [
        '/status/fetch/',
        [
          () => json({ data: { status: 'PROCESSING_UPLOAD' }, error: { code: 'ok' } }),
          () => json({ data: { status: 'SEND_TO_USER_INBOX' }, error: { code: 'ok' } }),
        ],
      ],
    ]
  }

  it('sends the video to the inbox by default, and says the post is finished by hand', async () => {
    const { fetch, calls } = scripted(routes())
    const adapter = createTikTokAdapter({ db, credentials, mode: 'inbox', fetch, poll })

    const result = await adapter.publish(input())

    expect(result.id).toBe('v_inbox_file~1')
    expect(result.url).toBeNull()
    expect(result.note).toContain('TikTok inbox')
    const init = calls.find((call) => call.url.includes('/inbox/video/init/'))
    expect(init?.body).toEqual({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: BYTES.byteLength,
        chunk_size: BYTES.byteLength,
        total_chunk_count: 1,
      },
    })
    const upload = calls.find((call) => call.url.includes('upload.tiktok.example'))
    expect(upload?.headers['content-range']).toBe(
      `bytes 0-${BYTES.byteLength - 1}/${BYTES.byteLength}`,
    )
    expect(calls.some((call) => call.url.endsWith('/v2/post/publish/video/init/'))).toBe(false)
  })

  it('keeps the refresh token TikTok hands back, and uses it rather than the seed', async () => {
    const first = scripted(routes())
    await createTikTokAdapter({ db, credentials, mode: 'inbox', fetch: first.fetch, poll }).publish(
      input(),
    )
    // A day on, the access token has run out.
    await db
      .collection(COLLECTIONS.socialTokens)
      .updateOne({ _id: 'tiktok' as never }, { $set: { accessExpiresAt: new Date(0) } })

    const second = scripted(routes())
    await createTikTokAdapter({
      db,
      credentials,
      mode: 'inbox',
      fetch: second.fetch,
      poll,
    }).publish(input())
    const refresh = second.calls.find((call) => call.url.includes('/oauth/token/'))
    expect((refresh?.body as { refresh_token?: string }).refresh_token).toBe('rft.rotated1')
  })

  it('starts over from the environment when a new grant replaces the token there', async () => {
    const first = scripted(routes())
    await createTikTokAdapter({ db, credentials, mode: 'inbox', fetch: first.fetch, poll }).publish(
      input(),
    )
    const second = scripted(routes())
    await createTikTokAdapter({
      db,
      credentials: { ...credentials, refreshToken: 'rft.new-grant' },
      mode: 'inbox',
      fetch: second.fetch,
      poll,
    }).publish(input())
    const refresh = second.calls.find((call) => call.url.includes('/oauth/token/'))
    expect((refresh?.body as { refresh_token?: string }).refresh_token).toBe('rft.new-grant')
  })

  it('refuses to direct-post when the account may only post privately', async () => {
    const { fetch, calls } = scripted(
      routes([
        [
          '/creator_info/query/',
          () => json({ data: { privacy_level_options: ['SELF_ONLY'] }, error: { code: 'ok' } }),
        ],
      ]),
    )
    const error = await rejection(
      createTikTokAdapter({ db, credentials, mode: 'direct', fetch, poll }).publish(input()),
    )
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('TIKTOK_POST_MODE=inbox')
    expect(calls.some((call) => call.url.includes('upload.tiktok.example'))).toBe(false)
  })

  it('direct-posts publicly with the caption once the app is audited', async () => {
    const { fetch, calls } = scripted(
      routes([
        [
          '/creator_info/query/',
          () =>
            json({
              data: {
                creator_username: 'langxapp',
                privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
              },
              error: { code: 'ok' },
            }),
        ],
        [
          '/status/fetch/',
          () =>
            // As TikTok sends it: a 64-bit id as a bare number, which
            // `JSON.stringify` cannot write, so the body is written by hand.
            new Response(
              '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7311234567890123456]},"error":{"code":"ok"}}',
            ),
        ],
      ]),
    )
    const result = await createTikTokAdapter({
      db,
      credentials,
      mode: 'direct',
      fetch,
      poll,
    }).publish(input())
    expect(result).toEqual({
      id: '7311234567890123456',
      url: 'https://www.tiktok.com/@langxapp/video/7311234567890123456',
    })
    const init = calls.find((call) => call.url.endsWith('/v2/post/publish/video/init/'))
    expect((init?.body as { post_info: unknown }).post_info).toMatchObject({
      title: 'Day 1. Meet Venus.\n\n#LangXVenus #cats',
      privacy_level: 'PUBLIC_TO_EVERYONE',
    })
  })

  it('builds an adapter only for a platform with every key, and boots with none', () => {
    const base = { MONGODB_URI: 'mongodb://x', BETTER_AUTH_SECRET: 'a'.repeat(32) }
    const none = loadEnv(base)
    expect(createSocialAdapters(none, db)).toEqual({})
    expect(socialConnected(none)).toEqual({
      instagram: false,
      facebook: false,
      youtube: false,
      tiktok: false,
    })

    const some = loadEnv({
      ...base,
      IG_PAGE_TOKEN: 'ig',
      FB_PAGE_ID: 'page',
      YOUTUBE_CLIENT_ID: 'id',
    })
    expect(Object.keys(createSocialAdapters(some, db))).toEqual(['instagram'])
    expect(socialConnected(some)).toMatchObject({
      instagram: true,
      facebook: false,
      youtube: false,
    })
    expect(some.TIKTOK_POST_MODE).toBe('inbox')
  })
})
