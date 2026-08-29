import Feather from '@expo/vector-icons/Feather'
import { PLAN_LIMITS, TOKEN_RULES } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native'
import {
  keys,
  uploadMessageMedia,
  useMe,
  useMessages,
  useReportUser,
  useTranslate,
  type MessageDto,
} from '../../../src/api/queries'
import * as Clipboard from 'expo-clipboard'
import { api } from '../../../src/api/client'
import { MessageBubble } from '../../../src/components/MessageBubble'
import { MessageBubbleSkeleton } from '../../../src/components/skeletons/MessageBubbleSkeleton'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Screen } from '../../../src/components/ui/Screen'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import * as ImagePicker from 'expo-image-picker'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { chooseAlert, showAlert } from '../../../src/lib/alert'
import { emitWithAck, getSocket } from '../../../src/lib/socket'
import { errorCodeOf } from '../../../src/lib/errors'
import { listState } from '../../../src/lib/listState'
import { shouldSubmitOnEnter } from '../../../src/lib/submitOnEnter'
import { messageActionsFor } from '../../../src/lib/messageActions'
import { openMessageMenu } from '../../../src/lib/messageMenu'
import { goBackTo } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { showToast } from '../../../src/lib/toast'
import { messagesNewestFirst } from '../../../src/lib/messageCache'
import { dayLabel, messageRows, type MessageRow } from '../../../src/lib/messageGroups'
import { makeStyles, useTheme } from '../../../src/lib/theme'

