import { describe, expect, it, vi } from 'vitest'
import { loadEnv } from '../../env'
import {
  CloudflareTurnProvider,
  ICE_TTL_SECONDS,
  NotConfiguredIceProvider,
  StaticIceProvider,
  createIceProvider,
} from './ice'

const BASE = { MONGODB_URI: 'mongodb://localhost/test', BETTER_AUTH_SECRET: 'a'.repeat(32) }

const cloudflareAnswer = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'user',
      credential: 'pass',
    },
  ],
}

function answering(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('CloudflareTurnProvider', () => {
  it('asks for a credential that outlives the longest call, and sends media by the relay only', async () => {
    const fetchMock = answering(201, cloudflareAnswer)
    const provider = new CloudflareTurnProvider('key-id', 'api-token', fetchMock)

    const config = await provider.mint()

    expect(config.iceTransportPolicy).toBe('relay')
    expect(config.iceServers).toEqual(cloudflareAnswer.iceServers)

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers',
    )
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer api-token')
    expect(JSON.parse(init.body as string)).toEqual({ ttl: ICE_TTL_SECONDS })
    // Two hours of call and ten minutes to hang up in.
    expect(ICE_TTL_SECONDS).toBe(130 * 60)
  })

  it('says calls are unavailable rather than dialling without a relay', async () => {
    const refused = new CloudflareTurnProvider('k', 't', answering(401, { error: 'nope' }))
    await expect(refused.mint()).rejects.toMatchObject({ code: 'CALLS_UNAVAILABLE' })

    const garbled = new CloudflareTurnProvider('k', 't', answering(201, { servers: [] }))
    await expect(garbled.mint()).rejects.toMatchObject({ code: 'CALLS_UNAVAILABLE' })

    const down = new CloudflareTurnProvider(
      'k',
      't',
      vi.fn().mockRejectedValue(new Error('ECONNRESET')),
    )
    await expect(down.mint()).rejects.toMatchObject({ code: 'CALLS_UNAVAILABLE' })
  })

  it('never puts the key id anywhere but the path it belongs in', async () => {
    const fetchMock = answering(201, cloudflareAnswer)
    await new CloudflareTurnProvider('a/b?c', 't', fetchMock).mint()
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(url).toContain('/keys/a%2Fb%3Fc/')
  })
})

describe('createIceProvider', () => {
  it('offers no calls in production without a relay', () => {
    const provider = createIceProvider(loadEnv({ ...BASE, NODE_ENV: 'production' }))
    expect(provider).toBeInstanceOf(NotConfiguredIceProvider)
    expect(provider.configured).toBe(false)
  })

  it('lets two devices on one network find each other anywhere else', async () => {
    const provider = createIceProvider(loadEnv({ ...BASE, NODE_ENV: 'development' }))
    expect(provider.configured).toBe(true)
    expect(await provider.mint()).toEqual({ iceServers: [], iceTransportPolicy: 'all' })
  })

  it('uses Cloudflare when both of its values are set, and not when only one is', () => {
    const both = createIceProvider(
      loadEnv({
        ...BASE,
        NODE_ENV: 'production',
        CLOUDFLARE_TURN_KEY_ID: 'id',
        CLOUDFLARE_TURN_KEY_API_TOKEN: 'token',
      }),
    )
    expect(both).toBeInstanceOf(CloudflareTurnProvider)

    const half = createIceProvider(
      loadEnv({ ...BASE, NODE_ENV: 'production', CLOUDFLARE_TURN_KEY_ID: 'id' }),
    )
    expect(half).toBeInstanceOf(NotConfiguredIceProvider)
  })

  it('takes a relay of your own, and is relay-only as soon as the list has one', async () => {
    const own = createIceProvider(
      loadEnv({
        ...BASE,
        NODE_ENV: 'production',
        ICE_SERVERS_JSON: '[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]',
      }),
    )
    expect(own).toBeInstanceOf(StaticIceProvider)
    expect((await own.mint()).iceTransportPolicy).toBe('relay')

    // Only a way to learn an address: there is nothing to relay through.
    const stunOnly = createIceProvider(
      loadEnv({ ...BASE, ICE_SERVERS_JSON: '[{"urls":"stun:stun.example.com:3478"}]' }),
    )
    expect((await stunOnly.mint()).iceTransportPolicy).toBe('all')
  })

  it('fails the boot on a relay list that is not one, with the variable named', () => {
    expect(() => loadEnv({ ...BASE, ICE_SERVERS_JSON: '{not json' })).toThrow(/ICE_SERVERS_JSON/)
    expect(() => loadEnv({ ...BASE, ICE_SERVERS_JSON: '{"urls":"turn:x"}' })).toThrow(
      /ICE_SERVERS_JSON/,
    )
  })
})

describe('NotConfiguredIceProvider', () => {
  it('refuses rather than handing out an empty path', async () => {
    await expect(new NotConfiguredIceProvider().mint()).rejects.toMatchObject({
      code: 'CALLS_UNAVAILABLE',
    })
  })
})
