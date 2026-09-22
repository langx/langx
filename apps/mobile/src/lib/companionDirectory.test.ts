import { describe, expect, it } from 'vitest'
import { COMPANION_DIRECTORY_LIMIT, companionDirectorySchema } from '@langx/shared'
import { buildCompanionDirectory } from './companionDirectory'

const me = 'me'
const now = new Date('2026-09-21T12:00:00.000Z')
const at = new Date('2026-09-21T09:00:00.000Z')

function conversation(id: string, other: string, overrides = {}) {
  return {
    _id: id,
    participants: [me, other],
    unread: 0,
    updatedAt: at,
    lastMessage: { body: 'are you there?' },
    ...overrides,
  }
}

/** What a row with nothing waiting carries, so the cases below say only what they are about. */
function row(id: string, name: string) {
  return { id, name, unread: 0, at: '2026-09-21T09:00:00.000Z', preview: 'are you there?' }
}

const unreadLabel = (count: number) => `${count} new`

describe('buildCompanionDirectory', () => {
  it('names the other participant, in the list order it was given', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1'), conversation('b', 'p2')],
      names: { p1: 'Mateo', p2: 'Katya' },
      unreadLabel,
      now,
    })
    expect(directory.conversations).toEqual([row('a', 'Mateo'), row('b', 'Katya')])
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })

  /**
   * The profile cache fills in behind the conversation list, so a thread
   * whose partner has not arrived yet is ordinary rather than exceptional. It
   * is dropped instead of carried as "Unknown", because an entry Siri cannot
   * say is an entry nobody can ask for — and it would sit in the Shortcuts
   * picker looking like a defect.
   */
  it('drops a conversation whose partner has no name yet', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1'), conversation('b', 'p2')],
      names: { p2: 'Katya' },
      unreadLabel,
      now,
    })
    expect(directory.conversations).toEqual([row('b', 'Katya')])
  })

  it('keeps the most recent of two people with the same name', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('new', 'p1'), conversation('old', 'p2')],
      names: { p1: 'Maria', p2: 'maria' },
      unreadLabel,
      now,
    })
    expect(directory.conversations).toEqual([row('new', 'Maria')])
  })

  it('stops at the cap, which the schema also enforces', () => {
    const many = Array.from({ length: COMPANION_DIRECTORY_LIMIT + 5 }, (_, index) =>
      conversation(`c${index}`, `p${index}`),
    )
    const names = Object.fromEntries(many.map((_, index) => [`p${index}`, `Person ${index}`]))
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: many,
      names,
      unreadLabel,
      now,
    })

    expect(directory.conversations).toHaveLength(COMPANION_DIRECTORY_LIMIT)
    expect(directory.conversations[0]?.id).toBe('c0')
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })

  it('is empty rather than absent when nothing can be named', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1')],
      names: {},
      unreadLabel,
      now,
    })
    expect(directory.conversations).toEqual([])
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })

  /*
   * The count and the phrase are both carried, and the phrase is the half a
   * car can draw — Swift has no catalogue and no plural rules. It is left out
   * rather than set to "0 new" when nothing is waiting: a row that says
   * nothing is waiting is a row saying something.
   */
  it('labels an unread conversation and says nothing about a read one', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [
        conversation('a', 'p1', { unread: 3 }),
        conversation('b', 'p2', { unread: 0 }),
      ],
      names: { p1: 'Mateo', p2: 'Katya' },
      unreadLabel,
      now,
    })

    expect(directory.conversations[0]).toMatchObject({ unread: 3, unreadLabel: '3 new' })
    expect(directory.conversations[1]?.unreadLabel).toBeUndefined()
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })

  /** A conversation nobody has written in yet is a row with a name and no line under it. */
  it('carries no preview when there is no last message', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1', { lastMessage: undefined })],
      names: { p1: 'Mateo' },
      unreadLabel,
      now,
    })

    expect(directory.conversations[0]?.preview).toBeUndefined()
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })

  /** An instant, not words: the phone writes this blob rarely and a phrase would go stale. */
  it('carries when the thread last moved, however the list spells it', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1', { updatedAt: '2026-09-21T09:00:00.000Z' })],
      names: { p1: 'Mateo' },
      unreadLabel,
      now,
    })

    expect(directory.conversations[0]?.at).toBe('2026-09-21T09:00:00.000Z')
  })
})
