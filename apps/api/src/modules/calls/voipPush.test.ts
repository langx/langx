import { decodeProtectedHeader, decodeJwt } from 'jose'
import { generateKeyPairSync } from 'node:crypto'
import { createServer, type Http2Server, type IncomingHttpHeaders } from 'node:http2'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadEnv } from '../../env'
import {
  ApnsVoipSender,
  NotConfiguredVoipSender,
  createVoipSender,
  type VoipPush,
} from './voipPush'

interface Received {
  headers: IncomingHttpHeaders
  body: string
}

/**
 * Apple, as far as this sender can tell: an HTTP/2 server that records what it
 * was sent and answers with whatever the test queued. Cleartext, which
 * `http2.connect` speaks to an `http:` origin — the framing is the same and
 * the sender never looks at the certificate.
 */
function fakeApns() {
  const received: Received[] = []
  const answers: { status: number; body?: unknown }[] = []
  let sessions = 0

  const server: Http2Server = createServer()
  server.on('session', () => {
    sessions++
  })
  server.on('stream', (stream, headers) => {
    let body = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk: string) => {
      body += chunk
    })
    stream.on('end', () => {
      received.push({ headers, body })
      const answer = answers.shift() ?? { status: 200 }
      stream.respond({ ':status': answer.status })
      stream.end(answer.body === undefined ? '' : JSON.stringify(answer.body))
    })
  })

  return {
    received,
    answers,
    sessions: () => sessions,
    listen: () =>
      new Promise<string>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
        })
      }),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

const config = {
  keyId: 'KEY1234567',
  teamId: 'TEAM123456',
  bundleId: 'tech.example.app',
  privateKeyPem,
}

const TOKEN = 'ab'.repeat(32)

function ring(overrides: Partial<VoipPush> = {}): VoipPush {
  return {
    token: TOKEN,
    environment: 'production',
    payload: { aps: {}, langx: { kind: 'callRing', callId: 'c1' } },
    expiresAt: new Date('2026-10-04T10:00:45.000Z'),
    ...overrides,
  }
}

describe('ApnsVoipSender', () => {
  let apple: ReturnType<typeof fakeApns>
  let sandbox: ReturnType<typeof fakeApns>
  let sender: ApnsVoipSender

  beforeEach(async () => {
    apple = fakeApns()
    sandbox = fakeApns()
    sender = new ApnsVoipSender(config, undefined, {
      production: await apple.listen(),
      sandbox: await sandbox.listen(),
    })
  })

  afterEach(async () => {
    sender.close()
    await apple.close()
    await sandbox.close()
  })

  it('sends a VoIP push the way Apple requires one to be sent', async () => {
    const result = await sender.send(ring())

    expect(result).toEqual({ ok: true })
    const [request] = apple.received
    expect(request?.headers[':method']).toBe('POST')
    expect(request?.headers[':path']).toBe(`/3/device/${TOKEN}`)
    // The topic is the bundle id with `.voip` on it — not the bundle id.
    expect(request?.headers['apns-topic']).toBe('tech.example.app.voip')
    expect(request?.headers['apns-push-type']).toBe('voip')
    expect(request?.headers['apns-priority']).toBe('10')
    // Seconds, and the moment the ring ends: a late delivery rings nobody.
    expect(request?.headers['apns-expiration']).toBe(
      String(Date.parse('2026-10-04T10:00:45.000Z') / 1000),
    )
    expect(JSON.parse(request?.body ?? '')).toEqual({
      aps: {},
      langx: { kind: 'callRing', callId: 'c1' },
    })
  })

  it('signs in as the team with the key, and reuses the token and the connection', async () => {
    await sender.send(ring())
    await sender.send(ring())

    const tokens = apple.received.map((request) =>
      String(request.headers.authorization).replace(/^bearer /, ''),
    )
    expect(decodeProtectedHeader(tokens[0] ?? '')).toMatchObject({
      alg: 'ES256',
      kid: 'KEY1234567',
    })
    expect(decodeJwt(tokens[0] ?? '').iss).toBe('TEAM123456')
    // Apple throttles a provider that mints a token per push, and treats a
    // connection per push as abuse.
    expect(tokens[1]).toBe(tokens[0])
    expect(apple.sessions()).toBe(1)
  })

  it('sends a development build’s token to the sandbox, and nowhere else', async () => {
    await sender.send(ring({ environment: 'sandbox' }))
    expect(sandbox.received).toHaveLength(1)
    expect(apple.received).toHaveLength(0)
  })

  it('reports a token Apple no longer knows as gone', async () => {
    apple.answers.push({ status: 410, body: { reason: 'Unregistered' } })
    expect(await sender.send(ring())).toEqual({ ok: false, gone: true, reason: 'Unregistered' })

    apple.answers.push({ status: 400, body: { reason: 'BadDeviceToken' } })
    expect(await sender.send(ring())).toMatchObject({ ok: false, gone: true })
  })

  it('does not throw away a phone over a failure that is about the send', async () => {
    apple.answers.push({ status: 429, body: { reason: 'TooManyRequests' } })
    expect(await sender.send(ring())).toEqual({
      ok: false,
      gone: false,
      reason: 'TooManyRequests',
    })

    apple.answers.push({ status: 503 })
    expect(await sender.send(ring())).toMatchObject({ ok: false, gone: false, reason: 'HTTP 503' })
  })

  it('mints a fresh token once when Apple says the one it sent has expired', async () => {
    await sender.send(ring())
    apple.answers.push({ status: 403, body: { reason: 'ExpiredProviderToken' } })

    const result = await sender.send(ring())

    expect(result).toEqual({ ok: true })
    // Three requests in all: the first, the refused one, and the retry.
    expect(apple.received).toHaveLength(3)
  })

  it('answers a dead connection with a failure, never an exception', async () => {
    await apple.close()
    const result = await sender.send(ring())
    expect(result).toMatchObject({ ok: false, gone: false })
    // Reopened for the test's own teardown.
    apple = fakeApns()
    await apple.listen()
  })
})

describe('createVoipSender', () => {
  const BASE = { MONGODB_URI: 'mongodb://localhost/test', BETTER_AUTH_SECRET: 'a'.repeat(32) }

  it('is the stand-in without a key, which records and sends nothing', async () => {
    const sender = createVoipSender(loadEnv(BASE))
    expect(sender).toBeInstanceOf(NotConfiguredVoipSender)
    expect(sender.configured).toBe(false)
    expect(await sender.send(ring())).toMatchObject({ ok: false, gone: false })
    expect((sender as NotConfiguredVoipSender).sent).toHaveLength(1)
  })

  it('needs both the key and its id', () => {
    expect(createVoipSender(loadEnv({ ...BASE, APNS_KEY_ID: 'K' })).configured).toBe(false)
    const sender = createVoipSender(
      loadEnv({ ...BASE, APNS_KEY_ID: 'K', APNS_PRIVATE_KEY: privateKeyPem.replace(/\n/g, '\\n') }),
    )
    expect(sender.configured).toBe(true)
    sender.close()
  })
})
