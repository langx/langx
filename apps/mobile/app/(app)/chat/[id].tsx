import { useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { keys, useMe, useMessages, type MessageDto } from '../../../src/api/queries'
import { api } from '../../../src/api/client'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Screen } from '../../../src/components/ui/Screen'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import { emitWithAck, getSocket } from '../../../src/lib/socket'
import { colors, font, radius, spacing } from '../../../src/lib/theme'

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const conversationId = id ?? ''
  const me = useMe()
  const queryClient = useQueryClient()
  const messages = useMessages(conversationId)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [correcting, setCorrecting] = useState<MessageDto | null>(null)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const listRef = useRef<FlatList<MessageDto>>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const items = messages.data?.items ?? []
  const partnerId = items.find((m) => m.senderId !== me.data?._id)?.senderId ?? ''
  const partners = useProfileCache(partnerId ? [partnerId] : [])
  const partner = partners[partnerId]

  // Opening the thread is the read receipt. Doing it here rather than on a
  // scroll-to-bottom keeps it honest for short threads that never scroll.
  useEffect(() => {
    if (!conversationId) return
    void api.post(`/conversations/${conversationId}/read`).then(() => {
      void queryClient.invalidateQueries({ queryKey: keys.conversations })
    })
  }, [conversationId, queryClient])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const socket = await getSocket()
      if (cancelled) return
      const onTyping = (event: { conversationId: string; isTyping: boolean }) => {
        if (event.conversationId === conversationId) setPartnerTyping(event.isTyping)
      }
      socket.on('typing', onTyping)
      return () => socket.off('typing', onTyping)
    })()
    return () => {
      cancelled = true
    }
  }, [conversationId])

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      void getSocket().then((socket) => socket.emit('typing', { conversationId, isTyping }))
    },
    [conversationId],
  )

  function onChangeDraft(text: string): void {
    setDraft(text)
    notifyTyping(text.length > 0)
    if (typingTimer.current) clearTimeout(typingTimer.current)
    // Stop advertising "typing" if they pause — otherwise the indicator sticks
    // on the other side until the message is finally sent.
    typingTimer.current = setTimeout(() => notifyTyping(false), 3000)
  }

  async function send(): Promise<void> {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const socket = await getSocket()
      if (correcting) {
        await emitWithAck(socket, 'message:correct', {
          conversationId,
          targetMessageId: correcting._id,
          corrected: body,
        })
        setCorrecting(null)
      } else {
        await emitWithAck(socket, 'message:send', { conversationId, body })
      }
      setDraft('')
      notifyTyping(false)
    } finally {
      setSending(false)
    }
  }

  const isMine = (message: MessageDto) => message.senderId === me.data?._id

  return (
    <Screen fluid style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Pressable
          style={styles.headerUser}
          onPress={() => partner && router.push(`/(app)/profile/${partner.handle}`)}
        >
          <Avatar url={partner?.avatarUrl} name={partner?.displayName ?? '?'} size={32} />
          <View>
            <Text style={styles.headerName}>{partner?.displayName ?? 'Sohbet'}</Text>
            {partnerTyping ? <Text style={styles.typing}>yazıyor…</Text> : null}
          </View>
        </Pressable>
      </View>

      {messages.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = isMine(item)
            if (item.type === 'correction') {
              return (
                <View style={[styles.correction, mine ? styles.mine : styles.theirs]}>
                  <Text style={styles.correctionLabel}>✏️ Düzeltme</Text>
                  {item.correction ? (
                    <Text style={styles.correctionOriginal}>{item.correction.original}</Text>
                  ) : null}
                  <Text style={styles.correctionText}>{item.body}</Text>
                  {item.correction?.note ? (
                    <Text style={styles.correctionNote}>{item.correction.note}</Text>
                  ) : null}
                </View>
              )
            }
            return (
              <Pressable
                // Long-press someone else's message to correct it — the
                // teaching gesture, and the highest-XP action in the app.
                onLongPress={() => {
                  if (mine) return
                  setCorrecting(item)
                  setDraft(item.body)
                }}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
              >
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              </Pressable>
            )
          }}
        />
      )}

      {correcting ? (
        <View style={styles.correctingBanner}>
          <Text style={styles.correctingText} numberOfLines={1}>
            Düzeltiliyor: “{correcting.body}”
          </Text>
          <Pressable
            onPress={() => {
              setCorrecting(null)
              setDraft('')
            }}
            hitSlop={8}
          >
            <Text style={styles.correctingCancel}>Vazgeç</Text>
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={correcting ? 'Doğrusunu yaz…' : 'Mesaj yaz…'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            onSubmitEditing={() => void send()}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
          >
            <Text style={styles.sendLabel}>{sending ? '…' : '↑'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: { color: colors.text, fontSize: 30, lineHeight: 32 },
  headerUser: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  headerName: { ...font.body, color: colors.text, fontWeight: '700' },
  typing: { ...font.caption, color: colors.accent },
  loading: { marginTop: spacing.xxl },
  list: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  bubble: {
    borderRadius: radius.lg,
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  bubbleText: { ...font.body, color: colors.text },
  bubbleTextMine: { color: colors.primaryText },
  correction: {
    borderColor: colors.success,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: '85%',
    padding: spacing.md,
  },
  correctionLabel: { ...font.caption, color: colors.success, fontWeight: '700' },
  correctionOriginal: {
    ...font.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textDecorationLine: 'line-through',
  },
  correctionText: { ...font.body, color: colors.text, marginTop: 2 },
  correctionNote: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  correctingBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  correctingText: { ...font.caption, color: colors.textMuted, flex: 1 },
  correctingCancel: { ...font.caption, color: colors.danger, fontWeight: '700' },
  composer: {
    alignItems: 'flex-end',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    color: colors.text,
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...font.body,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendDisabled: { opacity: 0.35 },
  sendLabel: { color: colors.primaryText, fontSize: 20, fontWeight: '700' },
})
