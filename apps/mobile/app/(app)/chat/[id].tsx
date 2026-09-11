import Feather from '@expo/vector-icons/Feather'
import {
  canDeleteForEveryone,
  canEditMessage,
  translateTargetFor,
  attachmentsOf,
  MAX_ATTACHMENTS,
  MAX_VIDEO_SECONDS,
  type Media,
  MESSAGE_REACTIONS,
  PHRASE_EXAMPLE_MAX_LENGTH,
  hasFeature,
  webUrl,
  messageTranslationSchema,
  type MessageAsk,
  type MessageTranslation,
} from '@langx/shared'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import {
  markConversationRead,
  uploadMessageMedia,
  useBlockUser,
  useConversation,
  useEffectiveTier,
  useConversationFlags,
  useMe,
  useMessages,
  useMessageWindow,
  useTranslate,
  type MessageDto,
} from '../../../src/api/queries'
import * as Clipboard from 'expo-clipboard'
import { track } from '../../../src/lib/analytics'
import { setActiveConversation } from '../../../src/lib/activeConversation'
import { useKeyboardInset } from '../../../src/hooks/useKeyboardInset'
import { PresenceLine } from '../../../src/components/PresenceLine'
import { ChatComposer } from '../../../src/components/ChatComposer'
import { ComposerHint } from '../../../src/components/ComposerHint'
import { MessageBubble } from '../../../src/components/MessageBubble'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import {
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../../src/components/AttachmentPreview'
import { MessageBubbleSkeleton } from '../../../src/components/skeletons/MessageBubbleSkeleton'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { Screen } from '../../../src/components/ui/Screen'
import { useProfileCache, useProfileCacheStatus } from '../../../src/hooks/useProfileCache'
import { useReviewPrompt } from '../../../src/hooks/useReviewPrompt'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { chooseAlert, confirmAlert, showAlert } from '../../../src/lib/alert'
import { emitWithAck, getSocket } from '../../../src/lib/socket'
import {
  addUnsent,
  newClientId,
  removeUnsent,
  retireDelivered,
  type UnsentMessage,
} from '../../../src/lib/unsentMessages'
import { loadUnsent, saveUnsent } from '../../../src/lib/unsentStore'
import {
  addOutgoing,
  isOutgoingId,
  outgoingId,
  removeOutgoing,
  retireArrived,
  type OutgoingMessage,
} from '../../../src/lib/outgoingMessages'
import { errorCodeOf } from '../../../src/lib/errors'
import { listState } from '../../../src/lib/listState'
import { messageActionsFor } from '../../../src/lib/messageActions'
import { meetingClock } from '../../../src/lib/meetingClock'
import { messagePreviewKey } from '../../../src/lib/messagePreview'
import {
  openMessageMenu,
  type AnchorRect,
  type MessageMenuRequest,
} from '../../../src/lib/messageMenu'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { pickMediaAssets, type PickSource } from '../../../src/lib/pickMediaAsset'
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
import { addMeetingToCalendar } from '../../../src/lib/addToCalendar'
import { showToast } from '../../../src/lib/toast'
import { messagesNewestFirst } from '../../../src/lib/messageCache'
import { dayLabel, messageRows, type MessageRow } from '../../../src/lib/messageGroups'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { planJump } from '../../../src/lib/messageJump'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useReduceMotion } from '../../../src/hooks/useReduceMotion'
import { OfficialMark } from '../../../src/components/OfficialMark'

