/**
 * Which conversation is on screen right now, if any.
 *
 * A module variable rather than context, for the reason `toast.ts` gives: the
 * one thing that needs to read it is a socket handler, which is not a
 * component and cannot use a hook. Keeping it in `src/lib` also keeps it
 * inside the only directory the mobile test setup can load.
 *
 * Set from `useFocusEffect`, not from mount. `chat/[id]` is a hidden tab
 * screen, so it stays mounted after the user navigates away — a mount effect
 * would leave the app believing the thread is still being read for the rest
 * of the session, and silently swallow every banner for it.
 */
let activeConversationId: string | null = null

export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId
}

export function getActiveConversation(): string | null {
  return activeConversationId
}

/** Test seam. */
export function resetActiveConversationForTest(): void {
  activeConversationId = null
}
