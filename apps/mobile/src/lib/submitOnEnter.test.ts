import { describe, expect, it } from 'vitest'
import { shouldSubmitOnEnter } from './submitOnEnter'

describe('shouldSubmitOnEnter', () => {
  it('sends on a bare Enter', () => {
    expect(shouldSubmitOnEnter('Enter', false)).toBe(true)
  })

  /** The composer is a textarea on web; Shift+Enter is how you write line two. */
  it('leaves Shift+Enter to insert a newline', () => {
    expect(shouldSubmitOnEnter('Enter', true)).toBe(false)
  })

  it('ignores every other key', () => {
    for (const key of ['a', ' ', 'Escape', 'Tab', 'NumpadEnter', '']) {
      expect(shouldSubmitOnEnter(key, false)).toBe(false)
    }
  })
})
