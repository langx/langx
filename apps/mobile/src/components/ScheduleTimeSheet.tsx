import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocale, useT } from '../i18n'
import { defaultScheduleTime, scheduleDays, scheduleSlots } from '../lib/scheduleTime'
import { makeStyles } from '../lib/theme'
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
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
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
        <View style={styles.content}>
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
                  <Chip
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
                <Chip
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
