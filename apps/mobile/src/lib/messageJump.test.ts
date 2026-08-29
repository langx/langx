import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import type { MessageRow } from './messageGroups'
import { planJump } from './messageJump'

function row(id: string): MessageRow {
  return {
    kind: 'message',
    key: id,
    endsGroup: true,
    message: { _id: id } as MessageDto,
  }
}

const DAY: MessageRow = { kind: 'day', key: 'day:2026-08-29', day: '2026-08-29' }

describe('planJump', () => {
  it('scrolls to a target that is already mounted', () => {
    expect(planJump([row('a'), row('b')], 'b')).toEqual({ kind: 'scroll', index: 1 })
  })

  /** The index addresses rendered rows, and headings are rendered rows. */
  it('counts date headings in the index', () => {
    expect(planJump([row('a'), DAY, row('b')], 'b')).toEqual({ kind: 'scroll', index: 2 })
  })

  it('fetches a window for a target that has paged out', () => {
    expect(planJump([row('a')], 'gone')).toEqual({ kind: 'fetch', anchorId: 'gone' })
  })

  it('fetches when nothing is loaded at all', () => {
    expect(planJump([], 'x')).toEqual({ kind: 'fetch', anchorId: 'x' })
  })
})
