import type { MessageAction, MessageActionId } from './messageActions'

/**
 * The state behind the long-press menu, separate from the component that
 * draws it — the same split, and for the same reason, as `alert.ts`: what is
 * decided here is a pure function of a queue, and `src/lib` is the only place
 * the test setup can reach.
 *
 * Unlike alerts these do **not** queue. A menu is opened by a deliberate
 * gesture on one message; a second one arriving means the first is stale, so
 * it is dismissed rather than stacked behind.
 */
/** Where on screen the bubble was when it was pressed. */
export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MessageMenuRequest {
  id: number
  /** Shown above the actions so it is obvious which message is being acted on. */
  preview: string
  /** Tints the copy of the bubble the anchored layout draws. */
  mine: boolean
  actions: MessageAction[]
  /**
   * The measured bubble. Present means the menu is drawn against it; absent
   * falls back to the sheet, which is what a caller with nothing to measure —
   * or a platform where the measurement failed — still gets.
   */
  anchor?: AnchorRect
  /** The emoji strip, when the message can carry a reaction. */
  reactions?: readonly string[]
  /** Which of them is already the viewer's, drawn selected. */
  myReaction?: string | undefined
}

/**
 * Two ways out, because the strip and the rows are one gesture's worth of UI
 * but not one kind of answer.
 */
export type MessageMenuResult =
  { kind: 'action'; id: MessageActionId } | { kind: 'reaction'; emoji: string }

type Listener = (request: MessageMenuRequest | null) => void

let nextId = 1
let open: {
  request: MessageMenuRequest
  resolve: (value: MessageMenuResult | null) => void
} | null = null
let listener: Listener | null = null

function publish(): void {
  listener?.(open?.request ?? null)
}

/** `MessageMenuHost` subscribes; the returned function unsubscribes. */
export function subscribeToMessageMenu(next: Listener): () => void {
  listener = next
  publish()
  return () => {
    if (listener === next) listener = null
  }
}

/**
 * Resolves with what was chosen, or `null` when dismissed.
 *
 * One options object rather than positional arguments: the anchor, the strip
 * and the current reaction all arrive together, and a fifth positional
 * parameter is where a call site starts passing them in the wrong order.
 */
export function openMessageMenu(
  request: Omit<MessageMenuRequest, 'id'>,
): Promise<MessageMenuResult | null> {
  return new Promise((resolve) => {
    // A menu already up belongs to a message the user has moved on from.
    open?.resolve(null)
    open = { request: { ...request, id: nextId++ }, resolve }
    publish()
  })
}

/** Called by the host when an action is picked or the menu is dismissed. */
export function resolveMessageMenu(id: number, value: MessageMenuResult | null): void {
  if (!open || open.request.id !== id) return
  const { resolve } = open
  open = null
  resolve(value)
  publish()
}

/** Test seam: drops any open request without resolving it. */
export function resetMessageMenuForTest(): void {
  open = null
  listener = null
  nextId = 1
}
