import { MEETING_DURATIONS, MEETING_NOTE_MAX_LENGTH } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useLocale, useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { emitWithAck, getSocket } from '../../src/lib/socket'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { defaultStart, SLOT_WIDTH, SLOTS } from '../../src/lib/meetingSlots'
import { useV3Home } from '../../src/hooks/useV3Home'
import { ProposeTimeScreenV3 } from '../../src/screens/chat/ProposeTimeScreenV3'

/**
 * Proposing a time to talk.
 *
 * **It arranges; it does not dial.** The call itself starts from the thread —
 * its header, or the agreed card's "Call now" once the time is close, on a
 * build that can carry one. Nothing here says "call", because a proposal is a
 * question about when, and a build without calling still has to be able to
 * ask it.
 *
 * The picker writes a `Date`, which carries the device's zone, and the server
 * stores the instant. Each reader's card is then drawn in *their* profile's
 * zone, which is the arithmetic this exists to save two people in different
 * countries from doing in their heads.
 */
export default function ProposeTimeRoute() {
  // The redesign's page under `flags.v3Home`, read once per launch.
  return useV3Home() ? <ProposeTimeScreenV3 /> : <ProposeTimeScreen />
}

function ProposeTimeScreen() {
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()

  const [startsAt, setStartsAt] = useState(defaultStart)
  const [minutes, setMinutes] = useState<number>(30)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const back = (): void => goBackTo(`/(app)/chat/${conversationId}`)

  /**
   * Days and half-hours as chips, not a `DateTimePicker`.
   *
   * The picker has no web implementation, which `BirthDateField` solves with
   * a `.web.tsx` sibling — the house convention, and the right one there,
   * because a birth date is any day in a century and only a calendar can
   * offer that.
   *
   * A meeting is not. It is inside the next week, on a half hour, and it is
   * decided as "tomorrow evening" rather than by scrolling to a date. Chips
   * say that in one file instead of two, and the row of days doubles as the
   * range: there is no way to propose something a year out by accident.
   */
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
    // Checked here as well as on the server: the server is the authority, but
    // being told "that time has passed" after the card is already in the
    // thread would be a refusal arriving too late to act on.
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

  return (
    <Screen scroll>
      <ScreenHeader title={t('chat.sendMeeting')} onBack={back} />
      <View style={styles.form}>
        <Text style={styles.label}>{t('chat.meetingWhenLabel')}</Text>
        {/*
          The choice in words, above the rows that make it.
          `contentOffset` opens the time row near the chosen slot on a device
          and is ignored by react-native-web, so on the web the selected chip
          can be off-screen — and a picker whose answer you have to go looking
          for is not one. This line always says it.
        */}
        <Text style={styles.chosen}>
          {new Intl.DateTimeFormat(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: 'numeric',
            minute: '2-digit',
          }).format(startsAt)}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.durations}>
            {days.map((day) => (
              <Chip
                key={day.toISOString()}
                label={new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' }).format(
                  day,
                )}
                selected={sameDay(day, startsAt)}
                onPress={() => pickDay(day)}
              />
            ))}
          </View>
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: Math.max(0, (selectedSlot - 2) * SLOT_WIDTH), y: 0 }}
        >
          <View style={styles.durations}>
            {SLOTS.map(({ hour, minute }) => {
              const at = new Date(startsAt)
              at.setHours(hour, minute, 0, 0)
              return (
                <Chip
                  key={`${hour}:${minute}`}
                  label={new Intl.DateTimeFormat(locale, {
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(at)}
                  selected={startsAt.getHours() === hour && startsAt.getMinutes() === minute}
                  onPress={() => pickSlot(hour, minute)}
                />
              )
            })}
          </View>
        </ScrollView>

        <Text style={styles.label}>{t('chat.meetingLength')}</Text>
        <View style={styles.durations}>
          {MEETING_DURATIONS.map((option) => (
            <Chip
              key={option}
              label={t('format.minutes', { count: option })}
              selected={minutes === option}
              onPress={() => setMinutes(option)}
            />
          ))}
        </View>

        <FormField
          label={t('chat.meetingNote')}
          value={note}
          onChangeText={setNote}
          maxLength={MEETING_NOTE_MAX_LENGTH}
        />
        <Button label={t('common.send')} onPress={() => void propose()} loading={sending} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
  label: { ...font.label, color: colors.textMuted },
  chosen: { color: colors.text, fontSize: 17, fontWeight: '700' },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}))
