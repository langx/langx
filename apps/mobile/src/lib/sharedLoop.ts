/**
 * One running animation for any number of the things that show it.
 *
 * Built for `ui/Skeleton`: a loading screen draws a dozen placeholder blocks,
 * and when each ran its own loop they started on the frame each mounted, so
 * the screen shimmered in a dozen phases at once rather than breathing as one
 * page. Every block now reads one value that one loop drives; the first block
 * to mount starts it and the last one to go stops it, so nothing pulses on a
 * screen that has stopped loading.
 *
 * Pure — no React Native here, so the counting is testable under vitest. The
 * caller says what starting and stopping mean.
 */
export interface Loop {
  start: () => void
  stop: () => void
}

export interface SharedLoop {
  /**
   * Counts one more user, starting the loop if it was the first. Returns the
   * release, which is safe to call twice: a React effect's cleanup can run
   * again after a fast refresh, and a second release must not stop the loop
   * under somebody else.
   */
  acquire: () => () => void
  /** How many users hold the loop now. */
  users: () => number
}

/** `make` is called each time the loop starts from nothing, so it can reset first. */
export function sharedLoop(make: () => Loop): SharedLoop {
  let count = 0
  let running: Loop | null = null

  return {
    acquire() {
      count += 1
      if (count === 1) {
        running = make()
        running.start()
      }
      let released = false
      return () => {
        if (released) return
        released = true
        count -= 1
        if (count === 0) {
          running?.stop()
          running = null
        }
      }
    },
    users: () => count,
  }
}
