import Feather from '@expo/vector-icons/Feather'
import type { ScheduleMessageInput, ScheduledMessageDto } from '@langx/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, Text, View } from 'react-native'
import { api } from '../api/client'
import { useLocale, useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'

const scheduledKey = (conversationId: string) => ['scheduled', conversationId] as const

/**
 * How often the list asks again while something in it is still waiting. The
 * scheduler sends once a minute and says nothing to the author when it does —
 * the message simply arrives in the thread — so this is how the row makes way
 * for it, or turns into "could not be sent".
 */
const WAITING_REFETCH_MS = 20_000

/** The author's messages waiting to go out in one thread. Only ever theirs. */
export function useScheduledMessages(conversationId: string) {
  return useQuery({
    queryKey: scheduledKey(conversationId),
    queryFn: () =>
      api.get<{ items: ScheduledMessageDto[] }>(`/conversations/${conversationId}/scheduled`),
    select: (data) => data.items,
    enabled: conversationId.length > 0,
    refetchInterval: (query) =>
      query.state.data?.items.some((row) => row.status !== 'failed') ? WAITING_REFETCH_MS : false,
  })
}

export function useScheduleMessage(conversationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ScheduleMessageInput) =>
      api.post<ScheduledMessageDto>(`/conversations/${conversationId}/scheduled`, input),
    onSettled: () => client.invalidateQueries({ queryKey: scheduledKey(conversationId) }),
  })
}

function useCancelScheduled(conversationId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/scheduled/${id}`),
    // Settled rather than succeeded: a cancel refused because the row was
    // already on its way should show the row leaving, not stay stuck on it.
    onSettled: () => client.invalidateQueries({ queryKey: scheduledKey(conversationId) }),
  })
}

/**
 * The waiting messages, at the foot of the thread where the next message will
 * appear — drawn as your own bubbles, dimmed, with when they go and a way to
 * take them back. A failed one stays, outlined like an unsent message, until
 * it is dismissed: the author was not there when it failed, and a row that
 * quietly vanished would read as sent.
 */
export function ScheduledMessageRows({ conversationId }: { conversationId: string }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const scheduled = useScheduledMessages(conversationId)
  const cancel = useCancelScheduled(conversationId)

  const rows = scheduled.data ?? []
  if (rows.length === 0) return null

  const when = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <View style={styles.block}>
      {rows.map((row) => {
        const failed = row.status === 'failed'
        const due = !failed && new Date(row.sendAt).getTime() <= Date.now()
        return (
          <View key={row._id} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={failed ? t('chat.scheduledDismiss') : t('chat.scheduledCancel')}
              hitSlop={10}
              disabled={row.status === 'sending'}
              onPress={() => cancel.mutate(row._id)}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={[styles.bubble, failed ? styles.bubbleFailed : styles.bubbleWaiting]}>
              <Text style={[styles.body, !failed && styles.onPrimary]} numberOfLines={3}>
                {row.body}
              </Text>
              <Text style={[styles.note, failed ? styles.noteFailed : styles.onPrimaryMuted]}>
                <Feather name={failed ? 'alert-circle' : 'clock'} size={12} />{' '}
                {failed
                  ? t('chat.scheduledNotSent')
                  : due || row.status === 'sending'
                    ? t('chat.scheduledSending')
                    : t('chat.scheduledFor', { time: when.format(new Date(row.sendAt)) })}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  block: { gap: spacing.xs, paddingTop: spacing.xs },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  bubble: {
    alignSelf: 'flex-end',
    borderRadius: 20,
    flexShrink: 1,
    gap: 2,
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  /** Your own bubble's fill, faded: yours, and not sent yet. */
  bubbleWaiting: { backgroundColor: colors.primary, opacity: 0.55 },
  bubbleFailed: { borderColor: colors.danger, borderWidth: 1 },
  body: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 24 },
  note: { ...font.caption, color: colors.textMuted, fontSize: 12 },
  noteFailed: { color: colors.danger },
  onPrimary: { color: colors.primaryText },
  onPrimaryMuted: { color: colors.primaryTextMuted },
}))
