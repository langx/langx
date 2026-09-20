import { watchPayloadSchema, WATCH_MAX_CONVERSATIONS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { buildWatchPayload, type WatchSources } from './watchPayload'

const ME = 'me-1'
const at = new Date('2026-09-19T08:30:00.000Z')

function conversation(id: string, partner: string, overrides = {}) {
  return {
    _id: id,
    participants: [ME, partner] as const,
    unread: 1,
    lastMessage: { body: 'are you there?', senderId: partner, createdAt: at },
    updatedAt: at,
    ...overrides,
  }
}

const sources: WatchSources = {
  meId: ME,
  conversations: [conversation('c1', 'p1')],
  names: { p1: 'Sofia R.' },
}

describe('buildWatchPayload', () => {
  it('produces a blob the schema accepts', () => {
    const payload = buildWatchPayload(sources, at)

    expect(watchPayloadSchema.parse(payload)).toEqual(payload)
    expect(payload.writtenAt).toBe('2026-09-19T08:30:00.000Z')
  })

  it('names the thread after the other person, not the account reading it', () => {
    const payload = buildWatchPayload(sources, at)

    expect(payload.conversations[0]?.name).toBe('Sofia R.')
  })

  it('marks whose message each one is', () => {
    const payload = buildWatchPayload(
      {
        ...sources,
        threads: {
          c1: [
            { _id: 'm1', body: 'morning', senderId: 'p1', createdAt: at },
            { _id: 'm2', body: 'morning!', senderId: ME, createdAt: at },
          ],
        },
      },
      at,
    )

    expect(payload.conversations[0]?.messages.map((m) => m.mine)).toEqual([false, true])
  })

  /*
   * The rule that keeps the watch from causing traffic. An unread conversation
   * always has a last message, so there is always something to draw — the
   * cached thread is an improvement on it, never a precondition.
   */
  it('falls back to the list’s last message when no thread is cached', () => {
    const payload = buildWatchPayload(sources, at)

    expect(payload.conversations[0]?.messages).toEqual([
      { id: 'c1:last', body: 'are you there?', mine: false, at: '2026-09-19T08:30:00.000Z' },
    ])
  })

  it('uses the cached thread instead of, not as well as, the last message', () => {
    const payload = buildWatchPayload(
      {
        ...sources,
        threads: { c1: [{ _id: 'm1', body: 'are you there?', senderId: 'p1', createdAt: at }] },
      },
      at,
    )

    expect(payload.conversations[0]?.messages).toHaveLength(1)
  })

  /*
   * A name that has not arrived yet is not a row. The profile cache fills
   * from the same list, so this is a moment-long state and the next payload
   * carries the name — showing an unnamed thread on a wrist in the meantime
   * would be a row nobody can act on.
   */
  it('drops a conversation whose partner is not named yet', () => {
    const payload = buildWatchPayload(
      { ...sources, conversations: [conversation('c1', 'p1'), conversation('c2', 'p2')] },
      at,
    )

    expect(payload.conversations.map((c) => c.id)).toEqual(['c1'])
  })

  it('carries at most the cap the schema allows', () => {
    const many = Array.from({ length: WATCH_MAX_CONVERSATIONS + 5 }, (_, i) =>
      conversation(`c${i}`, `p${i}`),
    )
    const names = Object.fromEntries(many.map((_, i) => [`p${i}`, `Person ${i}`]))

    const payload = buildWatchPayload({ ...sources, conversations: many, names }, at)

    expect(payload.conversations).toHaveLength(WATCH_MAX_CONVERSATIONS)
    expect(() => watchPayloadSchema.parse(payload)).not.toThrow()
  })

  it('keeps the newest end of a long thread', () => {
    const long = Array.from({ length: 30 }, (_, i) => ({
      _id: `m${i}`,
      body: `line ${i}`,
      senderId: 'p1',
      createdAt: at,
    }))

    const payload = buildWatchPayload({ ...sources, threads: { c1: long } }, at)
    const messages = payload.conversations[0]?.messages ?? []

    expect(messages).toHaveLength(10)
    expect(messages.at(-1)?.body).toBe('line 29')
  })

  /** Nothing unread is a real answer, and a different one from never having spoken. */
  it('is an empty list rather than nothing when there is nothing unread', () => {
    const payload = buildWatchPayload({ ...sources, conversations: [] }, at)

    expect(payload.conversations).toEqual([])
    expect(() => watchPayloadSchema.parse(payload)).not.toThrow()
  })
})
