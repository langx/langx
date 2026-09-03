import type { TranslateFn } from '../i18n/runtime'
import type { Locale } from '@langx/shared'
import { repairEffect } from './activityMap'
import { confirmAlert, showAlert } from './alert'
import { dayLabel } from './messageGroups'
import { showToast } from './toast'

interface ConfirmAndRepairInput {
  day: string
  today: string
  filled: ReadonlySet<string>
  price: number
  balance: number
  left: number
  perMonth: number
  t: TranslateFn
  locale: Locale
  /** The mutation itself, so this file needs no React and the tests can reach it. */
  repair: (day: string, handlers: { onSuccess: () => void; onError: () => void }) => void
}

/**
 * Buy a missed day back, with the sentence that says what it will do.
 *
 * Lifted out of `ActivityMap` when the store gained a repair row: two entry
 * points to the same purchase, and the *confirmation* is the part that must
 * not diverge. It says what the purchase does before it happens — including
 * when the honest answer is "nothing much", because a square in the middle of
 * a fortnight nobody was active in fills and joins no streak, and saying so is
 * worth more than the sale.
 */
export async function confirmAndRepair({
  day,
  today,
  filled,
  price,
  balance,
  left,
  perMonth,
  t,
  locale,
  repair,
}: ConfirmAndRepairInput): Promise<void> {
  if (left === 0) {
    await showAlert(t('activity.noRepairsTitle'), t('activity.perMonth', { count: perMonth }))
    return
  }

  const effect = repairEffect({ day, today, filled: new Set(filled), price, balance })
  if (!effect.affordable) {
    await showAlert(
      t('activity.notEnoughTokensTitle'),
      t('activity.notEnoughTokensBody', { price, balance }),
    )
    return
  }

  const label = dayLabel(day, { t, locale, now: new Date(`${today}T12:00:00`) })
  const streakLine = effect.changesStreak
    ? t('activity.streakChange', { before: effect.streakBefore, count: effect.streakAfter })
    : t('activity.noStreakChange')
  const confirmed = await confirmAlert({
    title: t('activity.fillInTitle', { day: label }),
    message: t('activity.balanceChange', {
      streakLine,
      before: balance,
      after: effect.balanceAfter,
    }),
    confirmLabel: t('activity.fillIt'),
  })
  if (!confirmed) return

  repair(day, {
    onSuccess: () => showToast(t('activity.filled')),
    onError: () => void showAlert(t('activity.fillFailed'), t('common.retry')),
  })
}
