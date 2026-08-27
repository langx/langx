import { useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  keys,
  uploadMessageMedia,
  useMe,
  useMessages,
  useTranslate,
  type MessageDto,
} from '../../../src/api/queries'
import { api, ApiRequestError } from '../../../src/api/client'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Screen } from '../../../src/components/ui/Screen'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import * as ImagePicker from 'expo-image-picker'
import { AudioBubble, ImageBubble } from '../../../src/components/MediaBubble'
import { MessageMeta } from '../../../src/components/MessageMeta'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
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
  // Keyed by message id: a translation replaces nothing, it sits under the
  // original so the learner can compare the two.
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translating, setTranslating] = useState<string | null>(null)
  const listRef = useRef<FlatList<MessageDto>>(null)
  const translateApi = useTranslate()
  const recorder = useVoiceRecorder()
  const [sendingMedia, setSendingMedia] = useState(false)
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

  async function sendMedia(
    kind: 'image' | 'audio',
    input: {
      uri: string
      contentType: string
      durationSeconds?: number
      width?: number
      height?: number
    },
  ): Promise<void> {
    setSendingMedia(true)
    try {
      const media = await uploadMessageMedia({ conversationId, kind, ...input })
      const socket = await getSocket()
      await emitWithAck(socket, 'message:media', { conversationId, kind, media })
    } catch (error) {
      Alert.alert(
        'Could not send',
        error instanceof ApiRequestError && error.code === 'QUOTA_EXCEEDED'
          ? "You've reached today's limit for photos and voice messages."
          : 'That attachment could not be sent. Try again.',
      )
    } finally {
      setSendingMedia(false)
    }
  }

  async function pickImage(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photos', 'LangX needs permission to open your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    })
    const asset = result.assets?.[0]
    if (result.canceled || !asset) return
    await sendMedia('image', {
      uri: asset.uri,
      contentType: asset.mimeType ?? 'image/jpeg',
      // Sent so the bubble can reserve the right height before the bytes land.
      ...(asset.width ? { width: asset.width } : {}),
      ...(asset.height ? { height: asset.height } : {}),
    })
  }

  async function toggleRecording(): Promise<void> {
    if (!recorder.isRecording) {
      const started = await recorder.start()
      if (!started && recorder.error) Alert.alert('Microphone', recorder.error)
      return
    }
    const recording = await recorder.stop()
    if (!recording) return
    await sendMedia('audio', recording)
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

  /**
   * Translates into the caller's first native language — the one they read
   * fluently. Asking which language every time would be a question with an
   * obvious answer, and translating into what they are *learning* would defeat
   * the purpose.
   */
  async function translate(message: MessageDto): Promise<void> {
    const target = me.data?.nativeLanguages[0]?.code
    if (!target || translations[message._id]) return
    setTranslating(message._id)
    try {
      const result = await translateApi.mutateAsync({ text: message.body, targetLang: target })
      setTranslations((current) => ({ ...current, [message._id]: result.translatedText }))
    } catch (error) {
      Alert.alert(
        'Translation unavailable',
        error instanceof ApiRequestError && error.code === 'QUOTA_EXCEEDED'
          ? "You've used today's free translations. Pro removes the limit."
          : 'Could not translate that message right now.',
      )
    } finally {
      setTranslating(null)
    }
  }

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
            <Text style={styles.headerName}>{partner?.displayName ?? 'Chat'}</Text>
            {partnerTyping ? <Text style={styles.typing}>typing…</Text> : null}
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
                  <Text style={styles.correctionLabel}>✏️ Correction</Text>
                  {item.correction ? (
                    <Text style={styles.correctionOriginal}>{item.correction.original}</Text>
                  ) : null}
                  <Text style={styles.correctionText}>{item.body}</Text>
                  {item.correction?.note ? (
                    <Text style={styles.correctionNote}>{item.correction.note}</Text>
                  ) : null}
                  <MessageMeta message={item} mine={mine} />
                </View>
              )
            }
            if (item.type === 'image' || item.type === 'audio') {
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {item.type === 'image' ? (
                    <ImageBubble message={item} />
                  ) : (
                    <AudioBubble message={item} mine={mine} />
                  )}
                  {item.body ? (
                    <Text
                      style={[styles.bubbleText, mine && styles.bubbleTextMine, styles.caption]}
                    >
                      {item.body}
                    </Text>
                  ) : null}
                  <MessageMeta message={item} mine={mine} />
                </View>
              )
            }

            const translated = translations[item._id]
            return (
              <Pressable
                // Long-press someone else's message to correct it — the
                // teaching gesture, and the highest-earning action in the app.
                onLongPress={() => {
                  if (mine) return
                  setCorrecting(item)
                  setDraft(item.body)
                }}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
              >
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
                {translated ? (
                  <Text style={[styles.translation, mine && styles.translationMine]}>
                    {translated}
                  </Text>
                ) : null}
                {/* Only offered on the other person's messages: translating your
                    own is a round trip to something you already understand. */}
                {!mine && !translated ? (
                  <Pressable onPress={() => void translate(item)} hitSlop={6}>
                    <Text style={styles.translateLink}>
                      {translating === item._id ? 'Translating…' : 'Translate'}
                    </Text>
                  </Pressable>
                ) : null}
                <MessageMeta message={item} mine={mine} />
              </Pressable>
            )
          }}
        />
      )}

      {correcting ? (
        <View style={styles.correctingBanner}>
          <Text style={styles.correctingText} numberOfLines={1}>
            Correcting: “{correcting.body}”
          </Text>
          <Pressable
            onPress={() => {
              setCorrecting(null)
              setDraft('')
            }}
            hitSlop={8}
          >
            <Text style={styles.correctingCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          {recorder.isRecording ? (
            <View style={styles.recording}>
              <Text style={styles.recordingDot}>●</Text>
              <Text style={styles.recordingTime}>
                {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, '0')}
              </Text>
              <Pressable onPress={() => void recorder.cancel()} hitSlop={8}>
                <Text style={styles.recordingCancel}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => void pickImage()}
              disabled={sendingMedia}
              hitSlop={8}
              style={styles.attach}
            >
              <Text style={styles.attachIcon}>📷</Text>
            </Pressable>
          )}
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={correcting ? 'Write the correction…' : 'Write a message…'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            onSubmitEditing={() => void send()}
          />
          {/* The button becomes a microphone when there is nothing to send,
              which is the gesture people already expect from a chat app. */}
          {draft.trim() ? (
            <Pressable
              onPress={() => void send()}
              disabled={sending}
              style={[styles.sendButton, sending && styles.sendDisabled]}
            >
              <Text style={styles.sendLabel}>{sending ? '…' : '↑'}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void toggleRecording()}
              disabled={sendingMedia}
              style={[
                styles.sendButton,
                recorder.isRecording && styles.recordButtonActive,
                sendingMedia && styles.sendDisabled,
              ]}
            >
              <Text style={styles.sendLabel}>{recorder.isRecording ? '■' : '🎤'}</Text>
            </Pressable>
          )}
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
  translation: {
    ...font.caption,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    color: colors.textMuted,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  translationMine: { borderTopColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.75)' },
  translateLink: { ...font.caption, color: colors.accent, marginTop: spacing.xs },
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
  recordButtonActive: { backgroundColor: colors.danger },
  attach: { paddingBottom: spacing.sm, paddingRight: spacing.xs },
  attachIcon: { fontSize: 22 },
  caption: { marginTop: spacing.xs },
  recording: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  recordingDot: { color: colors.danger, fontSize: 12 },
  recordingTime: { ...font.caption, color: colors.text, fontVariant: ['tabular-nums'] },
  recordingCancel: { ...font.caption, color: colors.textMuted },
  sendLabel: { color: colors.primaryText, fontSize: 20, fontWeight: '700' },
})
