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
export interface MessageMenuRequest {
  id: number
  /** Shown above the actions so it is obvious which message is being acted on. */
  preview: string
  actions: MessageAction[]
}

type Listener = (request: MessageMenuRequest | null) => void

let nextId = 1
let open: { request: MessageMenuRequest; resolve: (value: MessageActionId | null) => void } | null =
  null
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

/** Resolves with the chosen action, or `null` when dismissed. */
export function openMessageMenu(
  preview: string,
  actions: MessageAction[],
): Promise<MessageActionId | null> {
  return new Promise((resolve) => {
    // A menu already up belongs to a message the user has moved on from.
    open?.resolve(null)
    open = { request: { id: nextId++, preview, actions }, resolve }
    publish()
  })
}

/** Called by the host when an action is picked or the menu is dismissed. */
export function resolveMessageMenu(id: number, value: MessageActionId | null): void {
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
