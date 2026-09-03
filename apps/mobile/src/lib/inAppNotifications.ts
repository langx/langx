/**
 * A message that arrived while the app was open, drawn as a banner the user
 * can tap.
 *
 * The OS banner is deliberately suppressed for these — see `foregroundPush.ts`.
 * Somebody looking at the app does not need their phone to buzz at them about
 * a thread two taps away; they need to be able to see it and get to it.
 */
export interface MessageBanner {
  id: number
  conversationId: string
  senderId: string
  /** Chosen here so the host can word it; the wire carries a raw message type. */
  preview: MessagePreview
  body: string
}

export type MessagePreview = 'text' | 'image' | 'audio' | 'correction'

/** Long enough to read a name and glance at a line, short enough to ignore. */
export const MESSAGE_BANNER_DURATION_MS = 5000

type Listener = (banner: MessageBanner | null) => void

let nextId = 1
let current: MessageBanner | null = null
let listener: Listener | null = null

export function subscribeToMessageBanner(next: Listener): () => void {
  listener = next
  next(current)
  return () => {
    if (listener === next) listener = null
  }
}

/**
 * Replaces whatever was showing, rather than queueing behind it — the opposite
 * of `toast.ts`, and worth saying why.
 *
 * A toast reports the outcome of something the user did, and each one has to
 * be seen or the app has silently swallowed an answer. A banner is a pointer
 * to the chat list, which already shows every one of these messages with an
 * unread count beside it. Three quick messages must not hold the top of the
 * screen for fifteen seconds to tell somebody something the next screen tells
 * them anyway.
 */
export function showMessageBanner(input: Omit<MessageBanner, 'id'>): void {
  current = { ...input, id: nextId++ }
  listener?.(current)
}

export function dismissMessageBanner(id: number): void {
  if (current?.id !== id) return
  current = null
  listener?.(null)
}

export function resetMessageBannersForTest(): void {
  current = null
  listener = null
  nextId = 1
}

/** The wire's message type, narrowed to the four the banner can word. */
export function previewOf(type: string): MessagePreview {
  if (type === 'image' || type === 'audio' || type === 'correction') return type
  return 'text'
}

interface IncomingDecision {
  message: {
    senderId: string
    conversationId: string
    type: string
    deleted?: boolean
    hidden?: boolean
  }
  meId: string | undefined
  activeConversationId: string | null
  appActive: boolean
  /** `notificationsAllowed(prefs, 'messages', 'push')` — see below. */
  messagesPushAllowed: boolean
}

/**
 * What to do about a message that just arrived over the socket.
 *
 * A pure function taking everything it needs, so the mobile test setup — node,
 * no renderer, `src/lib` only — can exercise every branch. `appActive` is
 * passed in rather than read here for the same reason: `AppState` comes from
 * `react-native`, which this file must not import.
 *
 * That flag is not a formality. On Android the JS thread keeps running in the
 * background, so a message can arrive while the chat screen is still the
 * focused route and nobody is looking at it — marking it read there would
 * clear an unread badge for a message the user has never seen.
 *
 * The banner obeys the **messages/push** switch, deliberately. It is the
 * foreground face of that channel: one switch labelled "Messages — Push" has
 * to silence every unsolicited "somebody wrote to you", wherever it is drawn.
 * The chat list and its unread counts still update, because that is data
 * arriving rather than a notification being sent — and on the web, where no
 * push exists, this is the only thing that switch does.
 */
export function shouldShowIncomingBanner({
  message,
  meId,
  activeConversationId,
  appActive,
  messagesPushAllowed,
}: IncomingDecision): 'banner' | 'markRead' | 'ignore' {
  // No `meId` means the cache has not answered yet, or this is a guest. Either
  // way there is nobody to decide "not mine" against.
  if (!meId) return 'ignore'
  if (message.senderId === meId) return 'ignore'
  if (message.deleted || message.hidden) return 'ignore'

  // Reading the thread it arrived in *is* the read receipt, which the chat
  // screen only posts on focus — so a message arriving while it sits open
  // would otherwise stay unread until the user left and came back.
  if (activeConversationId === message.conversationId && appActive) return 'markRead'

  if (!messagesPushAllowed) return 'ignore'
  return 'banner'
}
