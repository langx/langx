import { describe, expect, it } from 'vitest'
import {
  chatsListItems,
  chatsListKey,
  coachThread,
  type ChatsListItem,
  type ChatsPage,
  type ChatsThread,
} from './chatsList'

/** A thread whose last message is `minutesAgo` old — newer the smaller. */
function thread(id: string, minutesAgo: number, over: Partial<ChatsThread> = {}): ChatsThread {
  return {
    _id: id,
    unreplied: false,
    archived: false,
    bothSpoke: true,
    partner: { _id: `u-${id}`, accountStatus: 'active' },
    lastMessage: {
      createdAt: new Date(Date.UTC(2026, 9, 18, 12) - minutesAgo * 60_000).toISOString(),
    },
    ...over,
  }
}

function page(items: ChatsThread[], pinned: ChatsThread[] = []): ChatsPage<ChatsThread> {
  return { pinned, items }
}

/** The list as short strings, so a whole layout reads as one line. */
function shape(items: ChatsListItem<ChatsThread>[]): string[] {
  return items.map((item) =>
    item.kind === 'heading'
      ? `# ${item.heading}`
      : item.kind === 'waiting'
        ? `block ${item.thread._id}`
        : `row ${item.thread._id}`,
  )
}

describe('chatsListItems', () => {
  it('draws nothing before the first page', () => {
    expect(chatsListItems([])).toEqual([])
  })

  it('is just the rows, with no headings, when nobody is waiting', () => {
    expect(shape(chatsListItems([page([thread('a', 1), thread('b', 2)])]))).toEqual([
      'row a',
      'row b',
    ])
  })

  it('puts the people waiting first, newest first, then the rest', () => {
    const items = chatsListItems([
      page([
        thread('mine', 1),
        thread('anna', 2, { unreplied: true }),
        thread('old', 3),
        thread('elif', 4, { unreplied: true }),
      ]),
    ])
    expect(shape(items)).toEqual([
      '# waiting',
      'block anna',
      'block elif',
      '# others',
      'row mine',
      'row old',
    ])
  })

  it('has no second heading when everybody is waiting', () => {
    const items = chatsListItems([page([thread('a', 1, { unreplied: true })])])
    expect(shape(items)).toEqual(['# waiting', 'block a'])
  })

  /** The rule that keeps the list still while a page loads under the thumb. */
  it('reads waiting off the first page only; a later page stays rows', () => {
    const items = chatsListItems([
      page([thread('a', 1, { unreplied: true }), thread('b', 2)]),
      page([thread('c', 30, { unreplied: true })]),
    ])
    expect(shape(items)).toEqual(['# waiting', 'block a', '# others', 'row b', 'row c'])
  })

  it('takes a pinned thread that is waiting into the blocks, by recency', () => {
    const pinnedWaiting = thread('pin', 90, { unreplied: true })
    const pinnedQuiet = thread('pinq', 80)
    const items = chatsListItems([
      page([thread('new', 1, { unreplied: true }), thread('x', 5)], [pinnedWaiting, pinnedQuiet]),
    ])
    expect(shape(items)).toEqual([
      '# waiting',
      'block new',
      'block pin',
      '# others',
      'row pinq',
      'row x',
    ])
  })

  it('leaves out of the blocks whoever cannot read a reply, or was put away', () => {
    // A list from an older API names nobody.
    const nameless = thread('nameless', 3, { unreplied: true })
    delete nameless.partner
    const items = chatsListItems([
      page([
        thread('official', 1, {
          unreplied: true,
          partner: { _id: 'langx', official: true, accountStatus: 'active' },
        }),
        thread('gone', 2, {
          unreplied: true,
          partner: { _id: 'g', accountStatus: 'deleted' },
        }),
        nameless,
      ]),
    ])
    expect(shape(items)).toEqual(['row official', 'row gone', 'row nameless'])
  })

  it('draws a thread once when a cursor hands it back twice', () => {
    const a = thread('a', 1)
    const items = chatsListItems([page([a, thread('b', 2)]), page([a, thread('c', 3)])])
    expect(shape(items)).toEqual(['row a', 'row b', 'row c'])
  })

  it('has no blocks in the archive, where every thread is put away', () => {
    const items = chatsListItems([
      page([
        thread('a', 1, { unreplied: true, archived: true }),
        thread('b', 2, { archived: true }),
      ]),
    ])
    expect(shape(items)).toEqual(['row a', 'row b'])
  })
})

describe('chatsListKey', () => {
  it('names the kind, so a block that becomes a row is a new cell', () => {
    const a = thread('a', 1)
    expect(chatsListKey({ kind: 'waiting', thread: a })).toBe('waiting:a')
    expect(chatsListKey({ kind: 'row', thread: a })).toBe('row:a')
    expect(chatsListKey({ kind: 'heading', heading: 'others' })).toBe('heading:others')
  })
})

describe('coachThread', () => {
  it('opens the first block when somebody is waiting', () => {
    const items = chatsListItems([page([thread('a', 1), thread('w', 2, { unreplied: true })])])
    expect(coachThread(items)?._id).toBe('w')
  })

  it('otherwise opens the newest thread where the other person has written', () => {
    const items = chatsListItems([
      page([
        thread('only-me', 1, { bothSpoke: false }),
        thread('official', 2, { partner: { _id: 'l', official: true, accountStatus: 'active' } }),
        thread('both', 3),
      ]),
    ])
    expect(coachThread(items)?._id).toBe('both')
  })

  it('has nowhere to go when nobody has written to you', () => {
    const items = chatsListItems([page([thread('only-me', 1, { bothSpoke: false })])])
    expect(coachThread(items)).toBeUndefined()
  })
})
