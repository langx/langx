import { describe, expect, it } from 'vitest'
import { nextTypingSignal, TYPING_IDLE } from './typingSignal'

const TTL = 6000

describe('nextTypingSignal', () => {
  it('emits once on the first keystroke and not on the next ones', () => {
    const first = nextTypingSignal(TYPING_IDLE, { typing: true, now: 0, ttlMs: TTL })
    expect(first.emit).toBe(true)
    const second = nextTypingSignal(first.state, { typing: true, now: 200, ttlMs: TTL })
    expect(second.emit).toBeNull()
    expect(second.state).toBe(first.state)
  })

  it('refreshes at half the TTL so the other side never expires it mid-sentence', () => {
    const first = nextTypingSignal(TYPING_IDLE, { typing: true, now: 0, ttlMs: TTL })
    expect(nextTypingSignal(first.state, { typing: true, now: 2999, ttlMs: TTL }).emit).toBeNull()
    const refreshed = nextTypingSignal(first.state, { typing: true, now: 3000, ttlMs: TTL })
    expect(refreshed.emit).toBe(true)
    expect(refreshed.state.sentAt).toBe(3000)
  })

  it('emits the stop only while advertising', () => {
    const typing = nextTypingSignal(TYPING_IDLE, { typing: true, now: 0, ttlMs: TTL })
    const stop = nextTypingSignal(typing.state, { typing: false, now: 100, ttlMs: TTL })
    expect(stop.emit).toBe(false)
    expect(stop.state).toBe(TYPING_IDLE)
    expect(nextTypingSignal(stop.state, { typing: false, now: 200, ttlMs: TTL }).emit).toBeNull()
  })

  it('starts again at once after a stop, as after a send', () => {
    const typing = nextTypingSignal(TYPING_IDLE, { typing: true, now: 0, ttlMs: TTL })
    const stop = nextTypingSignal(typing.state, { typing: false, now: 100, ttlMs: TTL })
    expect(nextTypingSignal(stop.state, { typing: true, now: 150, ttlMs: TTL }).emit).toBe(true)
  })
})
