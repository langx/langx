/**
 * What is listening to the app's socket — kept apart from the socket, so it
 * can follow it from one connection to the next.
 *
 * The app has one socket, but not one socket *object*. When a handshake is
 * refused — an expired session, or the server's auth lookup having a bad
 * second — socket.io stops trying for good, and `getSocket()` builds a new one
 * the next time anything asks. The listeners hung on the old one stayed there:
 * messages stopped arriving, a call rang a socket nobody was listening to,
 * and nothing errored, because a socket with no listeners is a perfectly
 * healthy socket.
 *
 * So nothing attaches to a socket directly any more. It hands an `attach` to
 * `onSocket`, which runs it on the socket there is now and again on every
 * socket that replaces it — after running the cleanup the previous `attach`
 * returned, so a listener on the shared Manager is never registered twice.
 *
 * Generic and free of socket.io so the unit tests can drive it with plain
 * objects.
 */
export type SocketAttach<S> = (socket: S) => (() => void) | void

export interface SocketListeners<S> {
  /** Attaches now, if there is a socket, and to every one after it. Returns the way to stop. */
  add: (attach: SocketAttach<S>) => () => void
  /** A new socket exists — or, with `null`, none does. Everything attached moves with it. */
  replace: (next: S | null) => void
}

interface Entry<S> {
  attach: SocketAttach<S>
  detach: (() => void) | null
}

export function createSocketListeners<S>(): SocketListeners<S> {
  const entries = new Set<Entry<S>>()
  let current: S | null = null

  return {
    add(attach) {
      const entry: Entry<S> = { attach, detach: null }
      entries.add(entry)
      if (current !== null) entry.detach = attach(current) ?? null
      return () => {
        if (!entries.delete(entry)) return
        entry.detach?.()
        entry.detach = null
      }
    },

    replace(next) {
      if (next === current) return
      current = next
      // A copy: an attach may add or remove listeners of its own.
      for (const entry of [...entries]) {
        entry.detach?.()
        entry.detach = null
        if (next !== null && entries.has(entry)) entry.detach = entry.attach(next) ?? null
      }
    },
  }
}
