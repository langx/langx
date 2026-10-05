import { describe, expect, it, vi } from 'vitest'
import { createSocketListeners } from './socketListeners'

interface FakeSocket {
  name: string
}

describe('createSocketListeners', () => {
  it('attaches to the socket there is now', () => {
    const listeners = createSocketListeners<FakeSocket>()
    const first = { name: 'first' }
    listeners.replace(first)
    const attach = vi.fn()
    listeners.add(attach)
    expect(attach).toHaveBeenCalledWith(first)
  })

  it('waits for a socket when there is none yet', () => {
    const listeners = createSocketListeners<FakeSocket>()
    const attach = vi.fn()
    listeners.add(attach)
    expect(attach).not.toHaveBeenCalled()
    listeners.replace({ name: 'first' })
    expect(attach).toHaveBeenCalledTimes(1)
  })

  /**
   * The bug this exists for: a refused handshake makes `getSocket()` build a
   * new socket, and everything listening has to move to it.
   */
  it('moves every listener to the socket that replaces it, cleaning up first', () => {
    const listeners = createSocketListeners<FakeSocket>()
    const order: string[] = []
    listeners.add((socket) => {
      order.push(`attach ${socket.name}`)
      return () => order.push(`detach ${socket.name}`)
    })
    listeners.replace({ name: 'first' })
    listeners.replace({ name: 'second' })
    expect(order).toEqual(['attach first', 'detach first', 'attach second'])
  })

  it('detaches everything when the socket goes, and attaches again to the next one', () => {
    const listeners = createSocketListeners<FakeSocket>()
    const detach = vi.fn()
    const attach = vi.fn(() => detach)
    listeners.add(attach)
    listeners.replace({ name: 'first' })
    listeners.replace(null)
    expect(detach).toHaveBeenCalledTimes(1)
    listeners.replace({ name: 'after sign-in' })
    expect(attach).toHaveBeenCalledTimes(2)
  })

  it('stops for good when asked, and only once', () => {
    const listeners = createSocketListeners<FakeSocket>()
    const detach = vi.fn()
    const attach = vi.fn(() => detach)
    listeners.replace({ name: 'first' })
    const stop = listeners.add(attach)
    stop()
    stop()
    expect(detach).toHaveBeenCalledTimes(1)
    listeners.replace({ name: 'second' })
    expect(attach).toHaveBeenCalledTimes(1)
  })

  it('does nothing when handed the socket it already has', () => {
    const listeners = createSocketListeners<FakeSocket>()
    const socket = { name: 'first' }
    const attach = vi.fn()
    listeners.add(attach)
    listeners.replace(socket)
    listeners.replace(socket)
    expect(attach).toHaveBeenCalledTimes(1)
  })
})
