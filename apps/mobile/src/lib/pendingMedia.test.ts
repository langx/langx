import { describe, expect, it } from 'vitest'
import {
  MAX_PENDING_MEDIA,
  PENDING_MEDIA_STALE_MS,
  addPending,
  expirePending,
  newPendingId,
  removePending,
  updatePending,
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
    const moved = updatePending(list, 'b', advanceUpload(UPLOAD_START, 1, 2))
    expect(moved[0]?.progress).toEqual(UPLOAD_START)
    expect(moved[1]?.progress).toEqual({ phase: 'uploading', fraction: 0.5 })
  })

  /** A progress event for a row the ack already retired. */
  it('is a no-op for a row that has gone', () => {
    const list = addPending([], item('a'), NOW)
    expect(updatePending(list, 'gone', advanceUpload(UPLOAD_START, 1, 2))).toEqual(list)
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

  it('keeps whatever a failed row had got to', () => {
    const list = updatePending(
      addPending([], item('a'), NOW),
      'a',
      uploadFailed(advanceUpload(UPLOAD_START, 40, 100)),
    )
    expect(expirePending(list, later)[0]?.progress).toEqual({ phase: 'failed', fraction: 0.4 })
  })
})

describe('newPendingId', () => {
  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, newPendingId))
    expect(ids.size).toBe(200)
  })
})
