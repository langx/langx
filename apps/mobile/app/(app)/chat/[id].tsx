import Feather from '@expo/vector-icons/Feather'
import {
  canDeleteForEveryone,
  canEditMessage,
  isTranslatableLanguage,
  MAX_ATTACHMENTS,
  MAX_VIDEO_SECONDS,
  type Media,
  MESSAGE_REACTIONS,
  PLAN_LIMITS,
  TOKEN_RULES,
} from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native'
import {
  markConversationRead,
  uploadMessageMedia,
  useMe,
  useMessages,
  useMessageWindow,
  useReportUser,
  useTranslate,
  type MessageDto,
} from '../../../src/api/queries'
import * as Clipboard from 'expo-clipboard'
import { track } from '../../../src/lib/analytics'
import { setActiveConversation } from '../../../src/lib/activeConversation'
import { useKeyboardInset } from '../../../src/hooks/useKeyboardInset'
import { PresenceLine } from '../../../src/components/PresenceLine'
import { ComposerHint } from '../../../src/components/ComposerHint'
import { Tip } from '../../../src/components/Tip'
import { MessageBubble } from '../../../src/components/MessageBubble'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import {
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../../src/components/AttachmentPreview'
import { MessageBubbleSkeleton } from '../../../src/components/skeletons/MessageBubbleSkeleton'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Screen } from '../../../src/components/ui/Screen'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { chooseAlert, showAlert } from '../../../src/lib/alert'
import { emitWithAck, getSocket } from '../../../src/lib/socket'
import {
  addUnsent,
  newClientId,
  removeUnsent,
  retireDelivered,
  type UnsentMessage,
} from '../../../src/lib/unsentMessages'
import { errorCodeOf } from '../../../src/lib/errors'
import { listState } from '../../../src/lib/listState'
import { shouldSubmitOnEnter } from '../../../src/lib/submitOnEnter'
import { messageActionsFor } from '../../../src/lib/messageActions'
import { openMessageMenu, type AnchorRect } from '../../../src/lib/messageMenu'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { pickMediaAssets } from '../../../src/lib/pickMediaAsset'
import { PendingMediaBubble } from '../../../src/components/PendingMediaBubble'
import {
  addPending,
  expirePending,
  newPendingId,
  removePending,
  updatePending,
  type PendingMedia,
} from '../../../src/lib/pendingMedia'
import {
  UPLOAD_START,
  advanceUpload,
  uploadFailed,
  uploadSent,
  type UploadProgress,
} from '../../../src/lib/uploadProgress'
import { shareLink } from '../../../src/lib/share'
import { showToast } from '../../../src/lib/toast'
import { messagesNewestFirst } from '../../../src/lib/messageCache'
import { dayLabel, messageRows, type MessageRow } from '../../../src/lib/messageGroups'
import { useLocale, useT, type MessageKey } from '../../../src/i18n'
import { planJump } from '../../../src/lib/messageJump'
import { makeStyles, useTheme } from '../../../src/lib/theme'

