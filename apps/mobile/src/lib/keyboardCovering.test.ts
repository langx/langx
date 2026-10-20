import { describe, expect, it } from 'vitest'
import { keyboardCovering } from './keyboardCovering'

describe('keyboardCovering', () => {
  it('follows the keyboard events on a phone, not the focus', () => {
    const base = { touch: true, fieldFocused: true }
    expect(keyboardCovering({ ...base, os: 'ios', keyboardShown: true })).toBe(true)
    expect(keyboardCovering({ ...base, os: 'android', keyboardShown: true })).toBe(true)
    // A hardware keyboard: the field is focused and nothing covers the screen.
    expect(keyboardCovering({ ...base, os: 'ios', keyboardShown: false })).toBe(false)
  })

  it('takes the focused field for the keyboard in a phone browser', () => {
    const base = { os: 'web', touch: true, keyboardShown: false }
    expect(keyboardCovering({ ...base, fieldFocused: true })).toBe(true)
    expect(keyboardCovering({ ...base, fieldFocused: false })).toBe(false)
  })

  it('never folds anything on a desktop browser', () => {
    expect(
      keyboardCovering({ os: 'web', touch: false, keyboardShown: false, fieldFocused: true }),
    ).toBe(false)
  })
})