export default function ChatScreen() {
  const { colors } = useTheme()
  const styles = useStyles()

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
  const listRef = useRef<FlatList<MessageRow>>(null)
  /**
   * The newest message at the moment the reader scrolled away from the bottom,
   * or null while they are still there. It doubles as the jump button's
   * visibility and, via its position in `items`, as the count on it.
   */
  const [awayFrom, setAwayFrom] = useState<string | null>(null)
  const translateApi = useTranslate()
  const report = useReportUser()
  const recorder = useVoiceRecorder()
  const [sendingMedia, setSendingMedia] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const items = useMemo(() => messagesNewestFirst(messages.data), [messages.data])
  const rows = useMemo(() => messageRows(items), [items])
  // Newest first, so the anchor's index *is* how many arrived while away.
  const missed = awayFrom
    ? Math.max(
        0,
        items.findIndex((m) => String(m._id) === awayFrom),
      )
    : 0
  const state = listState({
    isPending: messages.isPending,
    isError: messages.isError,
    itemCount: items.length,
  })
  // From the participant list, not from the messages: a thread nobody has
  // replied to yet contains only my own sends, and reading the partner off
  // those leaves the header with no name and no avatar.
  // Optional on `participants` too: the response is a bare cast, so an API
  // older than this field would throw here rather than fall back.
  const partnerId = messages.data?.pages[0]?.participants?.find((p) => p !== me.data?._id) ?? ''
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
      // `emitWithAck` rejects with a plain Error carrying `.code`, not an
      // ApiRequestError, so the `instanceof` this used to do never matched
      // and the quota message had never once been shown.
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(
          'Could not send',
          "You've reached today's limit for photos and voice messages.",
        )
        openPaywall(undefined, `/(app)/chat/${conversationId}`)
      } else {
        void showAlert('Could not send', 'That attachment could not be sent. Try again.')
      }
    } finally {
      setSendingMedia(false)
    }
  }

  async function pickImage(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      void showAlert('Photos', 'LangX needs permission to open your photo library.')
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
      if (!started && recorder.error) void showAlert('Microphone', recorder.error)
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
      // Inverted, so the newest message is offset 0.
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      setAwayFrom(null)
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
  async function translate(message: MessageDto, alreadyTranslated: boolean): Promise<void> {
    const target = me.data?.nativeLanguages[0]?.code
    if (!target || alreadyTranslated) return
    setTranslating(message._id)
    try {
      const result = await translateApi.mutateAsync({ text: message.body, targetLang: target })
      setTranslations((current) => ({ ...current, [message._id]: result.translatedText }))
    } catch (error) {
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(
          'Translation unavailable',
          "You've used today's free translations. Pro removes the limit.",
        )
        // Bare, deliberately. `unlimitedTranslation` is a `ProBenefit` and
        // not a `PlanFeature` — it is a quota that stops applying rather than
        // a capability flag — so there is no key to pass. The paywall's Pro
        // column already lists it.
        openPaywall(undefined, `/(app)/chat/${conversationId}`)
      } else {
        await showAlert('Translation unavailable', 'Could not translate that message right now.')
      }
    } finally {
      setTranslating(null)
    }
  }

  /**
   * Long-press on any bubble. Correction used to *be* the gesture, on the
   * other person's text only; it is one row here, which is what let the other
   * three exist at all.
   */
  async function openActions(message: MessageDto, alreadyTranslated: boolean): Promise<void> {
    const actions = messageActionsFor({
      mine: isMine(message),
      type: message.type,
      hasBody: message.body.trim().length > 0,
      alreadyTranslated,
    })
    // Your own captionless voice note has nothing to offer; an empty sheet is
    // worse than no sheet.
    if (actions.length === 0) return

    const picked = await openMessageMenu(message.body || messageTypeLabel(message.type), actions)
    if (picked === 'copy') {
      await Clipboard.setStringAsync(message.body)
      showToast('Copied')
    } else if (picked === 'translate') {
      await translate(message, alreadyTranslated)
    } else if (picked === 'correct') {
      setCorrecting(message)
      setDraft(message.body)
    } else if (picked === 'report') {
      await reportMessage(message)
    }
  }

  /**
   * Referentially stable for the life of the screen, which is what keeps
   * `MessageBubble`'s `memo` worth having: a handler rebuilt every render would
   * make every bubble's props unequal and re-render the whole thread on each
   * keystroke. The ref is what lets it go on closing over fresh state anyway.
   */
  const openActionsRef = useRef(openActions)
  useEffect(() => {
    openActionsRef.current = openActions
  })
  const onLongPress = useCallback((message: MessageDto, alreadyTranslated: boolean) => {
    void openActionsRef.current(message, alreadyTranslated)
  }, [])

  async function reportMessage(message: MessageDto): Promise<void> {
    const reason = await chooseAlert('Report', 'Why are you reporting this message?', [
      { label: 'Spam', value: 'spam' },
      { label: 'Harassment', value: 'harassment' },
      { label: 'Inappropriate content', value: 'inappropriate_content' },
    ])
    if (!reason || !partnerId) return
    report.mutate(
      { userId: partnerId, reason, conversationId, messageId: message._id },
      {
        onSuccess: () => showToast('Reported. Thank you — we look at every one.'),
        onError: () => void showAlert('Could not report', 'Try again in a moment.'),
      },
    )
  }

  return (
    <Screen fluid style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => goBackTo('/(app)/chats')}
          hitSlop={12}
          style={styles.back}
        >
          <Feather name="arrow-left" size={19} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.headerUser}
          onPress={() =>
            partner &&
            router.push(
              `/(app)/profile/${partner.handle}?from=${encodeURIComponent(`/(app)/chat/${conversationId}`)}`,
            )
          }
        >
          <Avatar
            url={partner?.avatarUrl}
            name={partner?.displayName ?? '?'}
            size={40}
            online={partner?.isOnline ?? false}
          />
          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>
              {partner?.displayName ?? 'Chat'}
            </Text>
            {/*
              One line that is either presence or typing, never both stacked —
              the header is 40px tall and a third line pushes the avatar out of
              alignment with the name.
            */}
            {partnerTyping ? (
              <Text style={styles.typing}>typing…</Text>
            ) : partner?.isOnline ? (
              <Text style={styles.presence}>Online</Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      {/* The jump button floats over the thread, so it lives in the thread's
          own box rather than the screen's — that keeps it above the composer
          whatever height the composer has grown to. */}
      <View style={styles.listWrap}>
        {state === 'skeleton' ? (
          // `flex: 1` because the FlatList it stands in for takes the whole
          // height; without it the composer rides up under the placeholders and
          // then drops when the real thread arrives.
          <View style={[styles.list, styles.skeletonFill]}>
            {SKELETON_BUBBLES.map((key, index) => (
              <MessageBubbleSkeleton key={key} index={index} />
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.list}
            /**
             * The newest message sits at offset 0, and the list grows upward.
             *
             * This one prop replaces all the scroll anchoring this screen used
             * to do by hand. Staying pinned to the newest message becomes the
             * resting state rather than a `scrollToEnd` chased one frame behind
             * layout, and a page of history is appended at the *far* end, off
             * screen, so it can no longer shove what the reader is looking at.
             * The `atBottom` ref, the `requestAnimationFrame` and the
             * top-offset threshold all existed to approximate those two
             * properties, and none of them could do it while the reader was
             * scrolling.
             */
            inverted
            /**
             * "End" is the end of the data, and inverted that is the oldest
             * message — so the same prop that means "load more" everywhere else
             * in the app means "load older" here. It also sidesteps
             * `onStartReached`, which react-native-web's FlatList does not have.
             */
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) {
                void messages.fetchNextPage()
              }
            }}
            onEndReachedThreshold={0.4}
            /** Footer, not header: inverted, the footer is what sits on top. */
            ListFooterComponent={
              messages.isFetchingNextPage ? <ActivityIndicator style={styles.older} /> : null
            }
            onScroll={({ nativeEvent }) => {
              // Nothing to measure against the content height any more: the
              // bottom of an inverted list is offset 0.
              if (nativeEvent.contentOffset.y <= BOTTOM_ANCHOR_SLACK) {
                if (awayFrom !== null) setAwayFrom(null)
              } else if (awayFrom === null) {
                setAwayFrom(items[0] ? String(items[0]._id) : null)
              }
            }}
            scrollEventThrottle={16}
            renderItem={({ item: row }) =>
              row.kind === 'day' ? (
                <View style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{dayLabel(row.day)}</Text>
                </View>
              ) : (
                <MessageBubble
                  message={row.message}
                  mine={isMine(row.message)}
                  endsGroup={row.endsGroup}
                  partnerName={partner?.displayName ?? 'them'}
                  translation={translations[row.message._id]}
                  translating={translating === row.message._id}
                  onLongPress={onLongPress}
                />
              )
            }
          />
        )}

        {awayFrom !== null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              missed > 0 ? `Jump to ${missed} new messages` : 'Jump to the newest message'
            }
            onPress={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true })
              setAwayFrom(null)
            }}
            style={styles.jump}
          >
            <Feather name="arrow-down" size={18} color={colors.primaryText} />
            {missed > 0 ? <Text style={styles.jumpCount}>{missed}</Text> : null}
          </Pressable>
        ) : null}
      </View>

      {/*
        The correction composer, and the success pair again — the same colour
        the sent correction will be, so the writer can already see what they are
        making. It shows the sentence being corrected in full rather than
        truncated to a line: a correction is an edit, and an edit made from a
        half-remembered original is how a wrong one gets sent.
      */}
      {correcting ? (
        <View style={styles.correctingBanner}>
          <View style={styles.correctingHead}>
            <Feather name="edit-3" size={14} color={colors.success} />
            <Text style={styles.correctingTitle}>Correcting</Text>
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
          <Text style={styles.correctingOriginal}>{correcting.body}</Text>
          {/*
            The one reassurance worth spending a line on. Corrections are the
            behaviour the whole product exists for, and a user who suspects
            they are rationed writes fewer of them — so the limit is stated
            from `PLAN_LIMITS` rather than left to be guessed.
          */}
          {PLAN_LIMITS.free.correctionsPer24h === null ? (
            <Text style={styles.correctingFree}>Unlimited on every plan</Text>
          ) : null}
        </View>
      ) : null}

      {/* Android had no `behavior` at all, which is the same as not wrapping
          it — the keyboard covered the composer and the hint row under it. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
              <Feather name="camera" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={correcting ? 'Write the correction…' : 'Write a message…'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            /**
             * Web only, and it has to be a key handler: `multiline` is a
             * `<textarea>` in the browser, where `onSubmitEditing` never
             * fires — the handler that used to be here had never run. On
             * native the return key inserts a newline and the send button is
             * the way to send, which is what people expect there.
             */
            {...(Platform.OS === 'web'
              ? {
                  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
                    const { key, shiftKey } = event.nativeEvent as TextInputKeyPressEventData & {
                      shiftKey?: boolean
                    }
                    if (!shouldSubmitOnEnter(key, shiftKey === true)) return
                    // Otherwise the newline lands in the box behind the send.
                    event.preventDefault()
                    void send()
                  },
                }
              : {})}
          />
          {/* The button becomes a microphone when there is nothing to send,
              which is the gesture people already expect from a chat app. */}
          {draft.trim() ? (
            <Pressable
              onPress={() => void send()}
              disabled={sending}
              style={[styles.sendButton, sending && styles.sendDisabled]}
            >
              <Feather
                name={sending ? 'more-horizontal' : 'arrow-up'}
                size={20}
                color={colors.primaryText}
              />
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
              <Feather
                name={recorder.isRecording ? 'square' : 'mic'}
                size={20}
                color={recorder.isRecording ? colors.textInverse : colors.primaryText}
              />
            </Pressable>
          )}
        </View>
        {/*
          The two facts a first-time user cannot discover: that a long press
          corrects, and that a message pays. Both come from `TOKEN_RULES`
          rather than being written into the copy.
        */}
        <View style={styles.composerHint}>
          <Text style={styles.hintLeft}>Hold a message to correct it</Text>
          <Text style={styles.hintRight}>+{TOKEN_RULES.award.message} tokens / message</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  screen: { paddingHorizontal: 0 },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: 14,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerUser: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { ...font.heading, color: colors.text, fontSize: 16 },
  typing: { ...font.caption, color: colors.accent, fontWeight: '600' },
  presence: { ...font.caption, color: colors.success, fontWeight: '600' },
  listWrap: { flex: 1 },
  list: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  skeletonFill: { flex: 1 },
  dayRow: { alignItems: 'center', paddingVertical: spacing.xs },
  dayLabel: {
    ...font.caption,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.textMuted,
    fontWeight: '600',
    // Required for the radius to clip the background on a Text.
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  jump: {
    ...cardShadow,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    bottom: spacing.lg,
    flexDirection: 'row',
    gap: 5,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: spacing.md,
    position: 'absolute',
    right: spacing.lg,
  },
  jumpCount: { ...font.caption, color: colors.primaryText, fontWeight: '700' },
  older: { paddingVertical: spacing.md },
  correctingBanner: {
    backgroundColor: colors.successBg,
    borderTopColor: colors.success,
    borderTopWidth: 1,
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  correctingHead: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  correctingTitle: { ...font.heading, color: colors.success, flex: 1, fontSize: 13 },
  correctingOriginal: {
    ...font.label,
    color: colors.textMuted,
    fontWeight: '400',
    lineHeight: 20,
    textDecorationLine: 'line-through',
  },
  correctingFree: { ...font.caption, color: colors.success, fontWeight: '600' },
  correctingCancel: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 14,
    paddingTop: spacing.md,
  },
  composerHint: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  hintLeft: { ...font.caption, color: colors.textFaint },
  hintRight: { ...font.caption, color: colors.warning, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...font.body,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  sendDisabled: { opacity: 0.35 },
  recordButtonActive: { backgroundColor: colors.danger },
  attach: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  recording: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  recordingDot: { color: colors.danger, fontSize: 12 },
  recordingTime: { ...font.caption, color: colors.text, fontVariant: ['tabular-nums'] },
  recordingCancel: { ...font.caption, color: colors.textMuted },
}))

/** A thread's worth; the composer sits below them either way. */
const SKELETON_BUBBLES = ['a', 'b', 'c', 'd', 'e', 'f']

/** What the sheet shows above the actions when a message has no text. */
function messageTypeLabel(type: MessageDto['type']): string {
  if (type === 'image') return 'Photo'
  if (type === 'audio') return 'Voice message'
  return 'Message'
}

/**
 * How far off the bottom still counts as "following the conversation", and so
 * how far the reader must scroll before the jump button appears.
 *
 * Wide enough that a rubber-band overscroll or a settling animation does not
 * flash the button, narrow enough that a deliberate scroll into the history
 * shows it at once.
 */
const BOTTOM_ANCHOR_SLACK = 120
