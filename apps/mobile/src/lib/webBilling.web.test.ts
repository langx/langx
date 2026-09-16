import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The browser store, against a fake SDK.
 *
 * This file had no test at all, which is a strange gap for the one module in
 * the app that takes money: `purchases.ts` cannot tell which half of the pair
 * Metro resolved, so a mistake here is a mistake on the whole web paywall and
 * nothing in the native tests would see it.
 *
 * Everything is driven through `vi.resetModules()` and a dynamic import,
 * because the module holds real state between calls — the loaded SDK, the
 * bound user, the package map — and a test that inherited the previous one's
 * would assert nothing it meant to.
 */

/**
 * One fake SDK for the whole file, not one per test.
 *
 * `vi.resetModules()` gives each test a fresh copy of the module under test,
 * which is what clears its cached SDK handle and its bound user — but it does
 * not re-run a `vi.mock` factory, so a fake built per test would leave the
 * module talking to the first one while the assertions looked at the newest.
 * `vi.hoisted` builds it once; `beforeEach` resets it.
 */
const fake = vi.hoisted(() => {
  class PurchasesError extends Error {
    constructor(readonly errorCode: number) {
      super('purchase failed')
    }
  }
  const ErrorCode = { UserCancelledError: 1, NetworkError: 2 }
  const instance = {
    getOfferings: vi.fn(),
    purchase: vi.fn(),
    getCustomerInfo: vi.fn(),
    changeUser: vi.fn(),
    close: vi.fn(),
  }
  const state = { configured: false }
  const Purchases = {
    isConfigured: vi.fn(),
    configure: vi.fn(),
    getSharedInstance: vi.fn(),
  }
  return { PurchasesError, ErrorCode, instance, state, Purchases }
})

vi.mock('@revenuecat/purchases-js', () => ({
  Purchases: fake.Purchases,
  PurchasesError: fake.PurchasesError,
  ErrorCode: fake.ErrorCode,
}))
vi.mock('../i18n/runtime', () => ({ currentLocale: () => 'tr' }))

function pkg(identifier: string, formattedPrice: string, amountMicros: number) {
  return {
    identifier,
    webBillingProduct: {
      price: { formattedPrice, amountMicros },
      defaultSubscriptionOption: { base: { pricePerMonth: { formattedPrice: '\u20ac4.99' } } },
      freeTrialPhase: null,
    },
  }
}

async function load() {
  vi.resetModules()
  return import('./webBilling.web')
}

beforeEach(() => {
  fake.state.configured = false
  for (const fn of Object.values(fake.instance)) fn.mockReset()
  fake.Purchases.isConfigured.mockReset().mockImplementation(() => fake.state.configured)
  fake.Purchases.configure.mockReset().mockImplementation(() => {
    fake.state.configured = true
    return fake.instance
  })
  fake.Purchases.getSharedInstance.mockReset().mockImplementation(() => fake.instance)

  vi.stubGlobal('__DEV__', false)
  process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY = 'rcb_test'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY
  delete process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY
})

describe('whether the web store is available at all', () => {
  it('is unavailable with no key, and says so without touching the SDK', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY
    const web = await load()

    expect(web.isWebBillingAvailable()).toBe(false)
    expect(await web.getWebBillingOffers()).toEqual([])
    expect(await web.purchaseWebBillingOffer('$rc_monthly')).toBe('unavailable')
    expect(await web.restoreWebBillingPurchases()).toBe(false)
    expect(await web.webBillingManagementUrl()).toBeNull()
    expect(fake.Purchases.configure).not.toHaveBeenCalled()
  })

  /**
   * The Test Store key is development-only on purpose: `EXPO_PUBLIC_*` is
   * inlined at build time, so one left in a shell would otherwise ride a web
   * export into production and sell simulated subscriptions to real people.
   */
  it('takes the test-store key only in development', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY
    process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY = 'test_abc'

    vi.stubGlobal('__DEV__', false)
    expect((await load()).isWebBillingAvailable()).toBe(false)

    vi.stubGlobal('__DEV__', true)
    expect((await load()).isWebBillingAvailable()).toBe(true)
  })
})

