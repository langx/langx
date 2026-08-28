import { describe, expect, it } from 'vitest'
import { messageActionsFor, type MessageActionContext } from './messageActions'

const text: MessageActionContext = {
  mine: false,
  type: 'text',
  hasBody: true,
  alreadyTranslated: false,
}
const ids = (over: Partial<MessageActionContext> = {}) =>
  messageActionsFor({ ...text, ...over }).map((a) => a.id)

describe('messageActionsFor', () => {
  it('offers the full set on the other person`s text', () => {
    expect(ids()).toEqual(['copy', 'translate', 'correct', 'report'])
  })

  /** Correcting your own message, or reporting yourself, is not a thing. */
  it('leaves only copy on your own message', () => {
    expect(ids({ mine: true })).toEqual(['copy'])
  })

  it('does not offer to correct anything but text', () => {
    expect(ids({ type: 'image' })).not.toContain('correct')
    expect(ids({ type: 'audio' })).not.toContain('correct')
    expect(ids({ type: 'correction' })).not.toContain('correct')
  })

  /** A correction is already both languages side by side. */
  it('does not offer to translate a correction', () => {
    expect(ids({ type: 'correction' })).not.toContain('translate')
  })

  it('drops translate once the message has been translated', () => {
    expect(ids({ alreadyTranslated: true })).not.toContain('translate')
  })

  /** A voice note without a caption has no text to copy or translate. */
  it('drops the text actions when there is no body', () => {
    expect(ids({ type: 'audio', hasBody: false })).toEqual(['report'])
  })

  it('always leaves a way to report the other person', () => {
    for (const type of ['text', 'correction', 'image', 'audio'] as const) {
      expect(ids({ type, hasBody: false })).toContain('report')
    }
  })

  it('never offers a menu with nothing in it for your own captionless media', () => {
    // Nothing to do: the caller must not open an empty sheet.
    expect(ids({ mine: true, type: 'audio', hasBody: false })).toEqual([])
  })
})
