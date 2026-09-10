import { describe, expect, it } from 'vitest'
import { enterSendsOnNative, shouldSubmitOnEnter } from './submitOnEnter'

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

describe('enterSendsOnNative', () => {
  /** The Mac build: no on-screen keyboard, so the return key has to send. */
  it('sends on a native desktop', () => {
    expect(enterSendsOnNative('ios', true)).toBe(true)
  })

  it('leaves the return key alone on a phone or a tablet', () => {
    expect(enterSendsOnNative('ios', false)).toBe(false)
    expect(enterSendsOnNative('android', false)).toBe(false)
  })

  /** A desktop browser has the key handler above, which tells the Enters apart. */
  it('stays out of the way on web', () => {
    expect(enterSendsOnNative('web', true)).toBe(false)
  })
})
