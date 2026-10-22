/**
 * When the composer tells the other side "typing", and when it stops.
 *
 * It used to emit on every keystroke: forty characters were forty socket
 * events, each fanned out by the server to the other phone, each a render of
 * that phone's thread for a dot that was already showing. What the other side
 * needs is the edge — started, stopped — plus a refresh often enough that its
 * `TYPING_TTL_MS` expiry never takes the dots down under somebody still
 * typing. Half the TTL leaves one lost refresh of slack.
 */
export interface TypingSignal {
  /** When "typing" was last sent, or null while not advertising. */
  sentAt: number | null
}

export const TYPING_IDLE: TypingSignal = { sentAt: null }

/**
 * The next state, and what to emit: `true`, `false`, or `null` for nothing.
 * `typing` is what the composer wants the other side to believe now.
 */
export function nextTypingSignal(
  state: TypingSignal,
  input: { typing: boolean; now: number; ttlMs: number },
): { state: TypingSignal; emit: boolean | null } {
  if (!input.typing) {
    return state.sentAt === null ? { state, emit: null } : { state: TYPING_IDLE, emit: false }
  }
  if (state.sentAt !== null && input.now - state.sentAt < input.ttlMs / 2) {
    return { state, emit: null }
  }
  return { state: { sentAt: input.now }, emit: true }
}
