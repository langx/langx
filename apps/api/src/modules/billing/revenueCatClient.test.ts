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

  it('throws when a grant is refused, so the caller can report no gift', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('no user') }),
    )
    await expect(
      createRevenueCatClient('sk').grantLifetimeEntitlement('ghost', 'pro'),
    ).rejects.toThrow('404')
  })

  it('throws on a non-2xx so callers cannot mistake an outage for free', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('nope') }),
    )
    await expect(createRevenueCatClient('sk').getEntitlement('u1')).rejects.toThrow('401')
  })
})
