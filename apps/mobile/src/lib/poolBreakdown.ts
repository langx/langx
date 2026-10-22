import type { TranslateFn } from '../i18n/runtime'

/**
 * "6 messages, 1 correction, 3 people." — today's counts on the pool screen.
 *
 * Each count picks its own plural noun: one template with three numbers in it
 * cannot, and wrote "1 messages" in English and the wrong case for every
 * number past two in Russian and Arabic.
 */
export function todayBreakdown(
  t: TranslateFn,
  today: { messages: number; corrections: number; distinctPartners: number },
): string {
  return t('tokens.todayBreakdown', {
    messages: `${today.messages} ${t('tokens.todayMessages', { count: today.messages })}`,
    corrections: `${today.corrections} ${t('tokens.todayCorrections', { count: today.corrections })}`,
    partners: `${today.distinctPartners} ${t('tokens.todayPeople', { count: today.distinctPartners })}`,
  })
}
