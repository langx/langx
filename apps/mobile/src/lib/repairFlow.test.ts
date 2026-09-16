import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranslateFn } from '../i18n/runtime'

/**
 * The confirmation in front of a streak repair.
 *
 * Worth its own test because it is the only place that decides whether a
 * person is *asked* before tokens leave their wallet, and because the sentence
 * it shows is the one the purchase is judged by — including the case the code
 * is proudest of, where the honest answer is "this buys you nothing".
 *
 * `repairEffect` and its streak walk are the real ones; only the two imperative
 * UI calls and the date label are faked, because those are what a node test
 * cannot have.
 */
const ui = vi.hoisted(() => ({
  confirmAlert: vi.fn<(input: unknown) => Promise<boolean>>(),
  showAlert: vi.fn<() => Promise<void>>(),
  showToast: vi.fn(),
}))

vi.mock('./alert', () => ({ confirmAlert: ui.confirmAlert, showAlert: ui.showAlert }))
vi.mock('./toast', () => ({ showToast: ui.showToast }))
vi.mock('./messageGroups', () => ({ dayLabel: (day: string) => day }))

const { confirmAndRepair } = await import('./repairFlow')

/** Echoes the key and its params, so a test can assert which sentence was shown. */
const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}(${JSON.stringify(params)})` : key) as unknown as TranslateFn

const repair =
  vi.fn<(day: string, handlers: { onSuccess: () => void; onError: () => void }) => void>()

function run(over: Partial<Parameters<typeof confirmAndRepair>[0]> = {}) {
  return confirmAndRepair({
    day: '2026-03-03',
    today: '2026-03-05',
    filled: new Set(['2026-03-02', '2026-03-04']),
    price: 600,
    balance: 1000,
    left: 2,
    perMonth: 2,
    t,
    locale: 'en',
    repair,
    ...over,
  })
}

beforeEach(() => {
  ui.confirmAlert.mockReset().mockResolvedValue(true)
  ui.showAlert.mockReset().mockResolvedValue(undefined)
  ui.showToast.mockReset()
  repair.mockReset()
})

describe('what stops the purchase before it is offered', () => {
  it('refuses when the month has no repairs left, and never asks', async () => {
    await run({ left: 0 })

    expect(ui.showAlert).toHaveBeenCalledWith(
      'activity.noRepairsTitle',
      'activity.perMonth({"count":2})',
    )
    expect(ui.confirmAlert).not.toHaveBeenCalled()
    expect(repair).not.toHaveBeenCalled()
  })

  it('refuses when the balance is short of the price, and never asks', async () => {
    await run({ balance: 599 })

    expect(ui.showAlert).toHaveBeenCalledWith(
      'activity.notEnoughTokensTitle',
      'activity.notEnoughTokensBody({"price":600,"balance":599})',
    )
    expect(ui.confirmAlert).not.toHaveBeenCalled()
    expect(repair).not.toHaveBeenCalled()
  })

  /** Exactly the price is affordable; `>=` is the rule, not `>`. */
  it('offers the purchase when the balance is exactly the price', async () => {
    await run({ balance: 600 })
    expect(ui.confirmAlert).toHaveBeenCalled()
  })

  it('does not spend when the person says no', async () => {
    ui.confirmAlert.mockResolvedValue(false)
    await run()
    expect(repair).not.toHaveBeenCalled()
  })
})

describe('the sentence the purchase is judged by', () => {
  it('states the streak it would join, and the balance it would leave', async () => {
    await run()

    const input = ui.confirmAlert.mock.calls[0]?.[0] as { title: string; message: string }
    expect(input.title).toBe('activity.fillInTitle({"day":"2026-03-03"})')
    // 1 before (the 4th alone), 3 after (the 2nd, 3rd and 4th joined up).
    expect(input.message).toBe(
      'activity.balanceChange(' +
        JSON.stringify({
          streakLine: 'activity.streakChange({"before":1,"count":3})',
          before: 1000,
          after: 400,
        }) +
        ')',
    )
  })

  /**
   * The case worth more than the sale: a square in the middle of a fortnight
   * nobody was active in fills and joins no streak, and the dialog says so
   * rather than implying a number that will not move.
   */
  it('says plainly when the repair would join nothing', async () => {
    await run({ today: '2026-03-20', day: '2026-03-10', filled: new Set() })

    const input = ui.confirmAlert.mock.calls[0]?.[0] as { message: string }
    expect(input.message).toContain('activity.noStreakChange')
    expect(input.message).not.toContain('activity.streakChange')
  })
})

describe('after the person says yes', () => {
  it('repairs the day it was asked about, and says so on success', async () => {
    await run()

    expect(repair).toHaveBeenCalledTimes(1)
    const [day, handlers] = repair.mock.calls[0] as [
      string,
      { onSuccess: () => void; onError: () => void },
    ]
    expect(day).toBe('2026-03-03')

    handlers.onSuccess()
    expect(ui.showToast).toHaveBeenCalledWith('activity.filled')
  })

  it('says the purchase did not go through on failure', async () => {
    await run()
    const [, handlers] = repair.mock.calls[0] as [
      string,
      { onSuccess: () => void; onError: () => void },
    ]

    handlers.onError()
    expect(ui.showAlert).toHaveBeenCalledWith('activity.fillFailed', 'common.retry')
    expect(ui.showToast).not.toHaveBeenCalled()
  })
})
