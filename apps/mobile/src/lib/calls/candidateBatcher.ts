import { CALL_LIMITS, type CallIceCandidate } from '@langx/shared'

/**
 * Collects the candidates a device finds and hands them on in batches.
 *
 * A device looking for a media path produces candidates one at a time, a few
 * milliseconds apart, and the natural thing is to send each as it comes. Here
 * that is expensive in a way it is not elsewhere: the realtime bus between API
 * machines is a collection, so every relayed frame is a database write, and a
 * call that sent each candidate alone would make a dozen writes where two
 * will do. So they wait a fifth of a second for company.
 *
 * `end` flushes what is waiting and then says there are no more — the other
 * side stops waiting for a better path once it hears that.
 *
 * Pure and free of the media engine so the tests can drive the clock.
 */
export function candidateBatcher(
  send: (signal: { candidates: CallIceCandidate[] } | { endOfCandidates: true }) => void,
  options: { delayMs?: number; maxBatch?: number } = {},
): {
  add: (candidate: CallIceCandidate) => void
  end: () => void
  dispose: () => void
} {
  const delayMs = options.delayMs ?? CALL_LIMITS.candidateBatchMs
  const maxBatch = options.maxBatch ?? CALL_LIMITS.candidatesPerSignal
  let waiting: CallIceCandidate[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush(): void {
    if (timer) clearTimeout(timer)
    timer = undefined
    if (waiting.length === 0) return
    const batch = waiting
    waiting = []
    send({ candidates: batch })
  }

  return {
    add(candidate) {
      waiting.push(candidate)
      // The server refuses a batch larger than this, so a full one goes now.
      if (waiting.length >= maxBatch) flush()
      else timer ??= setTimeout(flush, delayMs)
    },
    end() {
      flush()
      send({ endOfCandidates: true })
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = undefined
      waiting = []
    },
  }
}
