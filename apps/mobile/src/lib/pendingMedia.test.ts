import { describe, expect, it } from 'vitest'
import {
  MAX_PENDING_MEDIA,
  PENDING_MEDIA_STALE_MS,
  addPending,
  advancePending,
  expirePending,
  newPendingId,
  removePending,
  updatePending,
  type PendingMedia,
} from './pendingMedia'
import { UPLOAD_START, advanceUpload, uploadFailed } from './uploadProgress'

const NOW = new Date('2026-09-02T12:00:00.000Z')

function item(clientId: string) {
  return {
    clientId,
    conversationId: 'c1',
    kind: 'image' as const,
    uri: `file:///${clientId}.jpg`,
    contentType: 'image/jpeg',
  }
}

describe('addPending', () => {
  it('starts a row at "preparing", not at zero per cent', () => {
    const [row] = addPending([], item('a'), NOW)
    expect(row?.progress).toEqual(UPLOAD_START)
    expect(row?.startedAt).toBe(NOW.toISOString())
  })

  it('keeps them in the order they were picked', () => {
    const list = addPending(addPending([], item('a'), NOW), item('b'), NOW)
    expect(list.map((row) => row.clientId)).toEqual(['a', 'b'])
  })

  /** Sends are serialised, so this should never happen — which is why it is capped. */
  it('drops the oldest rather than growing without bound', () => {
    let list = addPending([], item('first'), NOW)
    for (let i = 0; i < MAX_PENDING_MEDIA; i++) list = addPending(list, item(`x${i}`), NOW)
    expect(list).toHaveLength(MAX_PENDING_MEDIA)
    expect(list.some((row) => row.clientId === 'first')).toBe(false)
  })
})

describe('updatePending', () => {
  it('moves the row it names and leaves the rest alone', () => {
    const list = addPending(addPending([], item('a'), NOW), item('b'), NOW)
    const moved = updatePending(list, 'b', advanceUpload(UPLOAD_START, 1, 2), NOW)
    expect(moved[0]?.progress).toEqual(UPLOAD_START)
    expect(moved[1]?.progress).toEqual({ phase: 'uploading', fraction: 0.5 })
  })

  /** A progress event for a row the ack already retired. */
  it('is a no-op for a row that has gone', () => {
    const list = addPending([], item('a'), NOW)
    expect(updatePending(list, 'gone', advanceUpload(UPLOAD_START, 1, 2), NOW)).toEqual(list)
  })

  /*
   * The composer is empty by the time an upload fails, so the row is the only
   * place the caption still exists — and what a retry sends it from.
   */
  it('keeps the caption on a row that failed', () => {
    const list = addPending([], { ...item('a'), body: 'Look at this' }, NOW)
    const [failed] = updatePending(list, 'a', uploadFailed(UPLOAD_START), NOW)
    expect(failed?.progress.phase).toBe('failed')
    expect(failed?.body).toBe('Look at this')
  })
})

describe('removePending', () => {
  it('retires exactly one row', () => {
    const list = addPending(addPending([], item('a'), NOW), item('b'), NOW)
    expect(removePending(list, 'a').map((row) => row.clientId)).toEqual(['b'])
  })
})

