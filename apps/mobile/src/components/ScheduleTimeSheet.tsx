import Feather from '@expo/vector-icons/Feather'
import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useV3Home } from '../hooks/useV3Home'
import { useLocale, useT } from '../i18n'
import { defaultScheduleTime, scheduleDays, scheduleSlots } from '../lib/scheduleTime'
import { makeStyles, useTheme } from '../lib/theme'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'

/**
 * "Pick a time" for a message that goes later: a row of days and a row of half
 * hours, as chips.
 *
 * Chips rather than `DateTimePicker`, for the reason `propose-time` gives —
 * the picker has no web build, and a time inside the next week on a half hour
 * is decided as "tomorrow evening", not by scrolling a calendar. A sheet over
 * the thread rather than a screen of its own, so the words being scheduled
 * stay in the composer and never travel in a route's parameters.
 */
export function ScheduleTimeSheet({
  visible,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (at: Date) => void
}) {
  // Mounted only while open, so each opening starts from a fresh "now".
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {visible ? <SheetBody busy={busy} onClose={onClose} onConfirm={onConfirm} /> : null}
    </Modal>
  )
}

function SheetBody({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean
  onClose: () => void
  onConfirm: (at: Date) => void
}) {
  const current = useStyles()
  const redesigned = useStylesV3()
  const v3Look = useV3Home()
  const styles = v3Look ? redesigned : current
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const t = useT()
  const { locale } = useLocale()
  /** v3 draws its choices as its own pills; the current look keeps `Chip`. */
  const Choice = v3Look ? ChoiceV3 : Chip
  const [now] = useState(() => new Date())
  const [at, setAt] = useState(() => defaultScheduleTime(now))

  const days = useMemo(() => scheduleDays(now), [now])
  const day = days.find((d) => d.toDateString() === at.toDateString()) ?? days[0] ?? now
  const slots = useMemo(() => scheduleSlots(day, now), [day, now])

  /** Keeps the clock time when the day changes, or takes that day's first free slot. */
  function pickDay(next: Date): void {
    const onDay = scheduleSlots(next, now)
    const same = onDay.find(
      (s) => s.getHours() === at.getHours() && s.getMinutes() === at.getMinutes(),
    )
    const first = same ?? onDay[0]
    if (first) setAt(first)
  }

  return (
    <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
      {/* Swallows the press so tapping the sheet does not close it. */}
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <View
          style={[
            styles.content,
            // v3 keeps Cancel clear of the home indicator; the current look is unchanged.
            v3Look && { paddingBottom: Math.max(v3.space[24], insets.bottom + v3.space[16]) },
          ]}
        >
          <Text style={styles.title}>{t('chat.scheduleTitle')}</Text>
          {/* The choice in words, for the reason `propose-time` gives: the
            selected chip can sit off-screen on the web. */}
          <Text style={styles.chosen}>
            {new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: 'numeric',
              minute: '2-digit',
            }).format(at)}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {days.map((d) =>
                scheduleSlots(d, now).length > 0 ? (
                  <Choice
                    key={d.toISOString()}
                    label={new Intl.DateTimeFormat(locale, {
                      weekday: 'short',
                      day: 'numeric',
                    }).format(d)}
                    selected={d.getTime() === day.getTime()}
                    onPress={() => pickDay(d)}
                  />
                ) : null,
              )}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {slots.map((slot) => (
                <Choice
                  key={slot.toISOString()}
                  label={new Intl.DateTimeFormat(locale, {
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(slot)}
                  selected={slot.getTime() === at.getTime()}
                  onPress={() => setAt(slot)}
                />
              ))}
            </View>
          </ScrollView>
          <Button label={t('chat.scheduleConfirm')} onPress={() => onConfirm(at)} loading={busy} />
          <Button label={t('common.cancel')} variant="neutral" onPress={onClose} />
        </View>
      </Pressable>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even in a wide window, like the other sheets.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxWidth: 480,
    width: '100%',
  },
  content: { gap: spacing.md, padding: spacing.lg },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  chosen: { color: colors.text, fontSize: 17, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: spacing.sm },
}))

/**
 * One day or one half hour in v3's look: the grey pill at the 48pt target,
 * the ink pill with a tick when chosen — as `FilterChipV3` and the v3
 * propose-time page draw a choice — and a radio to a screen reader, since a
 * row of them picks one.
 */
function ChoiceV3({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const styles = useChoiceStylesV3()
  const { v3 } = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected && styles.on, pressed && styles.pressed]}
    >
      {selected ? <Feather name="check" size={v3.icon.sm} color={v3.colors.pillText} /> : null}
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
  )
}

/**
 * v3's look for the same sheet, behind `flags.v3Home` with the thread. No
 * board draws it; it follows `WhatsProSheet` for the sheet and the v3
 * propose-time page for the choice, which it says in words on the blue tint.
 * The yellow is Schedule's, the sheet's one committing action.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  backdrop: { backgroundColor: v3.colors.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.block,
    borderTopRightRadius: v3.radius.block,
    maxWidth: 480,
    width: '100%',
  },
  content: {
    gap: v3.space[12],
    paddingBottom: v3.space[24],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[24],
  },
  title: { ...v3.type.headline, color: v3.colors.fg },
  chosen: {
    ...v3.type.button,
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.row,
    color: v3.colors.fg,
    overflow: 'hidden',
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[12],
  },
  chips: { flexDirection: 'row', gap: v3.space[8] },
}))

const useChoiceStylesV3 = makeStyles(({ v3 }) => ({
  pill: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    height: 48,
    paddingHorizontal: v3.space[16],
  },
  on: { backgroundColor: v3.colors.pill, paddingStart: v3.space[12] },
  pressed: { opacity: 0.7 },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg },
  labelOn: { color: v3.colors.pillText },
}))
