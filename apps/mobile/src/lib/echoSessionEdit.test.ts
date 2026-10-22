import { newCardSrs, type EchoCard, type EchoSource } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { canEditInSession, withSessionEdit } from './echoSessionEdit'

const NOW = new Date('2026-10-21T12:00:00Z')

function card(source: EchoSource, overrides: Partial<EchoCard> = {}): EchoCard {
  const srs = newCardSrs(NOW)
  return {
    _id: 'card1',
    lang: 'tr',
    front: 'Yarın görüşürüz.',
    back: 'See you tomorrow.',
    source,
    sourceKey: 'msg:m1',
    srs: { ...srs, due: srs.due.toISOString(), lastReviewedAt: null },
    createdAt: NOW.toISOString(),
    ...overrides,
  } as EchoCard
}

const CHAT: EchoSource = { kind: 'chat', conversationId: 'c1', messageId: 'm1', partnerId: 'p1' }
const SHOWING = { producing: false, revealed: false, offline: false }

describe('canEditInSession', () => {
  it('offers Edit on the cards a person kept or wrote', () => {
    expect(canEditInSession(card(CHAT), SHOWING)).toBe(true)
    expect(canEditInSession(card({ kind: 'manual', id: 'x' }), SHOWING)).toBe(true)
    expect(canEditInSession(card({ kind: 'post', postId: 'p', authorId: 'a' }), SHOWING)).toBe(true)
  })

  it('leaves pack and phrase cards as they are', () => {
    expect(canEditInSession(card({ kind: 'pack', packId: 'k', itemId: 'k#1' }), SHOWING)).toBe(
      false,
    )
    expect(
      canEditInSession(card({ kind: 'phrase', phraseCardId: 'f', conversationId: 'c' }), SHOWING),
    ).toBe(false)
  })

  it('waits while a production card is asking, since the edit shows the answer', () => {
    expect(canEditInSession(card(CHAT), { ...SHOWING, producing: true })).toBe(false)
    expect(canEditInSession(card(CHAT), { ...SHOWING, producing: true, revealed: true })).toBe(true)
  })

  it('is not offered offline', () => {
    expect(canEditInSession(card(CHAT), { ...SHOWING, offline: true })).toBe(false)
  })
})

describe('withSessionEdit', () => {
  const deckCard = card(CHAT)
  const edited = card(CHAT, {
    back: 'See you tomorrow!',
    srs: { ...deckCard.srs, reps: 9 },
  })

  it('draws the saved wording once the edit is newer than the deck', () => {
    const drawn = withSessionEdit(deckCard, 1000, edited, 2000)
    expect(drawn.back).toBe('See you tomorrow!')
    // The grade is decided against the schedule the session started with.
    expect(drawn.srs).toBe(deckCard.srs)
  })

  it('keeps the deck copy when the cached one is older', () => {
    expect(withSessionEdit(deckCard, 2000, edited, 1000)).toBe(deckCard)
  })

  it('keeps the deck copy when nothing, or another card, is cached', () => {
    expect(withSessionEdit(deckCard, 1000, undefined, 0)).toBe(deckCard)
    expect(withSessionEdit(deckCard, 1000, { ...edited, _id: 'other' }, 2000)).toBe(deckCard)
  })
})
