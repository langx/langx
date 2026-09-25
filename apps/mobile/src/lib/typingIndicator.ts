import { TYPING_TTL_MS } from '@langx/shared'

/**
 * "Typing…" on the reader's side, as something that runs out rather than a
 * flag that waits to be turned off.
 *
 * It used to be a flag, and only the other person's stop signal lowered it.
 * That signal goes missing in ordinary use (`TYPING_TTL_MS` lists how), and
 * a missing one left the header saying "typing…" over a conversation that
 * had gone quiet hours ago. Now every "typing" starts a clock and every
 * keystroke on the other side restarts it, so a lost stop costs a few
 * seconds instead of the rest of the session.
 *
 * Pure and free of `react-native` so the unit tests can load it; the screen
 * owns the socket and hands the events in.
 */
export function typingIndicator(
  onChange: (typing: boolean) => void,
  ttlMs: number = TYPING_TTL_MS,
): { set: (typing: boolean) => void; dispose: () => void } {
  let expiry: ReturnType<typeof setTimeout> | undefined

  function stop(): void {
    if (expiry) clearTimeout(expiry)
    expiry = undefined
  }

  return {
    set(typing) {
      stop()
      if (typing) expiry = setTimeout(() => onChange(false), ttlMs)
      onChange(typing)
    },
    dispose: stop,
  }
}
