import { describe, expect, it } from 'vitest'
import { MESSAGE_TYPES } from '@langx/shared'
import { previewFor } from './messages'

describe('previewFor', () => {
  /**
   * The guard this file exists for.
   *
   * `previewFor` is denormalized into `conversations.lastMessage` at send time
   * and read back by the chat list row *and* the push notification body. A
   * type that carries no `body` and no line here arrives as a blank row and a
   * blank notification — the message lands and says nothing, and nothing else
   * in the stack complains. Adding a `MESSAGE_TYPES` entry without a preview
   * fails here instead.
   */
  it('has a preview for every type that carries no body of its own', () => {
    const bodyless = MESSAGE_TYPES.filter((type) => type !== 'text' && type !== 'correction')
    for (const type of bodyless) {
      expect(previewFor(type), `${type} has no preview`).not.toBe('')
    }
  })

  it('counts the attachments it is given', () => {
    expect(previewFor('image')).toBe('📷 Photo')
    expect(previewFor('image', 3)).toBe('📷 3 photos')
    expect(previewFor('video', 2)).toBe('🎬 2 videos')
    // A voice note travels alone, so it never has a count to report.
    expect(previewFor('audio', 4)).toBe('🎤 Voice message')
  })

  /** Text and corrections carry their own words; a preview would replace them. */
  it('leaves the ones that speak for themselves empty', () => {
    expect(previewFor('text')).toBe('')
    expect(previewFor('correction')).toBe('')
  })
})
