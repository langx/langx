import { generateKeyPairSync } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FcmPushSender } from './fcm'

/** A throwaway service account: Google's file shape, a key nobody else has. */
function serviceAccount(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return JSON.stringify({
    project_id: 'langx-test',
    client_email: 'push@langx-test.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    token_uri: 'https://oauth2.googleapis.com/token',
  })
}

const tokenResponse = () =>
  new Response(JSON.stringify({ access_token: 'at-1', expires_in: 3600 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const sent = () => new Response(JSON.stringify({ name: 'projects/x/messages/1' }), { status: 200 })

const failed = (status: number, errorCode: string) =>
  new Response(
    JSON.stringify({
      error: { code: status, status: 'FAILED', details: [{ errorCode }] },
    }),
    { status },
  )

/** Routes the token exchange and the sends to different answers. */
function fetchScripted(perToken: Record<string, () => Response>) {
  return vi.fn().mockImplementation((url: string, init: RequestInit) => {
    if (url.endsWith('/token')) return Promise.resolve(tokenResponse())
    const { message } = JSON.parse(init.body as string) as { message: { token: string } }
    return Promise.resolve((perToken[message.token] ?? sent)())
  })
}

describe('FcmPushSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prunes a token FCM says is no longer registered, and only that', async () => {
    vi.stubGlobal(
      'fetch',
      fetchScripted({
        gone: () => failed(404, 'UNREGISTERED'),
        // A quota error is about this send, not the device — deleting the
        // token over it would silence a phone that works perfectly.
        busy: () => failed(429, 'QUOTA_EXCEEDED'),
      }),
    )

    const result = await new FcmPushSender(serviceAccount()).send({
      to: ['fine', 'gone', 'busy'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    expect(result.invalidTokens).toEqual(['gone'])
  })

  /** An old Expo token left on an account is exactly this. */
  it('prunes a token FCM never issued', async () => {
    vi.stubGlobal(
      'fetch',
      fetchScripted({ 'ExponentPushToken[x]': () => failed(400, 'INVALID_ARGUMENT') }),
    )
    const result = await new FcmPushSender(serviceAccount()).send({
      to: ['ExponentPushToken[x]'],
      title: 'a',
      body: 'b',
      data: { kind: 'message' },
    })
    expect(result.invalidTokens).toEqual(['ExponentPushToken[x]'])
  })

  it('sends one request per device, with the payload FCM expects', async () => {
    const fetchMock = fetchScripted({})
    vi.stubGlobal('fetch', fetchMock)

    await new FcmPushSender(serviceAccount()).send({
      to: ['a', 'b'],
      title: 'Ada',
      body: 'hello',
      data: { kind: 'message', conversationId: 'c1', senderId: 's1' },
    })

    const sends = fetchMock.mock.calls.filter(([url]) => !(url as string).endsWith('/token'))
    expect(sends).toHaveLength(2)
    const [url, init] = sends[0] as [string, RequestInit]
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/langx-test/messages:send')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer at-1')
    const { message } = JSON.parse(init.body as string) as { message: Record<string, unknown> }
    expect(message.notification).toEqual({ title: 'Ada', body: 'hello' })
    expect(message.data).toEqual({ kind: 'message', conversationId: 'c1', senderId: 's1' })
    // Names the channel `configureNotifications` creates, so Android 8+ shows
    // it as a heads-up rather than dropping it.
    expect(message.android).toEqual({ priority: 'high', notification: { channel_id: 'default' } })
  })

  it('mints the access token once and reuses it', async () => {
    const fetchMock = fetchScripted({})
    vi.stubGlobal('fetch', fetchMock)
    const sender = new FcmPushSender(serviceAccount())

    await sender.send({ to: ['a'], title: 't', body: 'b', data: { kind: 'message' } })
    await sender.send({ to: ['b'], title: 't', body: 'b', data: { kind: 'message' } })

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => (url as string).endsWith('/token'))
    expect(tokenCalls).toHaveLength(1)
  })

  it('leaves out data fields nobody set rather than sending the string "undefined"', async () => {
    const fetchMock = fetchScripted({})
    vi.stubGlobal('fetch', fetchMock)
    await new FcmPushSender(serviceAccount()).send({
      to: ['a'],
      title: 't',
      body: 'b',
      data: { kind: 'streakReminder' },
    })
    const [, init] = fetchMock.mock.calls.find(([url]) => !(url as string).endsWith('/token')) as [
      string,
      RequestInit,
    ]
    const { message } = JSON.parse(init.body as string) as { message: { data: unknown } }
    expect(message.data).toEqual({ kind: 'streakReminder' })
  })
})
