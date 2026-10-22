import { MEETING_DURATIONS, MEETING_NOTE_MAX_LENGTH } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Screen } from '../../components/ui/Screen'
import { useLocale, useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { defaultStart, SLOT_WIDTH, SLOTS } from '../../lib/meetingSlots'
import { goBackTo } from '../../lib/navigation'
import { emitWithAck, getSocket } from '../../lib/socket'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * Proposing a time to talk, in the redesign's look (`V-ProposeTime`), behind
 * `flags.v3Home`. The days, the slots, the past-time refusal and the
 * `message:meeting` emit are `propose-time.tsx`'s; read its comments for why
 * it arranges rather than dials and why the choices are chips. The board's
 * chips are bigger — the seven days a row of squares, the times and the
 * lengths 52pt pills — and the chosen time is a block of its own above them.
 */
export function ProposeTimeScreenV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()

  const [startsAt, setStartsAt] = useState(defaultStart)
  const [minutes, setMinutes] = useState<number>(30)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)

  const days = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today)
      day.setDate(day.getDate() + i)
      return day
    })
  }, [])

  function pickDay(day: Date): void {
    const next = new Date(day)
    next.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0)
    setStartsAt(next)
  }

  function pickSlot(hour: number, minute: number): void {
    const next = new Date(startsAt)
    next.setHours(hour, minute, 0, 0)
    setStartsAt(next)
  }

  const sameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString()

  const selectedSlot = SLOTS.findIndex(
    (slot) => slot.hour === startsAt.getHours() && slot.minute === startsAt.getMinutes(),
  )

  async function propose(): Promise<void> {
    // As in `propose-time.tsx`: refused here too, before the card is in the thread.
    if (startsAt.getTime() <= Date.now()) {
      await showAlert(t('chat.meetingPast'))
      return
    }
    setSending(true)
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:meeting', {
        conversationId,
        startsAt: startsAt.toISOString(),
        durationMinutes: minutes,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      back()
    } catch (caught) {
      void caught
      setSending(false)
      await showAlert(t('chat.couldNotSend'))
    }
  }

  const chosen = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(startsAt)

  return (
    <Screen scroll ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('chat.sendMeeting')} onBack={back} />
      <View style={styles.form}>
        <Text style={styles.lede}>{t('chat.meetingLede')}</Text>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {t('chat.meetingWhenLabel')}
          </Text>
          {/* The choice in words, above the rows that make it — see `propose-time.tsx`. */}
          <View style={styles.chosen} accessibilityLiveRegion="polite">
            <Text style={styles.chosenTime}>{chosen}</Text>
            <Text style={styles.chosenZone}>
              {t('chat.meetingYourTime', {
                time: new Intl.DateTimeFormat(locale, {
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(startsAt),
              })}
            </Text>
          </View>

          <View
            style={styles.days}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('chat.meetingDay')}
          >
            {days.map((day) => {
              const on = sameDay(day, startsAt)
              return (
                <Pressable
                  key={day.toISOString()}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={new Intl.DateTimeFormat(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }).format(day)}
                  onPress={() => pickDay(day)}
                  style={[styles.day, on && styles.on]}
                >
                  <Text style={[styles.dayWeek, on && styles.onText]}>
                    {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day)}
                  </Text>
                  <Text style={[styles.dayNum, on && styles.onText]}>
                    {new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(day)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: Math.max(0, (selectedSlot - 2) * SLOT_WIDTH), y: 0 }}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('chat.meetingTime')}
          >
            <View style={styles.row}>
              {SLOTS.map(({ hour, minute }) => {
                const at = new Date(startsAt)
                at.setHours(hour, minute, 0, 0)
                const on = startsAt.getHours() === hour && startsAt.getMinutes() === minute
                return (
                  <Pressable
                    key={`${hour}:${minute}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => pickSlot(hour, minute)}
                    style={[styles.pill, on && styles.on]}
                  >
                    <Text style={[styles.pillText, on && styles.onText]}>
                      {new Intl.DateTimeFormat(locale, {
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(at)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {t('chat.meetingLength')}
          </Text>
          <View
            style={styles.row}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('chat.meetingLength')}
          >
            {MEETING_DURATIONS.map((option) => {
              const on = minutes === option
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setMinutes(option)}
                  style={[styles.pill, styles.length, on && styles.on]}
                >
                  <Text style={[styles.pillText, on && styles.onText]} numberOfLines={1}>
                    {t('format.minutes', { count: option })}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <FormField
            label={t('chat.meetingNote')}
            value={note}
            onChangeText={setNote}
            maxLength={MEETING_NOTE_MAX_LENGTH}
          />
          <Text style={styles.hint}>
            {t('chat.meetingNoteHint', { count: MEETING_NOTE_MAX_LENGTH })}
          </Text>
        </View>

        <Button
          label={t('common.send')}
          icon="send"
          onPress={() => void propose()}
          loading={sending}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  form: { gap: v3.space[14], paddingBottom: v3.space[16], paddingTop: v3.space[4] },
  lede: { ...v3.type.callout, color: v3.colors.muted, lineHeight: 22, paddingStart: v3.space[4] },
  section: { gap: v3.space[8] },
  heading: {
    ...v3.type.label,
    color: v3.colors.fg,
    fontSize: 16,
    lineHeight: 20,
    paddingStart: v3.space[4],
  },
  // The board's tangerine block, a step deeper after dark as every partner
  // hue is, with ink on it in both schemes; the blue tint read as Echo's.
  chosen: {
    backgroundColor: v3.hues.tangerine,
    borderRadius: v3.radius.tile,
    gap: v3.space[2],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[12],
  },
  chosenTime: { ...v3.type.headline, color: v3.colors.ink, fontFamily: v3.type.title.fontFamily },
  chosenZone: { ...v3.type.caption, color: v3.colors.ink, fontSize: 15, fontWeight: '600' },
  days: { flexDirection: 'row', gap: v3.space[4] },
  day: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flex: 1,
    height: 68,
    justifyContent: 'center',
    minWidth: 0,
  },
  dayWeek: { ...v3.type.label, color: v3.colors.muted },
  dayNum: {
    ...v3.type.headline,
    color: v3.colors.fg,
    fontFamily: v3.type.title.fontFamily,
    fontSize: 20,
    lineHeight: 24,
  },
  row: { flexDirection: 'row', gap: v3.space[8] },
  pill: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: v3.space[20],
  },
  length: { flex: 1, minWidth: 0, paddingHorizontal: v3.space[8] },
  pillText: { ...v3.type.button, color: v3.colors.fg },
  // The chosen chip is the ink pill, as everywhere in v3.
  on: { backgroundColor: v3.colors.pill },
  onText: { color: v3.colors.pillText },
  hint: { ...v3.type.caption, color: v3.colors.muted, paddingStart: v3.space[20] },
}))
