import { describe, expect, it } from 'vitest'
import { messageActionsFor, paginateActions, type MessageActionContext } from './messageActions'

const theirs: MessageActionContext = {
  mine: false,
  type: 'text',
  hasBody: true,
  alreadyTranslated: false,
  canEdit: false,
  corrected: false,
  starred: false,
  pinned: false,
}

const ids = (overrides: Partial<MessageActionContext> = {}) =>
  messageActionsFor({ ...theirs, ...overrides }).map((a) => a.id)

const find = (overrides: Partial<MessageActionContext>, id: string) =>
  messageActionsFor({ ...theirs, ...overrides }).find((a) => a.id === id)

describe('messageActionsFor', () => {
  it('offers the full set on the other person text', () => {
    expect(ids()).toEqual([
      'reply',
      'correct',
      'translate',
      'copy',
      'delete',
      'star',
      'pin',
      'report',
    ])
  })

  it('never offers to correct, translate or report your own message', () => {
    const own = ids({ mine: true })
    expect(own).not.toContain('correct')
    expect(own).not.toContain('translate')
    expect(own).not.toContain('report')
  })

  it('drops translate once it has been translated', () => {
    expect(ids({ alreadyTranslated: true })).not.toContain('translate')
  })

  it('only corrects text, never an attachment or another correction', () => {
    for (const type of ['image', 'audio', 'correction'] as const) {
      expect(ids({ type })).not.toContain('correct')
    }
  })

  it('has nothing to copy on a captionless voice note', () => {
    expect(ids({ type: 'audio', hasBody: false })).not.toContain('copy')
  })

  /** A filter on your own copy, so it never depends on age or authorship. */
  it('offers delete and star on every message, whoever sent it', () => {
    for (const mine of [true, false]) {
      expect(ids({ mine })).toContain('delete')
      expect(ids({ mine })).toContain('star')
    }
  })

  it('offers edit only when the caller says the rules allow it', () => {
    expect(ids({ mine: true, canEdit: true })).toContain('edit')
    expect(ids({ mine: true, canEdit: false })).not.toContain('edit')
  })

  /**
   * Shown rather than hidden: on your own recent message a missing Edit reads
   * as a bug, so the row stays and says why it cannot be used.
   */
  it('explains the lock on a corrected message instead of hiding it', () => {
    const edit = find({ mine: true, canEdit: false, corrected: true }, 'edit')
    expect(edit?.disabled).toBe(true)
    expect(edit?.label).toMatch(/Corrected/)
  })

  it('names star and pin for what pressing them will do', () => {
    expect(find({ starred: true }, 'star')?.label).toBe('Unstar')
    expect(find({ starred: false }, 'star')?.label).toBe('Star')
    expect(find({ pinned: true }, 'pin')?.label).toBe('Unpin')
  })
})

describe('paginateActions', () => {
  const all = messageActionsFor(theirs)

  it('keeps the everyday five on the first page', () => {
    const { actions, hasMore } = paginateActions(all, 'primary')
    expect(actions.map((a) => a.id)).toEqual(['reply', 'correct', 'translate', 'copy', 'delete'])
    expect(hasMore).toBe(true)
  })

  it('puts the rest behind More', () => {
    const { actions, hasMore } = paginateActions(all, 'more')
    expect(actions.map((a) => a.id)).toEqual(['star', 'pin', 'report'])
    expect(hasMore).toBe(false)
  })

  /** A `More…` row that opens an empty page is worse than one row too many. */
  it('offers no second page when there is nothing on it', () => {
    const primaryOnly = all.filter((a) => a.page === 'primary')
    expect(paginateActions(primaryOnly, 'primary')).toEqual({
      actions: primaryOnly,
      hasMore: false,
    })
  })
})
