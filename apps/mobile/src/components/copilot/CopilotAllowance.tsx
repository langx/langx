import type { CopilotStatus } from '@langx/shared'
import { Text } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'

/**
 * A time of day in the reader's own way of writing one — "15:40", "3:40 PM".
 * Empty when the server sent something that is not a time, so the caller can
 * fall back to the sentence without one.
 */
export function copilotTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(at)
}

/**
 * "{count} left today", or "More at {time}" once nothing is left — under the
 * Copilot card and the Explain sheet.
 *
 * Nothing at all for an unlimited plan (`limit: null`): a count that never
 * goes down is not information, and nothing here ever offers an upgrade —
 * Pro users must never be sold Pro, and the paywall never names Copilot as a
 * feature it unlocks (`sellableFeature`). Nothing either before `GET /copilot`
 * has answered.
 */
export function CopilotAllowance({ quota }: { quota: CopilotStatus['quota'] | undefined }) {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  if (!quota || quota.limit === null || quota.remaining === null) return null
  if (quota.remaining > 0) {
    return <Text style={styles.line}>{t('copilot.left', { count: quota.remaining })}</Text>
  }
  const time = copilotTime(quota.nextAvailableAt, locale)
  return time ? <Text style={styles.line}>{t('copilot.moreAt', { time })}</Text> : null
}

const useStyles = makeStyles(({ v3 }) => ({
  line: { ...v3.type.caption, color: v3.colors.muted },
}))