describe('binding the SDK to the signed-in account', () => {
  it('configures once, then changes user rather than configuring again', async () => {
    const web = await load()

    await web.identifyForWebBilling('user-a')
    expect(fake.Purchases.configure).toHaveBeenCalledWith({
      apiKey: 'rcb_test',
      appUserId: 'user-a',
    })

    await web.identifyForWebBilling('user-b')
    expect(fake.Purchases.configure).toHaveBeenCalledTimes(1)
    expect(fake.instance.changeUser).toHaveBeenCalledWith('user-b')
  })

  it('no-ops for the account it is already bound to', async () => {
    const web = await load()
    await web.identifyForWebBilling('user-a')
    await web.identifyForWebBilling('user-a')
    expect(fake.Purchases.configure).toHaveBeenCalledTimes(1)
    expect(fake.instance.changeUser).not.toHaveBeenCalled()
  })

  /** Billing that cannot start is billing that is unavailable, not a crash. */
  it('survives a configure that throws, and sells nothing afterwards', async () => {
    fake.Purchases.configure.mockImplementation(() => {
      throw new Error('bad key')
    })
    const web = await load()

    await expect(web.identifyForWebBilling('user-a')).resolves.toBeUndefined()
    expect(await web.getWebBillingOffers()).toEqual([])
  })

  it('clears the binding on sign-out so the next account does not inherit it', async () => {
    const web = await load()
    await web.identifyForWebBilling('user-a')
    await web.forgetWebBillingIdentity()

    expect(fake.instance.close).toHaveBeenCalled()

    // Bound again rather than treated as already bound. It arrives as
    // `changeUser` because this fake leaves `isConfigured` true after a close;
    // what the test is about is that the second identify binds at all.
    await web.identifyForWebBilling('user-a')
    expect(fake.instance.changeUser).toHaveBeenCalledWith('user-a')
  })
})

describe('what the paywall is offered', () => {
  it('maps a known package and skips one the app does not sell', async () => {
    fake.instance.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          pkg('$rc_monthly', '€9.99', 9_990_000),
          pkg('mystery_bundle', '€1.00', 1_000_000),
        ],
      },
    })
    const web = await load()
    await web.identifyForWebBilling('user-a')

    const offers = await web.getWebBillingOffers()
    expect(offers).toEqual([
      {
        id: '$rc_monthly',
        tier: 'pro',
        priceString: '€9.99',
        perMonthPriceString: '€4.99',
        period: 'monthly',
        price: 9.99,
        freeTrialDays: null,
      },
    ])
  })

  it('answers with an empty paywall when the store throws', async () => {
    fake.instance.getOfferings.mockRejectedValue(new Error('offline'))
    const web = await load()
    await web.identifyForWebBilling('user-a')
    expect(await web.getWebBillingOffers()).toEqual([])
  })
})

describe('buying', () => {
  async function ready() {
    fake.instance.getOfferings.mockResolvedValue({
      current: { availablePackages: [pkg('$rc_monthly', '€9.99', 9_990_000)] },
    })
    const web = await load()
    await web.identifyForWebBilling('user-a', 'buyer@example.com')
    await web.getWebBillingOffers()
    return web
  }

  it('checks out with the account email, the reader locale and the terms link', async () => {
    const web = await ready()
    expect(await web.purchaseWebBillingOffer('$rc_monthly')).toBe('purchased')

    const args = fake.instance.purchase.mock.calls[0]?.[0] as Record<string, unknown>
    expect(args.customerEmail).toBe('buyer@example.com')
    expect(args.selectedLocale).toBe('tr')
    expect(args.defaultLocale).toBe('en')
    expect(args.termsAndConditionsUrl).toBeTruthy()
  })

  /**
   * Closing the checkout is a decision, not a failure. Reporting it as one is
   * how a paywall teaches people it is broken.
   */
  it('reads a closed checkout as cancelled and anything else as failed', async () => {
    const web = await ready()

    fake.instance.purchase.mockRejectedValueOnce(
      new fake.PurchasesError(fake.ErrorCode.UserCancelledError),
    )
    expect(await web.purchaseWebBillingOffer('$rc_monthly')).toBe('cancelled')

    fake.instance.purchase.mockRejectedValueOnce(
      new fake.PurchasesError(fake.ErrorCode.NetworkError),
    )
    expect(await web.purchaseWebBillingOffer('$rc_monthly')).toBe('failed')

    fake.instance.purchase.mockRejectedValueOnce(new Error('something else entirely'))
    expect(await web.purchaseWebBillingOffer('$rc_monthly')).toBe('failed')
  })

  it('refuses an id the offerings never produced', async () => {
    const web = await ready()
    expect(await web.purchaseWebBillingOffer('never_offered')).toBe('unavailable')
    expect(fake.instance.purchase).not.toHaveBeenCalled()
  })
})

describe('restoring and managing', () => {
  it('reports whether the lookup worked, not whether it found anything', async () => {
    const web = await load()
    await web.identifyForWebBilling('user-a')

    fake.instance.getCustomerInfo.mockResolvedValueOnce({ managementURL: null })
    expect(await web.restoreWebBillingPurchases()).toBe(true)

    fake.instance.getCustomerInfo.mockRejectedValueOnce(new Error('offline'))
    expect(await web.restoreWebBillingPurchases()).toBe(false)
  })

  it('hands back the portal url, and null when there is no subscription', async () => {
    const web = await load()
    await web.identifyForWebBilling('user-a')

    fake.instance.getCustomerInfo.mockResolvedValueOnce({ managementURL: 'https://pay.rc/portal' })
    expect(await web.webBillingManagementUrl()).toBe('https://pay.rc/portal')

    fake.instance.getCustomerInfo.mockResolvedValueOnce({ managementURL: null })
    expect(await web.webBillingManagementUrl()).toBeNull()
  })
})