export default function ChatScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()

  // `at` is the single entry point for "open this thread at that message": a
  // tapped quote uses it, and so will the pinned banner and the starred list.
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>()
  const conversationId = id ?? ''
  const me = useMe()
  const queryClient = useQueryClient()
  const messages = useMessages(conversationId)

  const [draft, setDraft] = useState('')
  /** Sends in flight, drawn in the thread before the server has answered. */
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([])
  const [unsent, setUnsent] = useState<UnsentMessage[]>([])
  /**
   * And back out of the device, because until this the rows lived exactly as
   * long as the screen did. Somebody who types a sentence in a tunnel and goes
   * back to the chat list to see whether anything else arrived was throwing
   * away the only copy of it — the composer is empty by then.
   *
   * Nothing is written back before the read has landed: saving the empty
   * initial state would wipe what this is here to keep.
   */
  const [unsentHydrated, setUnsentHydrated] = useState(false)
  useEffect(() => {
    let cancelled = false
    void loadUnsent(conversationId).then((stored) => {
      if (cancelled) return
      if (stored.length > 0) setUnsent(stored)
      setUnsentHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [conversationId])
  useEffect(() => {
    if (!unsentHydrated) return
    void saveUnsent(conversationId, unsent)
  }, [conversationId, unsent, unsentHydrated])
  const [correcting, setCorrecting] = useState<MessageDto | null>(null)
  /**
   * What this message asks the other person for, once it is sent.
   *
   * Exclusive with a reply rather than combined: both answer "what is this
   * message", and a banner that names one while the send applies the other
   * is the kind of quiet disagreement this composer already avoids for
   * edit, correct and reply.
   */
  const [asking, setAsking] = useState<MessageAsk | null>(null)
  /**
   * Send this one in their language too.
   *
   * A mode rather than a one-shot, because the person who needs it needs it
   * for the whole conversation, not for one sentence — and it turns itself
   * off the moment there is nothing to translate into.
   */
  const [sendTranslated, setSendTranslated] = useState(false)
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
  const block = useBlockUser()
  // For the header menu's pin — the message window does not carry the flags.
  const conversation = useConversation(conversationId)
  const flags = useConversationFlags()
  const recorder = useVoiceRecorder()
  const review = useReviewPrompt()
  /** Only for the pill's dress: white ground and accent ring while it has focus. */
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
  /*
   * Your own sends, drawn before the server has answered. Newest first like
   * `items`, and ahead of them: the inverted list puts index 0 nearest the
   * composer, which is where a sentence just typed belongs. `senderId` is the
   * viewer, so `isMine` and the tail rule treat the row as one of theirs, and
   * the id carries a prefix so the row's actions know to wait for the echo.
   */
  const viewerId = me.data?._id
  const threadItems = useMemo<MessageDto[]>(() => {
    if (!viewerId || outgoing.length === 0) return items
    const standIns: MessageDto[] = outgoing.map((message) => ({
      _id: outgoingId(message.clientId),
      conversationId,
      senderId: viewerId,
      type: 'text',
      body: message.body,
      clientId: message.clientId,
      createdAt: message.sentAt,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.ask ? { ask: message.ask } : {}),
    }))
    return [...standIns, ...items]
  }, [items, outgoing, viewerId, conversationId])
  const rows = useMemo(() => messageRows(threadItems), [threadItems])

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
  // The same retirement for the stand-ins: the echo carries the `clientId`,
  // and whichever of ack and echo arrives first removes the row.
  useEffect(() => {
    setOutgoing((list) =>
      retireArrived(
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
    isPaused: thread.fetchStatus === 'paused',
  })
  // From the participant list, not from the messages: a thread nobody has
  // replied to yet contains only my own sends, and reading the partner off
  // those leaves the header with no name and no avatar.
  // Optional on `participants` too: the response is a bare cast, so an API
  // older than this field would throw here rather than fall back.
  //
  // Two sources, because the messages arrive last. `useConversation` seeds
  // itself from the chat list's cache, so somebody arriving from that list
  // knows the partner on the first render and never sees a placeholder;
  // the two answers are the same participant list, so whichever is in first
  // wins.
  const partnerId =
    messages.data?.pages[0]?.participants?.find((p) => p !== me.data?._id) ??
    conversation.data?.participants.find((p) => p !== me.data?._id) ??
    ''
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
   * Which language to send a translation in: the reader's, not the writer's.
   *
   * `translateTargetFor` is the same rule the Translate action uses, pointed
   * the other way — their first native language with a written form.
   * `undefined` means there is none, and the row is not offered.
   */
  /** Reading a translation is free; sending one is Polyglot. See `PLAN_LIMITS`. */
  const canSendTranslation = hasFeature(useEffectiveTier(), 'sendTranslation')
  const translateInto = partner
    ? translateTargetFor({ nativeLanguages: partner.nativeLanguages })
    : undefined
  // "Not yet" and "never" draw differently: a placeholder while the profile
  // loads, the generic title only for an account that is really gone.
  //
  // Including the window before anybody knows who the partner *is*. The
  // profile query cannot report "pending" for an id nobody has yet, so while
  // both sources are still loading this used to fall through to the "never"
  // branch — a `?` avatar and the word "Chat", which reads as a real header
  // with the wrong content. An error leaves `isPending` false, so the generic
  // title still stands for a thread whose partner really cannot be resolved.
  const partnerLoading =
    useProfileCacheStatus(partnerId ? [partnerId] : [])[partnerId] === 'pending' ||
    (!partnerId && (messages.isPending || conversation.isPending))

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

  /**
   * What the "+" opens.
   *
   * It used to open the picker straight, and the only thing resembling a menu
   * was the picker's own "camera or library?" alert — so the one other thing
   * the composer can attach, a voice note, lived on a microphone at the far
   * end of the row, which is a fine place for it once you know and no place at
   * all before.
   *
   * Rows that carry bytes are drawn locked rather than hidden while the media
   * gate is closed: a row that says "after five more messages" teaches the
   * rule, and one that is missing teaches nothing.
   */
  /** A proposal's time, in the reader's own zone. */
  function meetingWhenFor(message: MessageDto): string {
    if (!message.meeting) return ''
    return meetingClock(new Date(message.meeting.startsAt), me.data?.timezone, locale)
  }

  /**
   * The same instant where the other person is.
   *
   * Empty when they hide their city — the timezone is withheld with it — and
   * empty when it matches the reader's, because "9 PM, and 9 PM for them" is a
   * line that says nothing twice.
   */
  function meetingTheirWhenFor(message: MessageDto): string {
    if (!message.meeting || !partner?.timezone) return ''
    const at = new Date(message.meeting.startsAt)
    const theirs = meetingClock(at, partner.timezone, locale)
    /*
     * Compared as drawn, not as named.
     *
     * Comparing the zone *identifiers* looked equivalent and is not: a reader
     * whose own profile has no `timezone` falls back to the device, so the
     * check ran against `undefined` and never matched — and the card drew
     * "9:00 PM" over "9:00 PM theirs", which is the exact line this feature
     * exists to avoid. Two zones can also differ by name and agree right now
     * (`Europe/London` and `Africa/Abidjan` in winter), and that is the same
     * useless line.
     */
    return theirs === meetingClock(at, me.data?.timezone, locale)
      ? ''
      : t('chat.meetingTheirTime', { time: theirs })
  }

  function meetingLengthFor(message: MessageDto): string {
    if (!message.meeting) return ''
    return t('format.minutes', { count: message.meeting.durationMinutes })
  }

  /**
   * Writes an agreed meeting into this person's calendar.
   *
   * The instant is UTC, so the same one is right for both of them: every
   * calendar renders it in the zone its owner is in, which is the same rule
   * the card itself follows and the reason the two cannot disagree.
   */
  async function addToCalendar(message: MessageDto): Promise<void> {
    if (!message.meeting) return
    const result = await addMeetingToCalendar({
      uid: message._id,
      startsAt: new Date(message.meeting.startsAt),
      durationMinutes: message.meeting.durationMinutes,
      summary: t('chat.meetingSummary', { name: partner?.displayName ?? t('chat.them') }),
      note: message.meeting.note,
      url: webUrl(`/chat/${conversationId}`),
    })
    if (result === 'added' || result === 'updated') {
      showToast(t('chat.meetingCalendarAdded'))
      return
    }
    // `saved` is the web, and the file it downloaded says enough by arriving.
    if (result === 'saved') return
    if (result === 'denied') {
      void showAlert(t('chat.meetingCalendarPermissionTitle'), t('chat.meetingCalendarPermission'))
      return
    }
    void showAlert(
      result === 'noCalendar' ? t('chat.meetingCalendarNone') : t('chat.meetingCalendarFailed'),
    )
  }

  /** Answers a quiz. Once, and never your own — both are the server's rules. */
  async function answerQuiz(message: MessageDto, index: number): Promise<void> {
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'quiz:answer', { conversationId, messageId: message._id, index })
    } catch (caught) {
      void caught
      void showAlert(t('chat.couldNotSend'))
    }
  }

  /** Accepts, declines or withdraws. The server decides who may do which. */
  async function respondMeeting(
    message: MessageDto,
    status: 'accepted' | 'declined' | 'cancelled',
  ): Promise<void> {
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'meeting:respond', {
        conversationId,
        messageId: message._id,
        status,
      })
    } catch (caught) {
      void caught
      void showAlert(t('chat.couldNotSend'), t('chat.meetingFailed'))
    }
  }

  /**
   * Which requests have already been answered.
   *
   * A correction stamps `corrected` on the message it fixes, so that half is a
   * server fact. A spoken answer is only a voice note quoting the message —
   * there is no flag for it, and nothing but the list itself can see it. Both
   * are worked out here and handed to the bubble, which stays dumb.
   */
  const answeredAsks = useMemo(() => {
    const answered = new Set<string>()
    for (const message of items) {
      if (message.corrected) answered.add(message._id)
      if (message.type === 'audio' && message.replyTo) answered.add(message.replyTo.messageId)
    }
    return answered
  }, [items])

  /**
   * Answers the request on somebody else's message.
   *
   * Neither branch is new machinery: a correction opens the composer's own
   * correcting mode, and a spoken answer starts the recorder with the message
   * quoted, which sends an ordinary voice note. That is the whole reason
   * `ask` is a field and not a message type.
   */
  function answerAsk(message: MessageDto, ask: MessageAsk): void {
    if (ask === 'correction') {
      setAsking(null)
      setReplyingTo(null)
      setCorrecting(message)
      setDraft(message.body)
      return
    }
    // The gate is checked before the quote is set, not after: `toggleRecording`
    // would refuse and return, leaving a reply banner pointing at a recording
    // that never started.
    if (mediaLockedFor > 0) {
      void showAlert(t('chat.mediaLockedTitle'), t('chat.mediaLocked', { count: mediaLockedFor }))
      return
    }
    setReplyingTo(message)
    void toggleRecording()
  }

  async function openAttachMenu(): Promise<void> {
    const locked = mediaLockedFor > 0
    const choice = await chooseAlert(t('composer.attachMenu'), undefined, [
      { label: t('composer.attachLibrary'), value: 'library' as const, icon: 'image', locked },
      // No camera on the web: `launchCameraAsync` there is an `<input capture>`,
      // which a phone browser honours and a desktop one ignores — so on a
      // laptop the row would open a file dialog, which is worse than no row.
      ...(Platform.OS === 'web'
        ? []
        : [
            { label: t('composer.attachCamera'), value: 'camera' as const, icon: 'camera', locked },
          ]),
      { label: t('composer.attachVoice'), value: 'voice' as const, icon: 'mic', locked },
      // Never locked: neither carries bytes, so neither is what the media gate
      // is protecting anyone from.
      { label: t('chat.askCorrection'), value: 'askCorrection' as const, icon: 'edit-3' },
      { label: t('chat.askPronunciation'), value: 'askPronunciation' as const, icon: 'volume-2' },
      { label: t('chat.sendPhrase'), value: 'phrase' as const, icon: 'bookmark' },
      { label: t('chat.sendMeeting'), value: 'meeting' as const, icon: 'calendar' },
      { label: t('chat.sendQuiz'), value: 'quiz' as const, icon: 'help-circle' },
      { label: t('chat.stickers'), value: 'sticker' as const, icon: 'smile' },
      // Drawn whether or not the tier includes it, and locked when it does
      // not: a row that opens the paywall sells the thing, and a row that is
      // missing sells nothing. Reading a translation stays free either way.
      ...(translateInto
        ? [
            {
              label: sendTranslated
                ? t('chat.sendTranslatedOff')
                : t('chat.sendTranslatedOn', { language: names.language(translateInto) }),
              value: 'translate' as const,
              icon: 'globe',
              ...(canSendTranslation ? {} : { locked: true }),
            },
          ]
        : []),
    ])
    if (!choice) return
    if (choice === 'phrase') {
      router.push({
        pathname: '/(app)/phrase-card',
        params: { id: conversationId, ...(translateInto ? { lang: translateInto } : {}) },
      })
      return
    }
    if (choice === 'meeting') {
      router.push({ pathname: '/(app)/propose-time', params: { id: conversationId } })
      return
    }
    if (choice === 'quiz') {
      router.push({ pathname: '/(app)/quiz', params: { id: conversationId } })
      return
    }
    if (choice === 'sticker') {
      router.push({ pathname: '/(app)/stickers', params: { id: conversationId } })
      return
    }
    if (choice === 'translate') {
      if (!canSendTranslation) {
        openPaywall('sendTranslation', `/(app)/chat/${conversationId}`)
        return
      }
      setSendTranslated((on) => !on)
      return
    }
    if (choice === 'askCorrection' || choice === 'askPronunciation') {
      // Exclusive with a reply: see `asking`.
      setReplyingTo(null)
      setAsking(choice === 'askCorrection' ? 'correction' : 'pronunciation')
      return
    }
    if (locked) {
      await showAlert(t('chat.mediaLockedTitle'), t('chat.mediaLocked', { count: mediaLockedFor }))
      return
    }
    if (choice === 'voice') {
      await toggleRecording()
      return
    }
    await pickMedia(choice)
  }

  async function pickMedia(source: PickSource): Promise<void> {
    const remaining = MAX_ATTACHMENTS - pendingMedia.length
    if (remaining <= 0) {
      void showAlert(
        t('chat.couldNotSend'),
        t('errors.tooManyAttachments', { count: MAX_ATTACHMENTS }),
      )
      return
    }
    const picked = await pickMediaAssets({ remaining, source })
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

  /*
   * The ceiling stops the recording, rather than letting it run past what the
   * server will accept. `MAX_AUDIO_SECONDS` was a number the recorder computed
   * and nobody read: a note could run to any length, and the refusal arrived
   * after the bytes had been spoken and uploaded.
   *
   * It lands in the composer like any other, so the last thing that happens at
   * the limit is a draft you can still listen to — not a message sent out from
   * under you.
   */
  useEffect(() => {
    if (!recorder.atLimit) return
    void finishRecording()
    // The flag alone, deliberately: `finishRecording` is re-made every render
    // and listing it here would end a recording on every one of them.
  }, [recorder.atLimit])

  async function toggleRecording(): Promise<void> {
    // Guarded at the microphone rather than at the send, because starting a
    // recording somebody is not allowed to send is a worse answer than not
    // starting one: they would speak, then be told.
    if (mediaLockedFor > 0) {
      await showAlert(t('chat.mediaLockedTitle'), t('chat.mediaLocked', { count: mediaLockedFor }))
      return
    }
    if (!recorder.isRecording) {
      // A note does not travel with pictures — one message carries one kind —
      // so the two cannot both be waiting for the same send button.
      if (pendingMedia.length > 0) {
        showToast(t('chat.voiceNeedsEmptyComposer'))
        return
      }
      const started = await recorder.start()
      if (!started && recorder.error) void showAlert(t('chat.microphoneTitle'), recorder.error)
      return
    }
    await finishRecording()
  }

  /**
   * Stops and keeps what was said.
   *
   * Its own function because the ceiling reaches it too: the effect below ends
   * a recording that has run to `MAX_AUDIO_SECONDS`, and what happens to those
   * bytes must not depend on whether a person or the clock stopped it.
   */
  async function finishRecording(): Promise<void> {
    const recording = await recorder.stop()
    if (!recording) return
    /*
     * Held for the send button rather than sent on stop, which is what this
     * did until now. One gesture was fewer taps, but it also meant a voice
     * note was gone the instant you stopped speaking: no way to hear what you
     * had actually said, and no way to change your mind. A note cannot be
     * un-sent, so it is worth the extra tap.
     */
    setPendingMedia([{ kind: 'audio', ...recording }])
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
      // The quota refusal above returns before this: it is a paywall moment,
      // already counted as one, and not a failure of the send path.
      track({ name: 'message_send_failed', properties: { kind: 'media', reason: code ?? null } })
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
  async function deliver(
    body: string,
    clientId: string,
    replyToMessageId?: string,
    ask?: MessageAsk,
    translation?: MessageTranslation,
  ): Promise<void> {
    try {
      /*
       * Twelve seconds is what the ack timeout costs, and with no network it
       * can only end one way: a composer that looks like it is thinking, and
       * then a red row. The row is the honest answer, and this is the only
       * thing between it and the person who typed the sentence. `catch` below
       * does the rest — the code rides along so the funnel can count them.
       */
      if (!onlineManager.isOnline()) {
        throw Object.assign(new Error('offline'), { code: 'OFFLINE' })
      }
      const socket = await getSocket()
      await emitWithAck(socket, 'message:send', {
        conversationId,
        body,
        clientId,
        ...(replyToMessageId ? { replyToMessageId } : {}),
        ...(ask ? { ask } : {}),
        ...(translation ? { translation } : {}),
      })
      setUnsent((list) => removeUnsent(list, clientId))
      track({
        name: 'message_sent',
        properties: { kind: 'text', reply: replyToMessageId !== undefined },
      })
    } catch (error) {
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
          ...(replyToMessageId ? { replyToMessageId } : {}),
          failedAt: new Date().toISOString(),
        }),
      )
      // Swallowed for the reader, counted for us: an unsent row is quiet by
      // design and a rising number of them is not something to find out from
      // a support message.
      track({
        name: 'message_send_failed',
        properties: { kind: 'text', reason: errorCodeOf(error) ?? null },
      })
    } finally {
      // Landed or failed, the stand-in has somewhere better to be: the echo
      // has usually retired it already, the unsent row takes over otherwise.
      setOutgoing((list) => removeOutgoing(list, clientId))
    }
  }

  async function retry(message: UnsentMessage): Promise<void> {
    await deliver(message.body, message.clientId, message.replyToMessageId)
  }

  /**
   * Sends, adding the reader's language when the composer is in that mode.
   *
   * The translation is fetched before the send rather than by the server
   * during it: `POST /translate` is where the quota is spent and the cache is
   * read, and putting a provider round-trip inside `message:send` would make
   * every message wait on it.
   *
   * **A translation that fails does not stop the message.** The sentence the
   * person wrote is the message; the translation is help. Losing the help is a
   * worse outcome than losing nothing, but losing what they typed is worse
   * than both.
   */
  async function deliverTranslated(
    body: string,
    clientId: string,
    replyToMessageId?: string,
    ask?: MessageAsk,
  ): Promise<void> {
    if (!sendTranslated || !translateInto) {
      await deliver(body, clientId, replyToMessageId, ask)
      return
    }
    let translation: MessageTranslation | undefined
    try {
      const result = await translateApi.mutateAsync({ text: body, targetLang: translateInto })
      // Parsed rather than cast: `translateTargetFor` answers with a plain
      // string, and this is the schema the server will check it against
      // anyway. A translation that would be refused is simply not attached.
      const parsed = messageTranslationSchema.safeParse({
        text: result.translatedText,
        lang: translateInto,
        ...(result.sourceLang ? { sourceLang: result.sourceLang } : {}),
      })
      if (parsed.success) translation = parsed.data
    } catch (caught) {
      void caught
      void showAlert(t('chat.couldNotSend'), t('chat.sendTranslatedFailed'))
    }
    await deliver(body, clientId, replyToMessageId, ask, translation)
  }

  async function send(): Promise<void> {
    const body = draft.trim()
    // The attachments are the message when there are any; the draft becomes
    // their caption, which is why this runs before the empty-body guard.
    if (pendingMedia.length > 0) {
      if (sendingMedia) return
      const items = pendingMedia
      setPendingMedia([])
      setDraft('')
      notifyTyping(false)
      await sendAttachments(items, body || undefined)
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      return
    }
    if (!body) return
    /*
     * The field clears on the press and never locks. What was typed is already
     * on its way into the thread as its own row, so the composer has nothing
     * to hold on to — and the next sentence can be typed while the first is
     * still travelling. Two or three "Sending" rows at once is the normal case
     * for somebody who types the way people talk.
     */
    setDraft('')
    notifyTyping(false)
    if (editing) {
      const target = editing
      setEditing(null)
      void commitEdit(target, body)
      return
    }
    if (correcting) {
      const target = correcting
      setCorrecting(null)
      void commitCorrection(target, body)
    } else {
      const reply = replyingTo
      const ask = asking
      setReplyingTo(null)
      setAsking(null)
      const clientId = newClientId(Date.now(), Math.random())
      setOutgoing((list) =>
        addOutgoing(list, {
          clientId,
          body,
          sentAt: new Date().toISOString(),
          ...(reply
            ? { replyTo: { messageId: reply._id, senderId: reply.senderId, preview: reply.body } }
            : {}),
          ...(ask ? { ask } : {}),
        }),
      )
      // `deliver` never rejects — a failure becomes an unsent row.
      void deliverTranslated(body, clientId, reply?._id, ask ?? undefined)
    }
    // Sending is a statement about the live conversation, so it ends a
    // detour into the history rather than posting into the middle of it.
    setJumpAnchor(null)
    // Inverted, so the newest message is offset 0.
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    setAwayFrom(null)
  }

  /**
   * An edit changes a row that exists, so it has nothing to draw ahead of the
   * ack; it waits quietly, and a refusal puts the text back where it was typed
   * so nothing is lost.
   */
  async function commitEdit(target: MessageDto, body: string): Promise<void> {
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:edit', {
        conversationId,
        messageId: target._id,
        body,
      })
    } catch {
      setEditing(target)
      setDraft(body)
      void showAlert(t('chat.actionFailed'), t('common.retry'))
    }
  }

  /** The same rule for a correction: the card appears when the server echoes it. */
  async function commitCorrection(target: MessageDto, corrected: string): Promise<void> {
    try {
      const socket = await getSocket()
      await emitWithAck(socket, 'message:correct', {
        conversationId,
        targetMessageId: target._id,
        corrected,
      })
      track({ name: 'message_sent', properties: { kind: 'correction', reply: false } })
      review.request({ kind: 'correction' })
    } catch {
      setCorrecting(target)
      setDraft(corrected)
      void showAlert(t('chat.actionFailed'), t('common.retry'))
    }
  }

  const isMine = (message: MessageDto) => message.senderId === me.data?._id

  /**
   * Translates into the caller's first native language *that can be written*
   * — the one they read fluently. Asking which language every time would be a
   * question with an obvious answer, and translating into what they are
   * *learning* would defeat the purpose. Somebody with more than one native
   * language picks between them in Settings; `translateTargetFor` applies
   * that choice, falls back to the first native language, and skips a signed
   * one, which has no written form and which the server refuses as a target.
   */
  const translateTarget = me.data ? translateTargetFor(me.data) : undefined
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
    const picture = pictureOf(message)
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
      preview: message.body || t(messagePreviewKey(message.type)),
      mine: isMine(message),
      // So the menu lifts the picture out of the thread rather than the word
      // "Photo". Audio is left out on purpose: see `MessageMenuRequest`.
      ...(picture ? { picture, caption: message.body } : {}),
      // Looked up rather than passed down: `endsGroup` belongs to the row, and
      // a fourth positional argument on `onLongPress` is how the anchor and
      // the flag start arriving in the wrong order.
      tail: rows.some(
        (row) => row.kind === 'message' && row.message._id === message._id && row.endsGroup,
      ),
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
    } else if (picked.id === 'phrase') {
      /*
       * Their sentence, already in the example field, with the term left for
       * the reader to write — the word they want is a judgement the app cannot
       * make from a sentence.
       *
       * Sliced to `PHRASE_EXAMPLE_MAX_LENGTH`, because `FormField`'s
       * `maxLength` bounds *typing* and not a value handed to it: an unsliced
       * 2000-character body would look accepted in the form and then be
       * refused by `sendPhraseSchema` on save.
       *
       * `params`, never a query string built by hand: `routeLiterals.test.ts`
       * treats an interpolated literal as a wildcard, so a typo in one is
       * exactly what it cannot catch.
       */
      router.push({
        pathname: '/(app)/phrase-card',
        params: {
          id: conversationId,
          ...(translateInto ? { lang: translateInto } : {}),
          example: message.body.slice(0, PHRASE_EXAMPLE_MAX_LENGTH),
        },
      })
    } else if (picked.id === 'report') {
      reportMessage(message)
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
          { label: t('chat.deleteForEveryone'), value: 'everyone', destructive: true },
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
   * Stable, for the same reason `onLongPress` below is.
   *
   * It was an inline arrow passed straight into a `memo`'d `MessageBubble`, so
   * every bubble's props were unequal on every render — which meant every
   * keystroke in the composer re-rendered every visible bubble, on the same JS
   * thread the swipe gesture used to run on. `setViewing` is a setter and is
   * already stable, so this needs no ref.
   */
  const onOpenMedia = useCallback(
    (items: Media[], index: number) => setViewing({ items, index }),
    [],
  )

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

  function reportMessage(message: MessageDto): void {
    if (!partnerId) return
    router.push({
      pathname: '/(app)/report',
      params: { userId: partnerId, conversationId, messageId: message._id },
    })
  }

  /**
   * The header's overflow: what the prototype's chat sheet offers that the app
   * already has. Pinning the *chat* is left out — this screen's page carries
   * the pinned message, not the conversation's own flags, so the row could not
   * say whether it would pin or unpin.
   */
  async function openThreadMenu(): Promise<void> {
    if (!partner) return
    const pinned = conversation.data?.pinned ?? false
    const choice = await chooseAlert(partner.displayName, undefined, [
      { label: t('chat.viewProfile'), value: 'profile' },
      { label: t('chats.starredMessages'), value: 'starred' },
      // Beside Starred, because the two answer the same question — where did
      // the thing I wanted to keep go — and differ only in how much shape it
      // had when it was kept.
      { label: t('chat.phraseDeck'), value: 'phrases' },
      // The third answer to the same question, and the only one that needs
      // nothing kept first: a photo is already saved by having been sent.
      { label: t('chat.media'), value: 'media' },
      // The same toggle the list offers, where the design puts it as well.
      { label: pinned ? t('chats.unpin') : t('chats.pin'), value: 'pin' },
      { label: t('common.block'), value: 'block', destructive: true },
    ])
    if (choice === 'profile') {
      openProfile(partner.handle, `/(app)/chat/${conversationId}`)
    } else if (choice === 'starred') {
      router.push('/(app)/starred')
    } else if (choice === 'phrases') {
      router.push({ pathname: '/(app)/phrases', params: { id: conversationId } })
    } else if (choice === 'media') {
      router.push({ pathname: '/(app)/chat-media', params: { id: conversationId } })
    } else if (choice === 'pin') {
      flags.mutate({ conversationId, pinned: !pinned })
    } else if (choice === 'block') {
      // The same question the profile asks, so the two places agree.
      const yes = await confirmAlert({
        title: t('common.block'),
        message: t('profile.blockConfirm', { name: partner.displayName }),
        confirmLabel: t('common.block'),
        destructive: true,
      })
      if (!yes) return
      block.mutate(partnerId, {
        onSuccess: () => {
          goBackTo('/(app)/(tabs)/chats')
          showToast(t('profile.blocked', { name: partner.displayName }))
        },
      })
    }
  }

  /**
   * The composer's mode, as the banner shows it: what it says and what its
   * cross undoes. Edit wins over correct wins over reply — the order `send`
   * checks them in, so the banner never names a mode the send would not take.
   */
  const mode = editing
    ? {
        label: t('chat.editing'),
        preview: editing.body,
        clear: () => {
          setEditing(null)
          setDraft('')
        },
      }
    : correcting
      ? {
          label: t('chat.correcting'),
          preview: correcting.body,
          clear: () => {
            setCorrecting(null)
            setDraft('')
          },
        }
      : asking
        ? {
            label:
              asking === 'correction' ? t('chat.askingCorrection') : t('chat.askingPronunciation'),
            preview:
              asking === 'correction'
                ? t('chat.askingCorrectionHint')
                : t('chat.askingPronunciationHint'),
            clear: () => setAsking(null),
          }
        : sendTranslated && translateInto
          ? {
              label: t('chat.sendTranslatedBanner', { language: names.language(translateInto) }),
              preview: t('chat.sendTranslatedHint'),
              clear: () => setSendTranslated(false),
            }
          : replyingTo
            ? {
                label: isMine(replyingTo)
                  ? t('chat.replyingToYourself')
                  : t('chat.replyingTo', { name: partner?.displayName ?? t('chat.them') }),
                preview: replyingTo.body || t(messagePreviewKey(replyingTo.type)),
                clear: () => setReplyingTo(null),
              }
            : null

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
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerUser}
            onPress={() => partner && openProfile(partner.handle, `/(app)/chat/${conversationId}`)}
          >
            {partnerLoading ? (
              <Skeleton width={40} height={40} radius={20} />
            ) : (
              <Avatar
                url={partner?.avatarUrl}
                name={partner?.displayName ?? '?'}
                seed={partner?._id}
                size={40}
                online={partner?.isOnline ?? false}
              />
            )}
            <View style={styles.headerText}>
              {partnerLoading ? (
                <>
                  <Skeleton width={120} height={14} />
                  <Skeleton width={80} height={12} style={styles.headerSkeletonGap} />
                </>
              ) : (
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {partner?.displayName ?? t('chat.title')}
                  </Text>
                  {partner?.official ? <OfficialMark size={14} /> : null}
                </View>
              )}
              {/*
              One line that is either presence or typing, never both stacked —
              the header is 40px tall and a third line pushes the avatar out of
              alignment with the name. `PresenceLine` keeps that true: online
              and last-seen are mutually exclusive states of one line, not two.
            */}
              {partnerLoading ? null : partnerTyping ? (
                <Text style={styles.typing}>{t('chat.typing')}</Text>
              ) : (
                <PresenceLine lastActiveAt={partner?.lastActiveAt} />
              )}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('messageMenu.more')}
            hitSlop={8}
            onPress={() => void openThreadMenu()}
            style={styles.more}
          >
            <Feather name="more-horizontal" size={22} color={colors.text} />
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
          {state === 'failed' && rows.length === 0 ? (
            /*
             * `rows.length` as well as the state: a thread that failed to load
             * can still have something to show — the message just typed into a
             * tunnel is an unsent row, and replacing it with an error panel
             * would take away the one copy of that sentence there is.
             */
            <View style={[styles.list, styles.skeletonFill]}>
              <LoadFailed onRetry={() => void thread.refetch()} />
            </View>
          ) : state === 'skeleton' ? (
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
                  {/*
                    Last, so it sits nearest the composer: inverted, this header
                    is the bottom of the thread, and the other person typing is
                    the newest thing in it.
                  */}
                  {partnerTyping ? <TypingIndicator /> : null}
                </>
              }
              /**
               * Footer, not header: inverted, the footer is what sits on top —
               * the spinner for older pages and, on a thread too short to have
               * any, the opening tip.
               */
              ListFooterComponent={
                <>
                  {thread.isFetchingNextPage ? <ActivityIndicator style={styles.older} /> : null}
                  {items.length < SHORT_THREAD_MESSAGES ? (
                    <ComposerHint slot="chat" style={styles.threadTip} />
                  ) : null}
                </>
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
                  // A stand-in has no server id yet, so a menu or a reply on it
                  // would have nothing to act on until the echo lands.
                  <MessageBubble
                    message={row.message}
                    mine={isMine(row.message)}
                    endsGroup={row.endsGroup}
                    partnerName={partner?.displayName ?? t('chat.them')}
                    translation={translations[row.message._id]}
                    translating={translating === row.message._id}
                    highlighted={highlighted === row.message._id}
                    askAnswered={answeredAsks.has(row.message._id)}
                    onAnswerAsk={answerAsk}
                    onRespondMeeting={(message, status) => void respondMeeting(message, status)}
                    onAnswerQuiz={(message, index) => void answerQuiz(message, index)}
                    onAddToCalendar={(message) => void addToCalendar(message)}
                    meetingWhen={meetingWhenFor(row.message)}
                    meetingLength={meetingLengthFor(row.message)}
                    meetingTheirWhen={meetingTheirWhenFor(row.message)}
                    pending={isOutgoingId(row.message._id)}
                    onLongPress={isOutgoingId(row.message._id) ? ignore : onLongPress}
                    onReply={isOutgoingId(row.message._id) ? ignore : onReply}
                    onJumpTo={onJumpTo}
                    onOpenMedia={onOpenMedia}
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
          The block under the hairline is `ChatComposer`, shared with the
          screen that starts a conversation. What needs a conversation — the
          attach control, the recorder, the microphone — is passed in from
          here, and the mode banner and picked attachments ride above the row.
        */}
        {/*
          A channel has no composer. `@langx` welcomes and announces, and the
          API refuses a message to it — so a box to type in would be offering
          something that answers 403. The line in its place says what the
          thread is, rather than leaving the screen ending in nothing.
        */}
        {partner?.official && partner.acceptsMessages === false ? (
          <View style={styles.channelNote}>
            <Text style={styles.channelNoteText}>{t('chat.channelOnly')}</Text>
          </View>
        ) : (
          <ChatComposer
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={
              correcting
                ? t('chat.writeCorrection')
                : items.length === 0 && partner
                  ? t('chat.sayHello', { name: partner.displayName })
                  : t('chat.writeMessage')
            }
            onSend={() => void send()}
            hasAttachment={pendingMedia.length > 0}
            busy={sendingMedia}
            above={
              <>
                {/*
                One shape for all three modes — reply, edit, correct. The label
                says which; the line under it is the message it is about, cut
                to one line because the field below already holds the text
                being written.
              */}
                {mode ? (
                  <View style={styles.modeBanner}>
                    <View style={styles.modeText}>
                      <Text style={styles.modeLabel} numberOfLines={1}>
                        {mode.label}
                      </Text>
                      <Text style={styles.modePreview} numberOfLines={1}>
                        {mode.preview}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('common.cancel')}
                      hitSlop={8}
                      onPress={mode.clear}
                    >
                      <Feather name="x" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : null}
                {/* Above the row rather than inside it: the row holds the send
                button, and anything that grows in there competes for width with
                the only control that sends the message. */}
                <AttachmentPreviewRow
                  pending={pendingMedia}
                  onRemove={(index) =>
                    setPendingMedia((items) => items.filter((_, at) => at !== index))
                  }
                />
              </>
            }
            leading={
              recorder.isRecording ? (
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
                /*
                Neither greyed nor disabled by the media lock any more: it
                opens a menu, and the lock belongs to the rows inside that
                carry bytes — which is where the sheet draws it, with the
                number of messages still to come.
              */
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('composer.attachMenu')}
                  onPress={() => void openAttachMenu()}
                  disabled={
                    sendingMedia ||
                    pendingMedia.length >= MAX_ATTACHMENTS ||
                    // A voice draft is waiting for the send button, and a note
                    // travels alone. Send it or throw it away first.
                    pendingMedia.some((item) => item.kind === 'audio')
                  }
                  hitSlop={8}
                  style={styles.attach}
                >
                  <Feather name="plus" size={22} color={colors.textMuted} />
                </Pressable>
              )
            }
            idleAction={
              /* A microphone when there is nothing to send, which is the gesture
              people already expect from a chat app. */
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.voiceMessage')}
                onPress={() => void toggleRecording()}
                disabled={sendingMedia}
                style={[
                  styles.mic,
                  recorder.isRecording && styles.recordButtonActive,
                  sendingMedia && styles.micDisabled,
                ]}
              >
                <Feather
                  name={recorder.isRecording ? 'square' : 'mic'}
                  size={20}
                  color={recorder.isRecording ? colors.textInverse : colors.text}
                />
              </Pressable>
            }
          />
        )}
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
  channelNote: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  channelNoteText: { ...font.caption, color: colors.textFaint, textAlign: 'center' },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
  },
  // v3 draws the back control as a bare arrow in the 34 box `ScreenHeader`
  // gives it — the hairline under the header is all the chrome this row carries.
  back: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerUser: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerNameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  headerName: { ...font.heading, color: colors.text, fontSize: 17 },
  headerSkeletonGap: { marginTop: 6 },
  // The accent, like Online: somebody typing is as live as the status line gets.
  typing: { ...font.caption, color: colors.accent, fontSize: 13 },
  more: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
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
  /**
   * Inverted, so the two vertical paddings swap: the prototype's 16 at the top
   * of the thread is this container's *bottom*, and its 8 above the composer
   * is the top.
   */
  list: {
    gap: 10,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skeletonFill: { flex: 1 },
  // The cell is flipped back upright, so this reads as written: 4 above, 10 below.
  dayRow: { alignItems: 'center', paddingBottom: 10, paddingTop: spacing.xs },
  // Bare faint text, no pill: on a white ground the whitespace is the divider.
  dayLabel: { ...font.caption, color: colors.textFaint, fontWeight: '600' },
  /**
   * The opening tip, centred in the thread: a tinted line rather than a card,
   * because it is the thread speaking and not a control to be sent away.
   */
  threadTip: {
    ...font.caption,
    alignSelf: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 300,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    textAlign: 'center',
  },
  // Their bubble with nothing in it yet but the three dots.
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.fill,
    borderBottomStartRadius: 6,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  typingDot: { backgroundColor: colors.textMuted, borderRadius: radius.pill, height: 7, width: 7 },
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
  /** The reply / edit / correct banner: a fill panel behind an accent edge. */
  modeBanner: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    borderStartColor: colors.accent,
    borderStartWidth: 3,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modeText: { flex: 1, minWidth: 0 },
  modeLabel: { ...font.caption, color: colors.accent, fontWeight: '700' },
  modePreview: { ...font.body, color: colors.textMuted, fontSize: 14 },
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
  // A fill circle: the microphone is the resting state, not the committing one.
  mic: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  recordButtonActive: { backgroundColor: colors.danger },
  micDisabled: { opacity: 0.35 },
  // A bare muted glyph, sized to line up with the pill beside it.
  attach: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 44,
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

/** For a stand-in row: the server has not named it yet, so its actions wait. */
const ignore = () => undefined

/**
 * Below this many messages the thread still shows its opening tip. Three is
 * the prototype's cut-off: after a couple of exchanges the reader has found
 * the composer and does not need telling how a thread works.
 */
const SHORT_THREAD_MESSAGES = 3

/** The dots' resting opacity; the prototype's `blink` swings between this and 1. */
const TYPING_DIM = 0.3

/**
 * Three dots in their bubble, blinking in turn.
 *
 * The stagger sits *outside* each loop: a delay inside it would lengthen a
 * dot's cycle by its own offset and the three would drift out of step within a
 * few seconds. Still when the reader has asked for less motion — three dots
 * already say what they mean.
 */
function TypingIndicator() {
  const styles = useStyles()
  const t = useT()
  const reduceMotion = useReduceMotion()
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(TYPING_DIM))).current

  useEffect(() => {
    if (reduceMotion) return
    const animation = Animated.parallel(
      dots.map((dot, index) =>
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.loop(
            Animated.sequence([
              Animated.timing(dot, { toValue: 1, duration: 480, useNativeDriver: true }),
              Animated.timing(dot, { toValue: TYPING_DIM, duration: 480, useNativeDriver: true }),
              Animated.delay(240),
            ]),
          ),
        ]),
      ),
    )
    animation.start()
    return () => animation.stop()
  }, [dots, reduceMotion])

  return (
    <View style={styles.typingBubble} accessibilityLabel={t('chat.typing')}>
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.typingDot, { opacity: dot }]} />
      ))}
    </View>
  )
}

/**
 * What the menu's copy of the bubble should draw, for the messages that draw a
 * picture rather than a sentence.
 *
 * Audio is not one of them even though it carries an attachment: its bubble is
 * a player, and the copy would mount a second one.
 */
function pictureOf(message: MessageDto): MessageMenuRequest['picture'] {
  if (message.type === 'sticker') {
    return message.sticker ? { kind: 'sticker', ...message.sticker } : undefined
  }
  if (message.type !== 'image' && message.type !== 'video') return undefined
  const items = attachmentsOf(message)
  return items.length > 0 ? { kind: 'media', items } : undefined
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
