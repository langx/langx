import { describe, expect, it } from 'vitest'
import { onSnap, sendSnap, type Snap } from './snapOutbox'

const snap = (conversationId: string): Snap => ({
  conversationId,
  item: { kind: 'image', uri: 'file:///a.jpg', contentType: 'image/jpeg' },
  viewOnce: { replay: false },
})

describe('snapOutbox', () => {
  it('hands a snap to the thread that is listening', () => {
    const got: Snap[] = []
    const off = onSnap('c1', (s) => got.push(s))
    sendSnap(snap('c1'))
    expect(got).toHaveLength(1)
    off()
  })

  it('holds a snap until its thread listens, and only for that thread', () => {
    sendSnap(snap('c2'))
    const other: Snap[] = []
    const offOther = onSnap('c3', (s) => other.push(s))
    expect(other).toHaveLength(0)
    const got: Snap[] = []
    const off = onSnap('c2', (s) => got.push(s))
    expect(got).toHaveLength(1)
    off()
    offOther()
  })

  it('does not let an old screen’s cleanup remove the new listener', () => {
    const first: Snap[] = []
    const second: Snap[] = []
    const offFirst = onSnap('c4', (s) => first.push(s))
    const offSecond = onSnap('c4', (s) => second.push(s))
    offFirst()
    sendSnap(snap('c4'))
    expect(first).toHaveLength(0)
    expect(second).toHaveLength(1)
    offSecond()
  })
})
