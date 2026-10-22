import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateMissedEvents, restartConnection, resumedFromBackground } from './missedEvents'

describe('resumedFromBackground', () => {
  it('is the phone coming back from the background', () => {
    expect(resumedFromBackground('background', 'active')).toBe(true)
  })

  /** The notification shade or Face ID going away; the socket never dropped. */
  it('is not the shade going away', () => {
    expect(resumedFromBackground('inactive', 'active')).toBe(false)
  })

  it('is not leaving, and not the first state of a launch', () => {
    expect(resumedFromBackground('active', 'background')).toBe(false)
    expect(resumedFromBackground('active', 'inactive')).toBe(false)
    expect(resumedFromBackground('unknown', 'active')).toBe(false)
    expect(resumedFromBackground('active', 'active')).toBe(false)
  })
})

describe('invalidateMissedEvents', () => {
  /**
   * Every list tab, the unread total the tab badge and the app icon read, and
   * every cache under a thread including a jump window — and nothing else.
   * `me` is the control: a resume is not a reason to ask who the user is
   * again.
   */
  it('marks every chat list and thread cache stale, and nothing else', async () => {
    const client = new QueryClient()
    const stale = [
      ['conversations', 'all'],
      ['conversations', 'unreplied'],
      // The tab badge and the app icon read this one, and it is the whole
      // reason the three counts used to disagree after a resume. It looked
      // covered here for a while by `['conversations', 'unread']` — which is
      // not a key anything writes: the filters are all/unreplied/archived.
      ['unread'],
      // The bell, and the list behind it. A follow that lands while the phone
      // is asleep is a push rather than a socket event, so this is the only
      // thing that corrects the count on the way back.
      ['notifications'],
      ['notificationsUnread'],
      ['messages', 'c1'],
      ['messages', 'c1', 'around', 'm9'],
      // The chat header's presence line. A message that arrived as a push
      // leaves it saying "last seen" long ago until this refetches it.
      ['profile', 'u1'],
    ]
    for (const key of [...stale, ['me']]) client.setQueryData(key, {})

    await invalidateMissedEvents(client)

    for (const key of stale) {
      expect(client.getQueryState(key)?.isInvalidated, key.join('/')).toBe(true)
    }
    expect(client.getQueryState(['me'])?.isInvalidated).toBe(false)
  })
})

/**
 * What socket.io-client 4.8 does on `disconnect()` then `connect()`, checked
 * against a real server: the socket emits `disconnect` and then `connect`,
 * and the Manager emits no `reconnect` — that event is only for the
 * Manager's own retries.
 */
function fakeSocket() {
  const handlers = new Map<string, Set<() => void>>()
  const emit = (event: string): void => {
    for (const handler of [...(handlers.get(event) ?? [])]) handler()
  }
  return {
    emit,
    disconnect: vi.fn(() => emit('disconnect')),
    connect: vi.fn(),
    once(event: 'connect', listener: () => void) {
      const wrapped = (): void => {
        handlers.get(event)?.delete(wrapped)
        listener()
      }
      Object.assign(wrapped, { listener })
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(wrapped)
    },
    off(event: 'connect', listener: () => void) {
      for (const handler of handlers.get(event) ?? []) {
        if ((handler as { listener?: unknown }).listener === listener) {
          handlers.get(event)!.delete(handler)
        }
      }
    },
  }
}

describe('restartConnection', () => {
  /**
   * The network-came-back restart. The socket was holding a connection that
   * had stopped carrying packets, so whatever was sent in that time never
   * arrived — and with no Manager `reconnect` nothing went back for it.
   */
  it('resyncs once the restarted socket is connected again', () => {
    const socket = fakeSocket()
    const resync = vi.fn()
    restartConnection(socket, resync)
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
    expect(socket.connect).toHaveBeenCalledTimes(1)
    expect(resync).not.toHaveBeenCalled()
    socket.emit('connect')
    expect(resync).toHaveBeenCalledTimes(1)
  })

  /** A flapping radio restarts it several times before anything connects. */
  it('resyncs once for several restarts before the connection is back', () => {
    const socket = fakeSocket()
    const resync = vi.fn()
    restartConnection(socket, resync)
    restartConnection(socket, resync)
    restartConnection(socket, resync)
    socket.emit('connect')
    socket.emit('connect')
    expect(resync).toHaveBeenCalledTimes(1)
  })
})
