import Feather from '@expo/vector-icons/Feather'
import { canDeleteForEveryone, MESSAGE_REACTIONS, PLAN_LIMITS, TOKEN_RULES } from '@langx/shared'
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
  useMessageWindow,
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
import { openMessageMenu, type AnchorRect } from '../../../src/lib/messageMenu'
import { goBackTo } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { showToast } from '../../../src/lib/toast'
import { messagesNewestFirst } from '../../../src/lib/messageCache'
import { dayLabel, messageRows, type MessageRow } from '../../../src/lib/messageGroups'
import { planJump } from '../../../src/lib/messageJump'
import { makeStyles, useTheme } from '../../../src/lib/theme'

export default function ChatScreen() {
  const { colors } = useTheme()
  const styles = useStyles()

  // `at` is the single entry point for "open this thread at that message": a
  // tapped quote uses it, and so will the pinned banner and the starred list.
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>()
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
  const [replyingTo, setReplyingTo] = useState<MessageDto | null>(null)
  /**
   * The message a jump is centred on, or null while the live thread is showing.
   *
   * The window is a *separate* cache rather than the live query paged in both
   * directions — see `useMessageWindow`. Which one is on screen is the only
   * difference between the two modes.
   */
  const [jumpAnchor, setJumpAnchor] = useState<string | null>(at ?? null)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const translateApi = useTranslate()
  const report = useReportUser()
  const recorder = useVoiceRecorder()
  const [sendingMedia, setSendingMedia] = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const windowed = useMessageWindow(conversationId, jumpAnchor)
  // One of the two, never a merge of them: a window that has not paged to the
  // tail describes a different slice of the thread than the live query does.
  const thread = jumpAnchor ? windowed : messages

  const items = useMemo(() => messagesNewestFirst(thread.data), [thread.data])
  const rows = useMemo(() => messageRows(items), [items])
  // Newest first, so the anchor's index *is* how many arrived while away.
  const missed = awayFrom
    ? Math.max(
        0,
        items.findIndex((m) => String(m._id) === awayFrom),
      )
    : 0
  const state = listState({
    isPending: thread.isPending,
    isError: thread.isError,
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
        await emitWithAck(socket, 'message:send', {
          conversationId,
          body,
          ...(replyingTo ? { replyToMessageId: replyingTo._id } : {}),
        })
        setReplyingTo(null)
      }
      setDraft('')
      notifyTyping(false)
      // Sending is a statement about the live conversation, so it ends a
      // detour into the history rather than posting into the middle of it.
      setJumpAnchor(null)
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
  async function openActions(
    message: MessageDto,
    alreadyTranslated: boolean,
    anchor?: AnchorRect,
  ): Promise<void> {
    // Nothing left to act on: a withdrawn message is a placeholder, and the
    // one thing anyone might want — hiding it — is offered through the same
    // row, so it is still worth opening.
    const actions = messageActionsFor({
      mine: isMine(message),
      type: message.type,
      hasBody: message.body.trim().length > 0,
      alreadyTranslated,
    })

    const picked = await openMessageMenu({
      preview: message.body || messageTypeLabel(message.type),
      mine: isMine(message),
      actions,
      ...(anchor ? { anchor } : {}),
      // A withdrawn message cannot carry a reaction, so it gets no strip.
      ...(message.deleted ? {} : { reactions: MESSAGE_REACTIONS, myReaction: message.myReaction }),
    })
    if (!picked) return

    if (picked.kind === 'reaction') {
      await react(message, picked.emoji)
      return
    }

    if (picked.id === 'reply') {
      setReplyingTo(message)
    } else if (picked.id === 'copy') {
      await Clipboard.setStringAsync(message.body)
      showToast('Copied')
    } else if (picked.id === 'translate') {
      await translate(message, alreadyTranslated)
    } else if (picked.id === 'correct') {
      setCorrecting(message)
      setDraft(message.body)
    } else if (picked.id === 'delete') {
      await removeMessage(message)
    } else if (picked.id === 'report') {
      await reportMessage(message)
    }
  }

  /**
   * Tapping the emoji already on the message clears it — the server treats a
   * repeat as a toggle, so nothing here has to know the current state.
   */
  async function react(message: MessageDto, emoji: string): Promise<void> {
    const socket = await getSocket()
    try {
      await emitWithAck(socket, 'message:react', {
        conversationId,
        messageId: message._id,
        emoji,
      })
    } catch {
      void showAlert('Could not react', 'That did not go through. Try again.')
    }
  }

  /**
   * Two different things behind one row.
   *
   * "Delete for me" is a filter on your own copy and never expires; withdrawing
   * it from the other person is only your own message, only within
   * `MESSAGE_DELETE_WINDOW_MS`, and is the one that needs asking about. When
   * only one of them is possible there is nothing to choose between, so it is
   * confirmed rather than offered as a menu of one.
   */
  async function removeMessage(message: MessageDto): Promise<void> {
    const canWithdraw = canDeleteForEveryone(message, me.data?._id ?? '', new Date())
    const scope = canWithdraw
      ? await chooseAlert('Delete message', 'This cannot be undone.', [
          { label: 'Delete for everyone', value: 'everyone' },
          { label: 'Delete for me', value: 'me' },
        ])
      : await chooseAlert('Delete message', 'It stays on their device.', [
          { label: 'Delete for me', value: 'me' },
        ])
    if (!scope) return

    const socket = await getSocket()
    try {
      await emitWithAck(socket, 'message:delete', {
        conversationId,
        messageId: message._id,
        scope,
      })
    } catch {
      void showAlert('Could not delete', 'That did not go through. Try again.')
    }
  }

  /**
   * Tapping a quote.
   *
   * `planJump` decides between scrolling and fetching, and the common case is
   * scrolling — most replies answer something a few rows up. `rowsRef` keeps
   * this handler stable so it does not defeat `MessageBubble`'s memo, the same
   * trick `onLongPress` uses below.
   */
  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  })

  const flash = useCallback((messageId: string) => {
    setHighlighted(messageId)
    setTimeout(() => setHighlighted((current) => (current === messageId ? null : current)), 1400)
  }, [])

  const onJumpTo = useCallback(
    (messageId: string) => {
      const plan = planJump(rowsRef.current, messageId)
      if (plan.kind === 'scroll') {
        listRef.current?.scrollToIndex({ index: plan.index, viewPosition: 0.5, animated: true })
      } else {
        setJumpAnchor(plan.anchorId)
      }
      flash(messageId)
    },
    [flash],
  )

  const onReply = useCallback((message: MessageDto) => setReplyingTo(message), [])

  /**
   * Centre the window on what it was opened for, once — not on every page it
   * loads afterwards, or paging further back would keep yanking the reader
   * to the anchor.
   */
  const centred = useRef<string | null>(null)
  useEffect(() => {
    if (!jumpAnchor) {
      centred.current = null
      return
    }
    if (centred.current === jumpAnchor) return
    const index = rows.findIndex((row) => row.kind === 'message' && row.key === jumpAnchor)
    if (index < 0) return
    centred.current = jumpAnchor
    listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false })
  }, [jumpAnchor, rows])

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
  const onLongPress = useCallback(
    (message: MessageDto, alreadyTranslated: boolean, anchor?: AnchorRect) => {
      void openActionsRef.current(message, alreadyTranslated, anchor)
    },
    [],
  )

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
              if (thread.hasNextPage && !thread.isFetchingNextPage) {
                void thread.fetchNextPage()
              }
            }}
            onEndReachedThreshold={0.4}
            /** Footer, not header: inverted, the footer is what sits on top. */
            ListFooterComponent={
              thread.isFetchingNextPage ? <ActivityIndicator style={styles.older} /> : null
            }
            /**
             * Mandatory, not defensive: bubbles are variable height and there
             * is no `getItemLayout`, so `scrollToIndex` throws outright on a
             * row the list has not measured. Nudging to an estimate and asking
             * again is the documented recovery.
             */
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: false,
              })
              setTimeout(
                () =>
                  listRef.current?.scrollToIndex({
                    index: info.index,
                    viewPosition: 0.5,
                    animated: false,
                  }),
                120,
              )
            }}
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
                  replyToMine={row.message.replyTo?.senderId === me.data?._id}
                  highlighted={highlighted === row.message._id}
                  onLongPress={onLongPress}
                  onReply={onReply}
                  onJumpTo={onJumpTo}
                />
              )
            }
          />
        )}

        {/*
          A window is a detour, and the way back has to be obvious — otherwise
          the only exit is sending a message or leaving the screen.
        */}
        {jumpAnchor !== null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setJumpAnchor(null)}
            style={styles.backToLatest}
          >
            <Feather name="arrow-down-circle" size={15} color={colors.primaryText} />
            <Text style={styles.backToLatestText}>Back to latest</Text>
          </Pressable>
        ) : null}

        {awayFrom !== null && jumpAnchor === null ? (
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
      {/*
        Sibling of the correcting banner below, and deliberately quieter: a
        reply is the ordinary case and a correction is the teaching one, so the
        correction keeps the success colour and this gets the accent edge.
      */}
      {replyingTo && !correcting ? (
        <View style={styles.replyingBanner}>
          <View style={styles.replyingBar} />
          <View style={styles.replyingText}>
            <Text style={styles.replyingTitle} numberOfLines={1}>
              {isMine(replyingTo)
                ? 'Replying to yourself'
                : `Replying to ${partner?.displayName ?? 'them'}`}
            </Text>
            <Text style={styles.replyingPreview} numberOfLines={1}>
              {replyingTo.body || messageTypeLabel(replyingTo.type)}
            </Text>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
            <Text style={styles.replyingCancel}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

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
  backToLatest: {
    ...cardShadow,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    position: 'absolute',
    top: spacing.md,
  },
  backToLatestText: { ...font.caption, color: colors.primaryText, fontWeight: '700' },
  replyingBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  replyingBar: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    width: 3,
  },
  replyingText: { flex: 1, gap: 1, minWidth: 0 },
  replyingTitle: { ...font.caption, color: colors.accent, fontWeight: '700' },
  replyingPreview: { ...font.caption, color: colors.textMuted },
  replyingCancel: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
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