describe('expirePending', () => {
  const later = new Date(NOW.getTime() + PENDING_MEDIA_STALE_MS + 1)

  /**
   * The ack is what normally retires a row, and media messages carry no
   * `clientId` — so an ack lost to a dropped connection would leave a bubble
   * uploading for as long as the screen stayed open.
   */
  it('fails a row whose ack never came', () => {
    const list = addPending([], item('a'), NOW)
    expect(expirePending(list, later)[0]?.progress.phase).toBe('failed')
  })

  it('leaves a young row alone', () => {
    const list = addPending([], item('a'), NOW)
    expect(expirePending(list, new Date(NOW.getTime() + 1000))[0]?.progress.phase).toBe('reading')
  })

  /**
   * A 64 MB video on a slow uplink is still sending bytes at 90 seconds. It
   * was failed mid-upload, and a tap on the "not sent" row started a second
   * upload while the first went on to land: the message arrived twice.
   */
  it('leaves an upload alone while its bytes are still moving', () => {
    const list = addPending([], item('a'), NOW)
    const moving = advancePending(
      list,
      'a',
      (p) => advanceUpload(p, 50, 100),
      new Date(NOW.getTime() + PENDING_MEDIA_STALE_MS - 1000),
    )
    expect(expirePending(moving, later)[0]?.progress).toEqual({ phase: 'uploading', fraction: 0.5 })
  })

  it('fails an upload that has stopped moving for the whole window', () => {
    const list = addPending([], item('a'), NOW)
    const moved = advancePending(list, 'a', (p) => advanceUpload(p, 50, 100), NOW)
    expect(expirePending(moved, later)[0]?.progress.phase).toBe('failed')
  })

  it('keeps whatever a failed row had got to', () => {
    const list = updatePending(
      addPending([], item('a'), NOW),
      'a',
      uploadFailed(advanceUpload(UPLOAD_START, 40, 100)),
      NOW,
    )
    expect(expirePending(list, later)[0]?.progress).toEqual({ phase: 'failed', fraction: 0.4 })
  })
})

describe('expirePending identity', () => {
  it('returns the same list when nothing expired, so the screen does not re-render', () => {
    const list = addPending([], item('a'), NOW)
    expect(expirePending(list, new Date(NOW.getTime() + 1000))).toBe(list)
    const failed = updatePending(list, 'a', uploadFailed(UPLOAD_START), NOW)
    expect(expirePending(failed, new Date(NOW.getTime() + PENDING_MEDIA_STALE_MS + 1))).toBe(failed)
  })

  it('returns a new list when a row expired', () => {
    const list = addPending([], item('a'), NOW)
    expect(expirePending(list, new Date(NOW.getTime() + PENDING_MEDIA_STALE_MS + 1))).not.toBe(list)
  })
})

describe('advancePending', () => {
  const started = updatePending(
    addPending([], item('a'), NOW),
    'a',
    advanceUpload(UPLOAD_START, 10, 100),
    NOW,
  )

  it('returns the same list while the drawn percent has not moved', () => {
    // 10.0% → 10.4%: the bar still reads 10.
    expect(advancePending(started, 'a', (p) => advanceUpload(p, 104, 1000), NOW)).toBe(started)
  })

  it('moves the row once the drawn percent changes', () => {
    const next = advancePending(started, 'a', (p) => advanceUpload(p, 11, 100), NOW)
    expect(next).not.toBe(started)
    expect(next[0]?.progress.fraction).toBeCloseTo(0.11)
  })

  /**
   * Six 64 MiB videos at ~40 KB/s: one whole percent of the bar is ~3.8 MiB,
   * over 90 seconds of bytes. The label does not change, so the row was never
   * moved, and the sweep failed an upload that was still going up.
   */
  it('keeps a slow upload alive while its bytes move inside one percent', () => {
    let list: PendingMedia[] = started
    for (let s = 5; s <= 120; s += 5) {
      const at = new Date(NOW.getTime() + s * 1000)
      list = advancePending(list, 'a', (p) => advanceUpload(p, 100_000 + s, 1_000_000), at)
      list = expirePending(list, at)
    }
    expect(list[0]?.progress.phase).toBe('uploading')
  })

  it('does not hand back a new list for every event inside one percent', () => {
    const soon = new Date(NOW.getTime() + 1000)
    expect(advancePending(started, 'a', (p) => advanceUpload(p, 101, 1000), soon)).toBe(started)
  })

  it('ignores a row that is no longer there', () => {
    expect(advancePending(started, 'zzz', (p) => advanceUpload(p, 90, 100), NOW)).toBe(started)
  })
})

describe('newPendingId', () => {
  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, newPendingId))
    expect(ids.size).toBe(200)
  })
})