export default function ChatScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()

  // `at` is the single entry point for "open this thread at that message": a
  // tapped quote uses it, and so will the pinned banner and the starred list.
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>()
  const conversationId = id ?? ''
  const me = useMe()
  const queryClient = useQueryClient()
  const messages = useMessages(conversationId)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [unsent, setUnsent] = useState<UnsentMessage[]>([])
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
  const [editing, setEditing] = useState<MessageDto | null>(null)
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
  const keyboardInset = useKeyboardInset()
  const report = useReportUser()
  const recorder = useVoiceRecorder()
  const [sendingMedia, setSendingMedia] = useState(false)
  /**
   * Picked, and waiting for the send button.
   *
   * Chat used to upload the moment you picked, on the grounds that in a thread
   * picking *is* sending. It is not: it is choosing, and the two questions
   * somebody asks straight afterwards — which photo, and how do I take it back
   * — had no answer at all. These sit above the composer as thumbnails with a
   * cross, and go up when the message does, which also means a caption can be
   * typed for them first. The rows below with a progress bar are the *next*
   * state, after the send.
   */
  const [pendingMedia, setPendingMedia] = useState<PendingAttachment[]>([])
  /*
   * The viewer is opened by a bubble and owned by the thread. Inside the
   * bubble it would be unmounted by the same virtualisation that recycles the
   * row, and a picture would close itself as its bubble scrolled away.
   *
   * One url rather than the thread's whole photo history: only the loaded
   * pages could be collected, so the arrows would page through however much of
   * the conversation happened to be in memory — a different set every time,
   * for no reason the reader can see.
   */
  /**
   * The viewer's contents and where it opened, rather than one URL: a message
   * can carry six attachments now, and arriving in the viewer on the tile that
   * was tapped is the difference between paging and hunting.
   */
  const [viewing, setViewing] = useState<{ items: Media[]; index: number } | null>(null)
  const [pending, setPending] = useState<PendingMedia[]>([])

  /*
   * An ack that never arrives would otherwise leave a bubble uploading for as
   * long as the screen stays open: media messages carry no `clientId`, so the
   * echoed message cannot be matched back to the attempt that made it.
   */
  useEffect(() => {
    if (pending.length === 0) return
    const timer = setInterval(() => setPending((list) => expirePending(list, new Date())), 5000)
    return () => clearInterval(timer)
  }, [pending.length])
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const windowed = useMessageWindow(conversationId, jumpAnchor)
  // One of the two, never a merge of them: a window that has not paged to the
  // tail describes a different slice of the thread than the live query does.
  const thread = jumpAnchor ? windowed : messages

  const items = useMemo(() => messagesNewestFirst(thread.data), [thread.data])
  const rows = useMemo(() => messageRows(items), [items])

  /**
   * A send whose ack was lost still left an unsent row, and the message may
   * have arrived anyway — the thread would then show the same sentence twice.
   * The server echoes `clientId` back to its author so the duplicate can go.
   */
  useEffect(() => {
    setUnsent((list) =>
      retireDelivered(
        list,
        items.map((message) => message.clientId),
      ),
    )
  }, [items])
  // Newest first, so the anchor's index *is* how many arrived while away.
  const missed = awayFrom
    ? Math.max(
        0,
        items.findIndex((m) => String(m._id) === awayFrom),
      )
    : 0
  const pinned = thread.data?.pages[0]?.pinned ?? null
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
  /*
   * How many more messages before an attachment is allowed here. Read off the
   * live page, which `appendIncomingMessage` counts down, so the camera comes
   * back on the message that unlocked it rather than on the next refetch.
   *
   * Disabled rather than hidden. A control that vanishes teaches nothing, and
   * the whole value of this rule is that people know it is there.
   */
  const mediaLockedFor = messages.data?.pages[0]?.mediaLockedFor ?? 0
  const partners = useProfileCache(partnerId ? [partnerId] : [])
  const partner = partners[partnerId]

  /**
   * Opening the thread is the read receipt — and *focusing* it, not mounting
   * it. This screen is a hidden tab route, so it stays mounted after the user
   * navigates away: on mount alone, coming back to a thread already open
   * posted nothing, and the app went on believing this conversation was being
   * read for the rest of the session.
   *
   * Which also matters to the in-app banner: `activeConversation` is what
   * stops a message buzzing at somebody who is looking straight at it.
   */
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return
      setActiveConversation(conversationId)
      void markConversationRead(conversationId, queryClient)
      return () => setActiveConversation(null)
    }, [conversationId, queryClient]),
  )

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

  /** A single-file row, back in the shape a send takes, for a retry. */
  function attachmentOf(row: PendingMedia): PendingAttachment {
    return {
      kind: row.kind,
      uri: row.uri,
      contentType: row.contentType,
      ...(row.durationSeconds !== undefined ? { durationSeconds: row.durationSeconds } : {}),
      ...(row.width !== undefined ? { width: row.width } : {}),
      ...(row.height !== undefined ? { height: row.height } : {}),
    }
  }

  /** The row's progress as it stands, for the transitions that build on it. */
  function startOf(list: readonly PendingMedia[], clientId: string): UploadProgress {
    return list.find((row) => row.clientId === clientId)?.progress ?? UPLOAD_START
  }

  async function pickMedia(): Promise<void> {
    const remaining = MAX_ATTACHMENTS - pendingMedia.length
    if (remaining <= 0) {
      void showAlert(
        t('chat.couldNotSend'),
        t('errors.tooManyAttachments', { count: MAX_ATTACHMENTS }),
      )
      return
    }
    const picked = await pickMediaAssets({ remaining })
    if (picked.status === 'denied') {
      // Which permission was refused, not "photos" for both: being told to
      // allow the photo library after declining the camera is advice that
      // does not work.
      void showAlert(
        picked.source === 'camera' ? t('media.cameraTitle') : t('chat.photosTitle'),
        picked.source === 'camera' ? t('media.cameraPermission') : t('chat.photosPermission'),
      )
      return
    }
    if (picked.status === 'cancelled') return
    // Said once, for the first file that was dropped: naming each of six would
    // be a stack of alerts nobody dismisses.
    if (picked.refused) {
      void showAlert(
        t('chat.couldNotSend'),
        picked.refused.reason === 'tooLong'
          ? t('errors.videoTooLong', { count: MAX_VIDEO_SECONDS })
          : picked.refused.reason === 'tooLarge'
            ? t('errors.attachmentTooLarge')
            : picked.refused.reason === 'tooMany'
              ? t('errors.tooManyAttachments', { count: MAX_ATTACHMENTS })
              : t('errors.attachmentUnsupported'),
      )
    }
    if (picked.media.length === 0) return
    setPendingMedia((items) => [...items, ...picked.media.slice(0, remaining)])
  }

  async function toggleRecording(): Promise<void> {
    // Guarded at the microphone rather than at the send, because starting a
    // recording somebody is not allowed to send is a worse answer than not
    // starting one: they would speak, then be told.
    if (mediaLockedFor > 0) {
      await showAlert(t('chat.mediaLockedTitle'), t('chat.mediaLocked', { count: mediaLockedFor }))
      return
    }
    if (!recorder.isRecording) {
      const started = await recorder.start()
      if (!started && recorder.error) void showAlert(t('chat.microphoneTitle'), recorder.error)
      return
    }
    const recording = await recorder.stop()
    if (!recording) return
    // A recording still goes on stop. Holding it for the send button would
    // make somebody press two things to do what one gesture already finished,
    // and it cannot be sent beside a picture anyway.
    await sendAttachments([{ kind: 'audio', ...recording }], undefined)
  }

  async function sendAttachments(
    items: readonly PendingAttachment[],
    body: string | undefined,
  ): Promise<void> {
    const first = items[0]
    if (!first) return
    setSendingMedia(true)
    /*
     * The row goes up before a single byte moves. The whole point is that the
     * thread stops looking like it ignored the tap, so it cannot wait for the
     * upload it is reporting on.
     */
    const clientId = newPendingId()
    setPending((list) =>
      addPending(
        list,
        { clientId, conversationId, ...first, ...(items.length > 1 ? { files: [...items] } : {}) },
        new Date(),
      ),
    )
    try {
      const uploaded = []
      for (const [index, item] of items.entries()) {
        uploaded.push(
          await uploadMessageMedia({
            conversationId,
            ...item,
            /*
             * One bar for the whole message, not one per file. Each upload
             * reports its own bytes, so a file's fraction is folded into the
             * slice of the bar that belongs to it — otherwise the bar would
             * restart at zero six times and read as six failures.
             */
            onProgress: (loaded, total) =>
              setPending((list) =>
                list.map((row) =>
                  row.clientId === clientId
                    ? {
                        ...row,
                        progress: advanceUpload(
                          row.progress,
                          index + (total > 0 ? loaded / total : 0),
                          items.length,
                        ),
                      }
                    : row,
                ),
              ),
          }),
        )
      }
      // The bytes are up; the socket round-trip is what is left.
      setPending((list) => updatePending(list, clientId, uploadSent(startOf(list, clientId))))
      const socket = await getSocket()
      await emitWithAck(socket, 'message:media', {
        conversationId,
        attachments: uploaded,
        ...(body ? { body } : {}),
        ...(replyingTo ? { replyToMessageId: replyingTo._id } : {}),
      })
      track({ name: 'message_sent', properties: { kind: first.kind, reply: replyingTo !== null } })
      setPending((list) => removePending(list, clientId))
      setReplyingTo(null)
    } catch (error) {
      // `emitWithAck` rejects with a plain Error carrying `.code`, not an
      // ApiRequestError, so the `instanceof` this used to do never matched
      // and the quota message had never once been shown.
      const code = errorCodeOf(error)
      if (code === 'QUOTA_EXCEEDED') {
        setPending((list) => removePending(list, clientId))
        await showAlert(t('chat.couldNotSend'), t('chat.mediaQuota'))
        openPaywall(undefined, `/(app)/chat/${conversationId}`)
        return
      }
      // Logged before it is generalised: "could not be sent" once covered an
      // unsupported HEIC for a whole test cycle, and nothing anywhere said so.
      console.warn('attachment failed', code ?? error)
      const reason =
        code === 'UNSUPPORTED_MEDIA_TYPE'
          ? t('errors.attachmentUnsupported')
          : code === 'MEDIA_TOO_LARGE'
            ? t('errors.attachmentTooLarge')
            : code === 'MEDIA_TOO_LONG'
              ? t('errors.videoTooLong', { count: MAX_VIDEO_SECONDS })
              : code === 'MEDIA_LOCKED'
                ? t('chat.mediaLocked', { count: Math.max(1, mediaLockedFor) })
                : t('chat.attachmentFailed')
      // Kept as a row rather than an alert-and-discard: the picked files are
      // still there, and tapping it tries again. A quota refusal is the
      // exception — retrying cannot help, so that one is dropped above.
      setPending((list) => updatePending(list, clientId, uploadFailed(startOf(list, clientId))))
      void showAlert(t('chat.couldNotSend'), reason)
    } finally {
      setSendingMedia(false)
    }
  }

  /**
   * Sends `body`, and on failure keeps it as a visible row rather than losing
   * it.
   *
   * `clientId` is passed in on a retry so the row updates itself instead of
   * stacking a second copy of the same sentence.
   */
  async function deliver(body: string, clientId: string): Promise<void> {
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:send', {
        conversationId,
        body,
        clientId,
        ...(replyingTo ? { replyToMessageId: replyingTo._id } : {}),
      })
      setUnsent((list) => removeUnsent(list, clientId))
      track({ name: 'message_sent', properties: { kind: 'text', reply: replyingTo !== null } })
      setReplyingTo(null)
    } catch {
      /*
       * Swallowed on purpose, and this is the whole change: it used to be
       * swallowed by *nothing* — `send()` had a `try/finally` with no `catch`,
       * both call sites were `void send()`, and there is no global rejection
       * handler, so the reader was shown nothing whatsoever. The row below is
       * the report.
       */
      setUnsent((list) =>
        addUnsent(list, {
          clientId,
          body,
          ...(replyingTo ? { replyToMessageId: replyingTo._id } : {}),
          failedAt: new Date().toISOString(),
        }),
      )
    }
  }

  async function retry(message: UnsentMessage): Promise<void> {
    await deliver(message.body, message.clientId)
  }

  async function send(): Promise<void> {
    const body = draft.trim()
    // The attachments are the message when there are any; the draft becomes
    // their caption, which is why this runs before the empty-body guard.
    if (pendingMedia.length > 0) {
      if (sending || sendingMedia) return
      const items = pendingMedia
      setPendingMedia([])
      setDraft('')
      notifyTyping(false)
      await sendAttachments(items, body || undefined)
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      return
    }
    if (!body || sending) return
    setSending(true)
    try {
      const socket = await getSocket()
      if (editing) {
        await emitWithAck(socket, 'message:edit', {
          conversationId,
          messageId: editing._id,
          body,
        })
        setEditing(null)
        setDraft('')
        return
      }
      if (correcting) {
        await emitWithAck(socket, 'message:correct', {
          conversationId,
          targetMessageId: correcting._id,
          corrected: body,
        })
        setCorrecting(null)
        track({ name: 'message_sent', properties: { kind: 'correction', reply: false } })
      } else {
        // `deliver` never rejects — a failure becomes an unsent row — so the
        // composer clears either way. The text is not lost, it has moved into
        // the thread where the reader can see it did not go.
        await deliver(body, newClientId(Date.now(), Math.random()))
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
   * Translates into the caller's first native language *that can be written*
   * — the one they read fluently. Asking which language every time would be a
   * question with an obvious answer, and translating into what they are
   * *learning* would defeat the purpose. A signed language is skipped: it has
   * no written form, and the server refuses it as a target.
   */
  const translateTarget = me.data?.nativeLanguages.find((l) => isTranslatableLanguage(l.code))?.code
  async function translate(message: MessageDto, alreadyTranslated: boolean): Promise<void> {
    const target = translateTarget
    if (!target || alreadyTranslated) return
    setTranslating(message._id)
    try {
      const result = await translateApi.mutateAsync({ text: message.body, targetLang: target })
      setTranslations((current) => ({ ...current, [message._id]: result.translatedText }))
    } catch (error) {
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(t('chat.translationUnavailable'), t('chat.translationQuota'))
        // Bare, deliberately. `unlimitedTranslation` is a `ProBenefit` and
        // not a `PlanFeature` — it is a quota that stops applying rather than
        // a capability flag — so there is no key to pass. The paywall's Pro
        // column already lists it.
        openPaywall(undefined, `/(app)/chat/${conversationId}`)
      } else {
        await showAlert(t('chat.translationUnavailable'), t('chat.translationFailed'))
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
      canTranslate: translateTarget !== undefined,
      mine: isMine(message),
      type: message.type,
      hasBody: message.body.trim().length > 0,
      alreadyTranslated,
      // Evaluated here rather than in the menu, so the row and the server
      // agree on one rule from `@langx/shared` instead of two copies of it.
      canEdit: canEditMessage(message, me.data?._id ?? '', new Date()),
      corrected: message.corrected === true,
      starred: message.starred === true,
      pinned: pinned?.messageId === message._id,
      t,
    })

    const picked = await openMessageMenu({
      preview: message.body || t(messageTypeKey(message.type)),
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
      showToast(t('chat.copied'))
    } else if (picked.id === 'share') {
      await shareLink({ message: message.body })
    } else if (picked.id === 'translate') {
      await translate(message, alreadyTranslated)
    } else if (picked.id === 'correct') {
      setCorrecting(message)
      setDraft(message.body)
    } else if (picked.id === 'delete') {
      await removeMessage(message)
    } else if (picked.id === 'edit') {
      setEditing(message)
      setCorrecting(null)
      setReplyingTo(null)
      setDraft(message.body)
    } else if (picked.id === 'star') {
      await emit('message:star', {
        conversationId,
        messageId: message._id,
        starred: message.starred !== true,
      })
    } else if (picked.id === 'pin') {
      await emit('conversation:pin', {
        conversationId,
        messageId: pinned?.messageId === message._id ? null : message._id,
      })
    } else if (picked.id === 'report') {
      await reportMessage(message)
    }
  }

  /**
   * Every mutation is the same three lines, and the failure is always the same
   * sentence: the server has already refused with a reason the user cannot act
   * on ("only within two days"), so the alert says what happened rather than
   * repeating a rule the menu should not have offered in the first place.
   */
  async function emit(event: string, payload: Record<string, unknown>): Promise<void> {
    const socket = await getSocket()
    try {
      await emitWithAck(socket, event, payload)
    } catch {
      void showAlert(t('chat.actionFailed'), t('common.retry'))
    }
  }

  /**
   * Tapping the emoji already on the message clears it — the server treats a
   * repeat as a toggle, so nothing here has to know the current state.
   */
  async function react(message: MessageDto, emoji: string): Promise<void> {
    await emit('message:react', { conversationId, messageId: message._id, emoji })
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
      ? await chooseAlert(t('chat.deleteTitle'), t('chat.deleteBothSides'), [
          { label: t('chat.deleteForEveryone'), value: 'everyone' },
          { label: t('chat.deleteForMe'), value: 'me' },
        ])
      : await chooseAlert(t('chat.deleteTitle'), t('chat.deleteOwnSide'), [
          { label: t('chat.deleteForMe'), value: 'me' },
        ])
    if (!scope) return

    await emit('message:delete', { conversationId, messageId: message._id, scope })
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
    const reason = await chooseAlert(t('common.report'), t('report.messageQuestion'), [
      { label: t('report.spam'), value: 'spam' },
      { label: t('report.harassment'), value: 'harassment' },
      { label: t('report.inappropriate'), value: 'inappropriate_content' },
    ])
    if (!reason || !partnerId) return
    report.mutate(
      { userId: partnerId, reason, conversationId, messageId: message._id },
      {
        onSuccess: () => showToast(t('report.messageSent')),
        onError: () => void showAlert(t('report.failed'), t('common.retry')),
      },
    )
  }

  return (
    <Screen fluid style={styles.screen}>
      {/*
        The whole screen pads for the keyboard, by the keyboard's own reported
        height — see `useKeyboardInset` for why `KeyboardAvoidingView` did not
        do this job here, around the composer or around the screen.
      */}
      <Animated.View style={[styles.avoid, { paddingBottom: keyboardInset }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.backPlain')}
            onPress={() => goBackTo('/(app)/(tabs)/chats')}
            hitSlop={12}
            style={styles.back}
          >
            <Feather name="arrow-left" size={19} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerUser}
            onPress={() => partner && openProfile(partner.handle, `/(app)/chat/${conversationId}`)}
          >
            <Avatar
              url={partner?.avatarUrl}
              name={partner?.displayName ?? '?'}
              seed={partner?._id}
              size={40}
              online={partner?.isOnline ?? false}
            />
            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>
                {partner?.displayName ?? t('chat.title')}
              </Text>
              {/*
              One line that is either presence or typing, never both stacked —
              the header is 40px tall and a third line pushes the avatar out of
              alignment with the name. `PresenceLine` keeps that true: online
              and last-seen are mutually exclusive states of one line, not two.
            */}
              {partnerTyping ? (
                <Text style={styles.typing}>{t('chat.typing')}</Text>
              ) : (
                <PresenceLine lastActiveAt={partner?.lastActiveAt} />
              )}
            </View>
          </Pressable>
        </View>

        {/*
        Above the thread rather than floating over it: a pin is a standing fact
        about the conversation, not a transient control, and it has to survive
        scrolling to the top of the history.
      */}
        {pinned ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.goToPinned')}
            onPress={() => onJumpTo(pinned.messageId)}
            style={styles.pinBanner}
          >
            <Feather name="bookmark" size={14} color={colors.accent} />
            <Text style={styles.pinText} numberOfLines={1}>
              {items.find((m) => m._id === pinned.messageId)?.body ?? t('chat.pinnedMessage')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('messageActions.unpin')}
              hitSlop={8}
              onPress={() => void emit('conversation:pin', { conversationId, messageId: null })}
            >
              <Feather name="x" size={15} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        ) : null}

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
              /**
               * Header, not footer: inverted, the header is what sits at the
               * bottom — under the newest message and directly above the
               * composer, which is where something that failed to send belongs.
               */
              ListHeaderComponent={
                <>
                  {/* Above the composer, where a hint is read rather than
                    scrolled past. */}
                  <Tip slot="chat" />
                  {pending.length > 0 ? (
                    <View style={styles.unsentBlock}>
                      {pending.map((row) => (
                        <PendingMediaBubble
                          key={row.clientId}
                          item={row}
                          onRetry={() => {
                            setPending((list) => removePending(list, row.clientId))
                            void sendAttachments(row.files ?? [attachmentOf(row)], undefined)
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                  {unsent.length > 0 ? (
                    <View style={styles.unsentBlock}>
                      {unsent.map((message) => (
                        <Pressable
                          key={message.clientId}
                          accessibilityRole="button"
                          accessibilityLabel={t('chat.notSentRetry')}
                          onPress={() => void retry(message)}
                          style={({ pressed }) => [styles.unsent, pressed && styles.unsentPressed]}
                        >
                          <Text style={styles.unsentBody}>{message.body}</Text>
                          <Text style={styles.unsentNote}>
                            <Feather name="alert-circle" size={12} /> {t('chat.notSentRetry')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              }
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
                    <Text style={styles.dayLabel}>{dayLabel(row.day, { t, locale })}</Text>
                  </View>
                ) : (
                  <MessageBubble
                    message={row.message}
                    mine={isMine(row.message)}
                    endsGroup={row.endsGroup}
                    partnerName={partner?.displayName ?? t('chat.them')}
                    translation={translations[row.message._id]}
                    translating={translating === row.message._id}
                    replyToMine={row.message.replyTo?.senderId === me.data?._id}
                    highlighted={highlighted === row.message._id}
                    onLongPress={onLongPress}
                    onReply={onReply}
                    onJumpTo={onJumpTo}
                    onOpenMedia={(items, index) => setViewing({ items, index })}
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
              <Feather name="arrow-down-circle" size={15} color={colors.textInverse} />
              <Text style={styles.backToLatestText}>{t('chat.backToLatest')}</Text>
            </Pressable>
          ) : null}

          {awayFrom !== null && jumpAnchor === null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                missed > 0 ? t('chat.jumpToNew', { count: missed }) : t('chat.jumpToNewest')
              }
              onPress={() => {
                listRef.current?.scrollToOffset({ offset: 0, animated: true })
                setAwayFrom(null)
              }}
              style={styles.jump}
            >
              <Feather name="arrow-down" size={18} color={colors.textInverse} />
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
        {replyingTo && !correcting && !editing ? (
          <View style={styles.replyingBanner}>
            <View style={styles.replyingBar} />
            <View style={styles.replyingText}>
              <Text style={styles.replyingTitle} numberOfLines={1}>
                {isMine(replyingTo)
                  ? t('chat.replyingToYourself')
                  : t('chat.replyingTo', { name: partner?.displayName ?? t('chat.them') })}
              </Text>
              <Text style={styles.replyingPreview} numberOfLines={1}>
                {replyingTo.body || t(messageTypeKey(replyingTo.type))}
              </Text>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
              <Text style={styles.replyingCancel}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : null}

        {editing ? (
          <View style={styles.replyingBanner}>
            <View style={[styles.replyingBar, styles.editingBar]} />
            <View style={styles.replyingText}>
              <Text style={[styles.replyingTitle, styles.editingTitle]}>{t('chat.editing')}</Text>
              <Text style={styles.replyingPreview} numberOfLines={1}>
                {editing.body}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setEditing(null)
                setDraft('')
              }}
              hitSlop={8}
            >
              <Text style={styles.replyingCancel}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : null}

        {correcting ? (
          <View style={styles.correctingBanner}>
            <View style={styles.correctingHead}>
              <Feather name="edit-3" size={14} color={colors.success} />
              <Text style={styles.correctingTitle}>{t('chat.correcting')}</Text>
              <Pressable
                onPress={() => {
                  setCorrecting(null)
                  setDraft('')
                }}
                hitSlop={8}
              >
                <Text style={styles.correctingCancel}>{t('common.cancel')}</Text>
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
              <Text style={styles.correctingFree}>{t('chat.unlimitedEveryPlan')}</Text>
            ) : null}
          </View>
        ) : null}

        <View>
          {/* Above the row rather than inside it: the row holds the send
            button, and anything that grows in there competes for width with
            the only control that sends the message. */}
          <AttachmentPreviewRow
            pending={pendingMedia}
            onRemove={(index) => setPendingMedia((items) => items.filter((_, at) => at !== index))}
          />
          <View style={styles.composer}>
            {recorder.isRecording ? (
              <View style={styles.recording}>
                <Text style={styles.recordingDot}>●</Text>
                <Text style={styles.recordingTime}>
                  {Math.floor(recorder.seconds / 60)}:
                  {String(recorder.seconds % 60).padStart(2, '0')}
                </Text>
                <Pressable onPress={() => void recorder.cancel()} hitSlop={8}>
                  <Text style={styles.recordingCancel}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel={
                  mediaLockedFor > 0
                    ? t('chat.mediaLocked', { count: mediaLockedFor })
                    : t('composer.attachMedia')
                }
                onPress={() =>
                  mediaLockedFor > 0
                    ? void showAlert(
                        t('chat.mediaLockedTitle'),
                        t('chat.mediaLocked', { count: mediaLockedFor }),
                      )
                    : void pickMedia()
                }
                disabled={sendingMedia || pendingMedia.length >= MAX_ATTACHMENTS}
                hitSlop={8}
                style={styles.attach}
              >
                <Feather
                  name="camera"
                  size={20}
                  color={mediaLockedFor > 0 ? colors.textFaint : colors.textMuted}
                />
              </Pressable>
            )}
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              placeholder={correcting ? t('chat.writeCorrection') : t('chat.writeMessage')}
              placeholderTextColor={colors.textFaint}
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
              which is the gesture people already expect from a chat app. An
              attachment with no caption is something to send, so a picked
              photo turns it back into an arrow. */}
            {draft.trim() || pendingMedia.length > 0 ? (
              <Pressable
                onPress={() => void send()}
                disabled={sending || sendingMedia}
                style={[styles.sendButton, (sending || sendingMedia) && styles.sendDisabled]}
              >
                <Feather
                  name={sending || sendingMedia ? 'more-horizontal' : 'arrow-up'}
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
            <ComposerHint style={styles.hintLeft} />
            <Text style={styles.hintRight}>
              {t('chat.tokensPerMessage', { count: TOKEN_RULES.award.message })}
            </Text>
          </View>
        </View>
        <PhotoViewer
          photos={viewing?.items ?? []}
          index={viewing?.index ?? null}
          onClose={() => setViewing(null)}
        />
      </Animated.View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  screen: { paddingHorizontal: 0 },
  avoid: { flex: 1 },
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
  // v3 draws the back control as a bare arrow — the hairline under the header
  // is all the chrome this row carries.
  back: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 32,
  },
  headerUser: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { ...font.heading, color: colors.text, fontSize: 16 },
  typing: { ...font.caption, color: colors.accent, fontSize: 13, fontWeight: '600' },
  presence: { ...font.caption, color: colors.success, fontSize: 13, fontWeight: '600' },
  /** Under the newest message, above the composer. */
  unsentBlock: { gap: spacing.xs, paddingTop: spacing.xs },
  /**
   * Shaped like one of your own bubbles but drained of it: same side, same
   * radius, an `error` outline instead of the accent fill. It has to read as
   * "this is your message and it did not go", which a toast cannot say because
   * a toast does not sit next to the sentence.
   */
  unsent: {
    alignSelf: 'flex-end',
    borderColor: colors.danger,
    borderRadius: 20,
    borderWidth: 1,
    gap: 2,
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  unsentPressed: { opacity: 0.6 },
  unsentBody: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 24 },
  unsentNote: { ...font.caption, color: colors.danger, fontSize: 12 },
  listWrap: { flex: 1 },
  list: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  skeletonFill: { flex: 1 },
  dayRow: { alignItems: 'center', paddingVertical: spacing.xs },
  // Bare faint text, no pill: on a white ground the whitespace is the divider.
  dayLabel: { ...font.caption, color: colors.textFaint, fontWeight: '600' },
  /**
   * Accent, not primary: v3 spends yellow exactly once per screen, on the
   * send button, so every other floating control here is ordinary blue.
   */
  jump: {
    ...cardShadow,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    bottom: spacing.lg,
    flexDirection: 'row',
    gap: 5,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: spacing.md,
    position: 'absolute',
    end: spacing.lg,
  },
  jumpCount: { ...font.caption, color: colors.textInverse, fontWeight: '700' },
  backToLatest: {
    ...cardShadow,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    position: 'absolute',
    top: spacing.md,
  },
  backToLatestText: { ...font.caption, color: colors.textInverse, fontWeight: '700' },
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
  editingBar: { backgroundColor: colors.warning },
  editingTitle: { color: colors.warning },
  pinBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pinText: { ...font.caption, color: colors.text, flex: 1 },
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
  // The green pair marks earning, same as "Earned" rows elsewhere.
  hintRight: { ...font.caption, color: colors.success, fontWeight: '600' },
  // A fill pill, not an outlined box — v3's one grey allowed to be a shape.
  input: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    color: colors.text,
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    paddingHorizontal: 18,
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
  // A bare muted glyph, sized to line up with the pill beside it.
  attach: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    width: 32,
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
function messageTypeKey(type: MessageDto['type']): MessageKey {
  if (type === 'image') return 'messageMeta.photo'
  if (type === 'audio') return 'chat.voiceMessage'
  return 'messageMeta.message'
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
