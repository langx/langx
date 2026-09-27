import { describe, expect, it } from 'vitest'
import {
  DELIVERY_STATES,
  DOUBLE_TAP_REACTION,
  MAX_REACTION_BYTES,
  MESSAGE_REACTIONS,
  REPLY_PREVIEW_MAX_LENGTH,
  canDeleteForEveryone,
  canEditMessage,
  deliveryStateOf,
  isReactionEmoji,
  reactToMessageSchema,
  sendTextMessageSchema,
} from './chat'

describe('deliveryStateOf', () => {
  it('is sent when the server has it and nothing more is known', () => {
    expect(deliveryStateOf({})).toBe('sent')
  })

  it('is delivered once it has reached the recipient device', () => {
    expect(deliveryStateOf({ deliveredAt: new Date() })).toBe('delivered')
  })

  it('is read once they have opened the thread', () => {
    expect(deliveryStateOf({ deliveredAt: new Date(), readAt: new Date() })).toBe('read')
  })

  /**
   * The reason `readAt` is checked first. Every message that predates
   * `deliveredAt` — the v1 import, and everything sent before the second tick
   * shipped — has a `readAt` and no `deliveredAt`, and showing those as one
   * tick would be a visible regression across the whole of history.
   */
  it('reads a message with no delivery stamp as read, not as sent', () => {
    expect(deliveryStateOf({ readAt: new Date() })).toBe('read')
  })

  it('ignores explicit nulls the way it ignores absent fields', () => {
    expect(deliveryStateOf({ deliveredAt: null, readAt: null })).toBe('sent')
  })

  it('accepts the ISO strings the API actually sends', () => {
    expect(deliveryStateOf({ deliveredAt: '2026-08-28T10:00:00.000Z' })).toBe('delivered')
    expect(deliveryStateOf({ readAt: '2026-08-28T10:00:00.000Z' })).toBe('read')
  })

  it('lists the states in the order a message passes through them', () => {
    expect(DELIVERY_STATES).toEqual(['sent', 'delivered', 'read'])
  })
})

describe('canDeleteForEveryone', () => {
  const now = new Date('2026-08-29T12:00:00.000Z')
  const mine = { senderId: 'me', createdAt: '2026-08-29T11:00:00.000Z' }

  it('allows the sender inside the window', () => {
    expect(canDeleteForEveryone(mine, 'me', now)).toBe(true)
  })

  it('refuses someone else message', () => {
    expect(canDeleteForEveryone(mine, 'them', now)).toBe(false)
  })

  it('refuses one already withdrawn, which is what stops the row being offered twice', () => {
    expect(canDeleteForEveryone({ ...mine, deletedAt: now }, 'me', now)).toBe(false)
  })

  it('refuses one past the window', () => {
    const old = { senderId: 'me', createdAt: '2026-08-26T11:00:00.000Z' }
    expect(canDeleteForEveryone(old, 'me', now)).toBe(false)
  })
})

describe('canEditMessage', () => {
  const now = new Date('2026-08-29T12:00:00.000Z')
  const mine = { senderId: 'me', type: 'text', createdAt: '2026-08-29T11:00:00.000Z' }

  it('allows your own recent text', () => {
    expect(canEditMessage(mine, 'me', now)).toBe(true)
  })

  it('refuses someone else message, and anything that is not text', () => {
    expect(canEditMessage(mine, 'them', now)).toBe(false)
    for (const type of ['image', 'audio', 'correction']) {
      expect(canEditMessage({ ...mine, type }, 'me', now)).toBe(false)
    }
  })

  /**
   * The clause that keeps `correction.original` honest: editing a sentence
   * someone has already corrected would leave their correction quoting
   * something that no longer exists.
   */
  it('refuses one somebody has corrected', () => {
    expect(canEditMessage({ ...mine, corrected: true }, 'me', now)).toBe(false)
  })

  it('refuses one past the window, and one already withdrawn', () => {
    const old = { ...mine, createdAt: '2026-08-26T11:00:00.000Z' }
    expect(canEditMessage(old, 'me', now)).toBe(false)
    expect(canEditMessage({ ...mine, deletedAt: now }, 'me', now)).toBe(false)
  })
})

