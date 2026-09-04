import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import {
  devicesToPush,
  ExpoPushSender,
  registerDevice,
  sendPush,
  setDevicePushEnabled,
  tokensFor,
  unregisterDevice,
  type Device,
} from './devices'

/** One Expo ticket per token, in the order the tokens were sent. */
function ticketsFor(statuses: ('ok' | 'DeviceNotRegistered' | 'MessageRateExceeded')[]): Response {
  return new Response(
    JSON.stringify({
      data: statuses.map((status) =>
        status === 'ok'
          ? { status: 'ok', id: 'ticket' }
          : { status: 'error', message: status, details: { error: status } },
      ),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

describe('ExpoPushSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the tokens Expo says are no longer installed', async () => {
    // The whole reason the response is read at all. Expo answers 200 even for
    // a token belonging to an uninstalled app; the failure is inside the body.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(ticketsFor(['ok', 'DeviceNotRegistered', 'ok'])),
    )

    const result = await new ExpoPushSender().send({
      to: ['good-1', 'gone', 'good-2'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    expect(result.invalidTokens).toEqual(['gone'])
  })

  it('keeps a token that failed for a reason about this send, not the device', async () => {
    // Deleting a token over a rate limit would silence a phone that is working
    // perfectly, and the person would never find out why.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ticketsFor(['MessageRateExceeded'])))

    const result = await new ExpoPushSender().send({
      to: ['busy'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    expect(result.invalidTokens).toEqual([])
  })

  /** The unread total rides the message push; every other kind leaves the icon alone. */
  it('forwards a badge count when one is given, and omits the field when not', async () => {
    // A fresh Response per call: a body can only be read once.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ticketsFor(['ok'])))
    vi.stubGlobal('fetch', fetchMock)
    const sender = new ExpoPushSender()
    const sentBody = (call: number): { badge?: number }[] => {
      const init = fetchMock.mock.calls[call]?.[1] as { body: string } | undefined
      return JSON.parse(init?.body ?? '[]') as { badge?: number }[]
    }

    await sender.send({
      to: ['t'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
      badge: 3,
    })
    expect(sentBody(0)[0]?.badge).toBe(3)

    await sender.send({ to: ['t'], title: 'hi', body: 'there', data: { kind: 'streakReminder' } })
    expect(sentBody(1)[0]).not.toHaveProperty('badge')
  })

  it('splits more than 100 recipients across requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ticketsFor(Array<'ok'>(100).fill('ok')))
      .mockResolvedValueOnce(ticketsFor(['DeviceNotRegistered']))
    vi.stubGlobal('fetch', fetchMock)

    const tokens = Array.from({ length: 101 }, (_, index) => `token-${index}`)
    const result = await new ExpoPushSender().send({
      to: tokens,
      title: 'streak',
      body: 'keep it going',
      data: { kind: 'streakReminder' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The index has to be read against the *batch*, not the whole list — the
    // obvious bug here is reporting token-1 as dead instead of token-100.
    expect(result.invalidTokens).toEqual(['token-100'])
  })

  it('sends no authorization header unless an access token was given', async () => {
    // A fresh Response per call: a body can only be read once, and both
    // sends read one.
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ticketsFor(['ok'])))
    vi.stubGlobal('fetch', fetchMock)

    await new ExpoPushSender().send({
      to: ['t'],
      title: 'a',
      body: 'b',
      data: { kind: 'message' },
    })
    const [, anonymous] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((anonymous.headers as Record<string, string>).authorization).toBeUndefined()

    await new ExpoPushSender('secret').send({
      to: ['t'],
      title: 'a',
      body: 'b',
      data: { kind: 'message' },
    })
    const [, authorized] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect((authorized.headers as Record<string, string>).authorization).toBe('Bearer secret')
  })

  it('does not read a body Expo did not accept', async () => {
    // A 4xx has no ticket array; parsing it as one would throw inside the
    // notification path and take down the message that triggered it.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 400 })))

    await expect(
      new ExpoPushSender().send({ to: ['t'], title: 'a', body: 'b', data: { kind: 'message' } }),
    ).resolves.toEqual({ invalidTokens: [] })
  })
})

describe('sendPush', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_push_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.devices).deleteMany({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forgets the phone Expo says the app was uninstalled from', async () => {
    await registerDevice(handle.db, 'ada', { pushToken: 'phone-1', platform: 'ios' })
    await registerDevice(handle.db, 'ada', { pushToken: 'phone-2', platform: 'android' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ticketsFor(['ok', 'DeviceNotRegistered'])))

    await sendPush(handle.db, new ExpoPushSender(), {
      to: ['phone-1', 'phone-2'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    // Left alone, a dead token stays on the account forever and every later
    // send spends a slot on a phone that will never show anything.
    expect(await tokensFor(handle.db, 'ada')).toEqual(['phone-1'])
  })

  it('leaves the collection alone when everything delivered', async () => {
    await registerDevice(handle.db, 'bo', { pushToken: 'phone-3', platform: 'ios' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ticketsFor(['ok'])))

    await sendPush(handle.db, new ExpoPushSender(), {
      to: ['phone-3'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    const devices = await handle.db.collection<Device>(COLLECTIONS.devices).countDocuments()
    expect(devices).toBe(1)
  })

  /**
   * Identity. A device used to be its Expo push token and nothing else, which
   * made "which phone is this" a question only Expo could answer — and it is
   * free to change its mind.
   */
  describe('keyed on the installation', () => {
    it('keeps one row when a phone’s token rotates', async () => {
      await registerDevice(handle.db, 'cy', {
        pushToken: 'token-old',
        platform: 'ios',
        deviceId: 'phone-a',
      })
      await registerDevice(handle.db, 'cy', {
        pushToken: 'token-new',
        platform: 'ios',
        deviceId: 'phone-a',
      })

      // The old row used to survive, receiving nothing, until Expo happened to
      // report the dead token back.
      expect(await tokensFor(handle.db, 'cy')).toEqual(['token-new'])
    })

    it('keeps two rows for two phones on one account', async () => {
      await registerDevice(handle.db, 'di', {
        pushToken: 'token-1',
        platform: 'ios',
        deviceId: 'phone-a',
      })
      await registerDevice(handle.db, 'di', {
        pushToken: 'token-2',
        platform: 'android',
        deviceId: 'phone-b',
      })

      expect((await tokensFor(handle.db, 'di')).sort()).toEqual(['token-1', 'token-2'])
    })

    it('moves a token to whoever registered it last', async () => {
      await registerDevice(handle.db, 'el', {
        pushToken: 'shared',
        platform: 'ios',
        deviceId: 'phone-a',
      })
      await registerDevice(handle.db, 'fi', {
        pushToken: 'shared',
        platform: 'ios',
        deviceId: 'phone-b',
      })

      // A phone handed on must not keep carrying the previous owner's
      // notifications, which is what the unique index on the token is for.
      expect(await tokensFor(handle.db, 'el')).toEqual([])
      expect(await tokensFor(handle.db, 'fi')).toEqual(['shared'])
    })

    it('still accepts a build that sends no id at all', async () => {
      await registerDevice(handle.db, 'gu', { pushToken: 'old-build', platform: 'android' })
      expect(await tokensFor(handle.db, 'gu')).toEqual(['old-build'])
    })

    it('forgets a phone by its id, whatever its token has become', async () => {
      await registerDevice(handle.db, 'ha', {
        pushToken: 'token-x',
        platform: 'ios',
        deviceId: 'phone-a',
      })
      await unregisterDevice(handle.db, 'ha', { pushToken: 'stale', deviceId: 'phone-a' })
      expect(await tokensFor(handle.db, 'ha')).toEqual([])
    })
  })

  /** The switch: one phone silenced, the other still receiving. */
  describe('silencing one device', () => {
    it('drops only that device from the send', async () => {
      await registerDevice(handle.db, 'io', {
        pushToken: 'keep',
        platform: 'ios',
        deviceId: 'phone-a',
      })
      await registerDevice(handle.db, 'io', {
        pushToken: 'quiet',
        platform: 'android',
        deviceId: 'phone-b',
      })

      expect(await setDevicePushEnabled(handle.db, 'io', 'phone-b', false)).toBe(true)
      expect(await tokensFor(handle.db, 'io')).toEqual(['keep'])

      expect(await setDevicePushEnabled(handle.db, 'io', 'phone-b', true)).toBe(true)
      expect((await tokensFor(handle.db, 'io')).sort()).toEqual(['keep', 'quiet'])
    })

    it('reports a device this account does not have, rather than succeeding', async () => {
      expect(await setDevicePushEnabled(handle.db, 'jo', 'not-mine', false)).toBe(false)
    })

    it('honours the flag sent with a registration, so a reinstall re-syncs', async () => {
      await registerDevice(handle.db, 'ka', {
        pushToken: 'token-k',
        platform: 'ios',
        deviceId: 'phone-a',
        pushEnabled: false,
      })
      expect(await tokensFor(handle.db, 'ka')).toEqual([])
    })
  })

  /**
   * The decision behind the reported bug: a socket is a fact about a device,
   * and the fan-out used to read it as a fact about the account.
   */
  describe('devicesToPush', () => {
    const rows = [
      { deviceId: 'phone-a', pushToken: 'token-a' },
      { deviceId: 'phone-b', pushToken: 'token-b' },
    ] as Device[]

    it('skips the device that is holding the socket, not the account', () => {
      expect(devicesToPush(rows, ['phone-a'])).toEqual(['token-b'])
    })

    it('pushes to everything when nobody is connected', () => {
      expect(devicesToPush(rows, [])).toEqual(['token-a', 'token-b'])
    })

    it('pushes to nothing when every device is connected', () => {
      expect(devicesToPush(rows, ['phone-a', 'phone-b'])).toEqual([])
    })

    it('cannot skip a row that has no id to match', () => {
      const legacy = [{ pushToken: 'token-old' }] as Device[]
      expect(devicesToPush(legacy, ['phone-a'])).toEqual(['token-old'])
    })
  })
})
