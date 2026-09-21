import { describe, expect, it } from 'vitest'
import { COMPANION_DIRECTORY_LIMIT, companionDirectorySchema } from '@langx/shared'
import { buildCompanionDirectory } from './companionDirectory'

const me = 'me'
const now = new Date('2026-09-21T12:00:00.000Z')

function conversation(id: string, other: string) {
  return { _id: id, participants: [me, other] }
}

describe('buildCompanionDirectory', () => {
  it('names the other participant, in the list order it was given', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1'), conversation('b', 'p2')],
      names: { p1: 'Mateo', p2: 'Katya' },
      now,
    })
    expect(directory.conversations).toEqual([
      { id: 'a', name: 'Mateo' },
      { id: 'b', name: 'Katya' },
    ])
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
      now,
    })
    expect(directory.conversations).toEqual([{ id: 'b', name: 'Katya' }])
  })

  it('keeps the most recent of two people with the same name', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('new', 'p1'), conversation('old', 'p2')],
      names: { p1: 'Maria', p2: 'maria' },
      now,
    })
    expect(directory.conversations).toEqual([{ id: 'new', name: 'Maria' }])
  })

  it('stops at the cap, which the schema also enforces', () => {
    const many = Array.from({ length: COMPANION_DIRECTORY_LIMIT + 5 }, (_, index) =>
      conversation(`c${index}`, `p${index}`),
    )
    const names = Object.fromEntries(many.map((_, index) => [`p${index}`, `Person ${index}`]))
    const directory = buildCompanionDirectory({ meId: me, conversations: many, names, now })

    expect(directory.conversations).toHaveLength(COMPANION_DIRECTORY_LIMIT)
    expect(directory.conversations[0]?.id).toBe('c0')
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })

  it('is empty rather than absent when nothing can be named', () => {
    const directory = buildCompanionDirectory({
      meId: me,
      conversations: [conversation('a', 'p1')],
      names: {},
      now,
    })
    expect(directory.conversations).toEqual([])
    expect(companionDirectorySchema.safeParse(directory).success).toBe(true)
  })
})