describe('sendTextMessageSchema quote', () => {
  const base = { conversationId: 'c1', body: 'What did you buy?', replyToMessageId: 'm1' }

  it('trims the quote, since the server looks for it in the message as written', () => {
    expect(sendTextMessageSchema.parse({ ...base, quote: '  We bought apples. ' }).quote).toBe(
      'We bought apples.',
    )
  })

  it('refuses an empty quote and one longer than a reply preview', () => {
    expect(sendTextMessageSchema.safeParse({ ...base, quote: '   ' }).success).toBe(false)
    const long = 'a'.repeat(REPLY_PREVIEW_MAX_LENGTH + 1)
    expect(sendTextMessageSchema.safeParse({ ...base, quote: long }).success).toBe(false)
  })
})

describe('reactToMessageSchema', () => {
  const base = { conversationId: 'c1', messageId: 'm1' }
  const accepts = (emoji: string | null): boolean =>
    reactToMessageSchema.safeParse({ ...base, emoji }).success

  it('takes the strip, the double tap and a clear', () => {
    for (const emoji of MESSAGE_REACTIONS) expect(accepts(emoji)).toBe(true)
    expect(accepts(DOUBLE_TAP_REACTION)).toBe(true)
    expect(accepts(null)).toBe(true)
  })

  /** The picker offers the whole keyboard, so every shape of emoji has to pass. */
  it('takes any single emoji, however many code points it is', () => {
    expect(accepts('🦄')).toBe(true)
    expect(accepts('👨‍👩‍👧‍👦')).toBe(true)
    expect(accepts('👍🏽')).toBe(true)
    expect(accepts('👩🏻‍❤️‍💋‍👨🏼')).toBe(true)
    expect(accepts('🇹🇷')).toBe(true)
    expect(accepts('🏴󠁧󠁢󠁳󠁣󠁴󠁿')).toBe(true)
    expect(accepts('7️⃣')).toBe(true)
    expect(accepts('#️⃣')).toBe(true)
  })

  it('refuses text, two emoji and an empty string', () => {
    expect(accepts('')).toBe(false)
    expect(accepts('ok')).toBe(false)
    expect(accepts('7')).toBe(false)
    expect(accepts('👍👍')).toBe(false)
    expect(accepts('👍 🔥')).toBe(false)
    expect(accepts('👍!')).toBe(false)
    // Whitespace would make a second key that looks like the first.
    expect(accepts(' 👍')).toBe(false)
    expect(accepts('👍\n')).toBe(false)
  })

  /** The key becomes a field name on the message; these two would rewrite it. */
  it('refuses anything carrying a dot or a dollar', () => {
    expect(accepts('.')).toBe(false)
    expect(accepts('$')).toBe(false)
    expect(accepts('👍.')).toBe(false)
    expect(accepts('$👍')).toBe(false)
    expect(accepts('$set')).toBe(false)
    expect(accepts('a.b')).toBe(false)
  })

  it('refuses a lone joiner, modifier or unclosed tag run', () => {
    expect(accepts('\u200d')).toBe(false)
    expect(accepts('👍\u200d')).toBe(false)
    expect(accepts('\u{1F3FD}')).toBe(false)
    expect(accepts('🏴\u{E0067}\u{E0062}')).toBe(false)
  })

  it('refuses one emoji stretched past the byte cap', () => {
    // A pictograph with selectors piled on is still one cluster to the parser.
    const stretched = '👍' + '\u{FE0F}'.repeat(MAX_REACTION_BYTES)
    expect(isReactionEmoji('👍\u{FE0F}')).toBe(true)
    expect(accepts(stretched)).toBe(false)
  })
})
