import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { giftState, giftTickDelay } from '../../lib/gift'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * The hourly gift, at the top of the store.
 *
 * Two states and nothing in between: ready, when the whole card is the button
 * that opens it; or counting down, when it is a muted line saying how long.
 * The countdown ticks on the minute boundary rather than every second — a
 * second hand on a card that will not open for forty minutes is a nag.
 *
 * Feather's `gift`, deliberately — the token brief allows `award` and `gift`
 * and nothing that looks like a coin, a chip or a wheel.
 */
export function GiftCard({ nextAt, onOpen }: { nextAt: string | null; onOpen: () => void }) {
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const [now, setNow] = useState(() => new Date())
  const state = giftState(nextAt, now)

  useEffect(() => {
    if (state.ready) return
    const timer = setTimeout(() => setNow(new Date()), giftTickDelay(state.remainingMs))
    return () => clearTimeout(timer)
  }, [state, nextAt])

  if (state.ready) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('gift.openAccessibility')}
        onPress={onOpen}
        style={({ pressed }) => [styles.card, styles.ready, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Feather name="gift" size={26} color={colors.accent} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{t('gift.title')}</Text>
          <Text style={styles.readyLine}>{t('gift.ready')}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.accent} />
      </Pressable>
    )
  }

  return (
    <View style={styles.card} accessibilityRole="text">
      <View style={styles.icon}>
        <Feather name="gift" size={26} color={colors.textFaint} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{t('gift.title')}</Text>
        <Text style={styles.meta}>{t('gift.nextIn', { minutes: state.minutes })}</Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  card: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  ready: { backgroundColor: colors.accentBg, borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  icon: { alignItems: 'center', justifyContent: 'center', width: 32 },
  text: { flex: 1, gap: 2 },
  title: { ...font.body, color: colors.text, fontWeight: '600' },
  readyLine: { ...font.caption, color: colors.accent, fontWeight: '600' },
  meta: { ...font.caption, color: colors.textMuted },
}))
