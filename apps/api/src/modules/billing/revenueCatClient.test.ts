import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRevenueCatClient } from './revenueCatClient'

/**
 * Pins this client to RevenueCat's *actual* `GET /v1/subscribers` shape, with
 * a mocked `fetch`, because the two bugs this file has already had were both
 * shape bugs the type system was happy with: an entitlement key that did not
 * exist in the dashboard, and a `store` field that does not exist on
 * entitlement entries at all (it lives on the purchase — `subscriptions`, or
 * `non_subscriptions` for one-time products).
 */

type Subscriber = {
  entitlements: Record<string, { expires_date: string | null; product_identifier: string }>
  subscriptions?: Record<string, { store?: string }>
  non_subscriptions?: Record<string, { store?: string }[]>
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString()
const PAST = new Date(Date.now() - 86_400_000).toISOString()

function mockSubscriber(subscriber: Subscriber): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ request_date: new Date().toISOString(), subscriber }),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createRevenueCatClient', () => {
  it('calls the subscribers endpoint with the secret key and an encoded user id', async () => {
    const fetchMock = mockSubscriber({ entitlements: {} })
    await createRevenueCatClient('sk_test').getEntitlement('user/with slash')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%2Fwith%20slash',
      { headers: { authorization: 'Bearer sk_test' } },
    )
  })

  it('returns null for a subscriber with no entitlements', async () => {
    mockSubscriber({ entitlements: {} })
    expect(await createRevenueCatClient('sk').getEntitlement('u1')).toBeNull()
  })

  it('prefers pro_plus when both entitlements are active', async () => {
    mockSubscriber({
      entitlements: {
        pro: { expires_date: FUTURE, product_identifier: 'monthly' },
        pro_plus: { expires_date: FUTURE, product_identifier: 'pro_plus_monthly' },
      },
      subscriptions: {
        monthly: { store: 'app_store' },
        pro_plus_monthly: { store: 'play_store' },
      },
    })

    const result = await createRevenueCatClient('sk').getEntitlement('u1')
    expect(result).toMatchObject({
      tier: 'pro_plus',
      productId: 'pro_plus_monthly',
      // From the winning entitlement's own purchase — not pro's.
      store: 'play_store',
    })
  })

  /** RevenueCat returns every entitlement ever held; presence proves nothing. */
  it('falls through an expired pro_plus to a still-active pro', async () => {
    mockSubscriber({
      entitlements: {
        pro: { expires_date: FUTURE, product_identifier: 'monthly' },
        pro_plus: { expires_date: PAST, product_identifier: 'pro_plus_monthly' },
      },
      subscriptions: { monthly: { store: 'app_store' } },
    })

    const result = await createRevenueCatClient('sk').getEntitlement('u1')
    expect(result).toMatchObject({ tier: 'pro', store: 'app_store' })
  })

  it('returns null when everything has expired', async () => {
    mockSubscriber({
      entitlements: { pro: { expires_date: PAST, product_identifier: 'monthly' } },
    })
    expect(await createRevenueCatClient('sk').getEntitlement('u1')).toBeNull()
  })

  /**
   * Lifetime: no expiry, and the purchase lives in `non_subscriptions`, whose
   * values are arrays (one entry per purchase). The latest entry wins.
   */
  it('treats a lifetime entitlement as active and finds its store in non_subscriptions', async () => {
    mockSubscriber({
      entitlements: { pro: { expires_date: null, product_identifier: 'lifetime' } },
      non_subscriptions: {
        lifetime: [{ store: 'app_store' }, { store: 'play_store' }],
      },
    })

    const result = await createRevenueCatClient('sk').getEntitlement('u1')
    expect(result).toMatchObject({ tier: 'pro', expiresAt: null, store: 'play_store' })
  })

  /** A shape surprise must degrade to 'unknown', never to a crash. */
  it("reports 'unknown' when no purchase list names the product", async () => {
    mockSubscriber({
      entitlements: { pro: { expires_date: FUTURE, product_identifier: 'monthly' } },
    })

    const result = await createRevenueCatClient('sk').getEntitlement('u1')
    expect(result).toMatchObject({ tier: 'pro', store: 'unknown' })
  })

  it('posts a lifetime promotional grant to the right endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') })
    vi.stubGlobal('fetch', fetchMock)

    await createRevenueCatClient('sk_test').grantLifetimeEntitlement('user 1', 'pro_plus')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%201/entitlements/pro_plus/promotional',
      {
        method: 'POST',
        headers: { authorization: 'Bearer sk_test', 'content-type': 'application/json' },
        // `duration: 'lifetime'` and not `end_time_ms`: there is no timestamp
        // that means "never expires".
        body: JSON.stringify({ duration: 'lifetime' }),
      },
    )
  })

  /**
   * The v1 loyalty gift is handed out when an email is verified, which is
   * regularly before the phone has launched the app and registered the user
   * with RevenueCat — so the subscriber does not exist and the grant 404s.
   * Measured against the live project; the gift was being lost to it.
   */
  it('creates the subscriber and retries when RevenueCat has never seen the id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('7259') })
      .mockResolvedValueOnce({ ok: true, status: 201, text: () => Promise.resolve('{}') })
      .mockResolvedValueOnce({ ok: true, status: 201, text: () => Promise.resolve('{}') })
    vi.stubGlobal('fetch', fetchMock)

    await createRevenueCatClient('sk').grantLifetimeEntitlement('newcomer', 'pro_plus')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    // The middle call is the bare subscriber URL — a GET, which is what
    // creates the record. No method means fetch's default.
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.revenuecat.com/v1/subscribers/newcomer')
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty('method')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('/entitlements/pro_plus/promotional')
  })

  /** One retry, not a loop: a 404 that survives the create is a real refusal. */
  it('throws when a grant is refused, so the caller can report no gift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('no user') }),
    )
    await expect(
      createRevenueCatClient('sk').grantLifetimeEntitlement('ghost', 'pro'),
    ).rejects.toThrow('404')
  })

  /**
   * What the v1 loyalty grant actually looks like in the subscriber record,
   * copied from production on 4 September 2026: a synthetic product, a store
   * of `promotional`, and an expiry two centuries out standing in for "never".
   */
  it('reports a promotional lifetime as a lifetime, not as renewing in 2226', async () => {
    mockSubscriber({
      entitlements: {
        pro_plus: {
          expires_date: '2226-07-18T04:58:40Z',
          product_identifier: 'rc_promo_pro_plus_lifetime',
        },
        pro: { expires_date: '2226-07-18T04:58:41Z', product_identifier: 'rc_promo_pro_lifetime' },
      },
      subscriptions: {
        rc_promo_pro_plus_lifetime: { store: 'promotional' },
        rc_promo_pro_lifetime: { store: 'promotional' },
      },
    })

    expect(await createRevenueCatClient('sk').getEntitlement('u1')).toEqual({
      tier: 'pro_plus',
      expiresAt: null,
      productId: 'rc_promo_pro_plus_lifetime',
      store: 'promotional',
      willRenew: false,
    })
  })

  it('throws on a non-2xx so callers cannot mistake an outage for free', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('nope') }),
    )
    await expect(createRevenueCatClient('sk').getEntitlement('u1')).rejects.toThrow('401')
  })
})
