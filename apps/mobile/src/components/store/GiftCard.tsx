import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { giftState, giftTickDelay } from '../../lib/gift'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * The hourly gift, on the wallet's landing page.
 *
 * Two states and nothing in between: ready, when the whole card is yellow and
 * is the button that opens it; or counting down, when it is a grey block
 * saying how long. The countdown ticks on the minute boundary rather than
 * every second — a second hand on a card that will not open for forty minutes
 * is a nag.
 *
 * Yellow here is the screen's one committing control — the wallet has no
 * other — and it is the only card v3 keeps: a block that turns into a button
 * once an hour earns its corners.
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
        <Feather name="gift" size={28} color={colors.primaryText} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.primaryText }]}>{t('gift.title')}</Text>
          <Text style={[styles.status, { color: colors.primaryText }]}>{t('gift.ready')}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.primaryText} />
      </Pressable>
    )
  }

  /*
   * Not pressable while it counts down: the gift route sends anyone who
   * arrives with nothing to open straight back here, so a card that led there
   * would be a door that opens onto the same room. No chevron for the same
   * reason — it would promise the trip.
   */
  return (
    <View style={[styles.card, styles.waiting]} accessibilityRole="text">
      <Feather name="gift" size={28} color={colors.text} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{t('gift.title')}</Text>
        <Text style={[styles.status, { color: colors.text }]}>
          {t('gift.nextIn', { minutes: state.minutes })}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  card: {
    alignItems: 'center',
    // 20: between `lg` and `xl`, the one radius v3 draws a block of this size at.
    borderRadius: 20,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  ready: { backgroundColor: colors.primary },
  waiting: { backgroundColor: colors.fill },
  pressed: { opacity: 0.85 },
  text: { flex: 1, gap: 2 },
  title: { ...font.heading, fontSize: 17 },
  // The face's own colour at three quarters, so it reads as the second line on
  // yellow and on grey alike without a second token for each.
  status: { fontSize: 14, opacity: 0.75 },
}))
