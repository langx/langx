import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidateBatcher } from './candidateBatcher'

const candidate = (n: number) => ({ candidate: `candidate:${n} 1 udp 1 203.0.113.1 9 typ relay` })

describe('candidateBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function track(options?: { delayMs?: number; maxBatch?: number }) {
    const sent: unknown[] = []
    const batcher = candidateBatcher((signal) => sent.push(signal), {
      delayMs: 200,
      maxBatch: 20,
      ...options,
    })
    return { sent, batcher }
  }

  /** The point of it: each send is a write on the bus between API machines. */
  it('sends candidates that arrive close together as one signal', () => {
    const { sent, batcher } = track()
    batcher.add(candidate(1))
    vi.advanceTimersByTime(50)
    batcher.add(candidate(2))
    batcher.add(candidate(3))
    expect(sent).toEqual([])

    vi.advanceTimersByTime(150)
    expect(sent).toEqual([{ candidates: [candidate(1), candidate(2), candidate(3)] }])
  })

  it('counts the wait from the first candidate, not the last', () => {
    // A steady trickle must not be able to hold a batch back for ever.
    const { sent, batcher } = track()
    for (let i = 0; i < 4; i++) {
      batcher.add(candidate(i))
      vi.advanceTimersByTime(60)
    }
    expect(sent).toHaveLength(1)
  })

  it('never builds a batch larger than the server accepts', () => {
    const { sent, batcher } = track({ maxBatch: 3 })
    for (let i = 0; i < 7; i++) batcher.add(candidate(i))
    // Two full batches went at once; the seventh waits for the timer.
    expect(sent).toHaveLength(2)
    vi.advanceTimersByTime(200)
    expect(sent).toHaveLength(3)
    expect((sent[2] as { candidates: unknown[] }).candidates).toHaveLength(1)
  })

  it('flushes what is waiting, and then says there are no more', () => {
    const { sent, batcher } = track()
    batcher.add(candidate(1))
    batcher.end()
    expect(sent).toEqual([{ candidates: [candidate(1)] }, { endOfCandidates: true }])
    // The timer it cancelled must not send the same batch again.
    vi.advanceTimersByTime(1000)
    expect(sent).toHaveLength(2)
  })

  it('says there are no more even when there were none', () => {
    const { sent, batcher } = track()
    batcher.end()
    expect(sent).toEqual([{ endOfCandidates: true }])
  })

  it('sends nothing after the call is over', () => {
    const { sent, batcher } = track()
    batcher.add(candidate(1))
    batcher.dispose()
    vi.advanceTimersByTime(1000)
    expect(sent).toEqual([])
  })
})
