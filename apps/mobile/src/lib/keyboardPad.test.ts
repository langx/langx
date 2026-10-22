import { describe, expect, it } from 'vitest'
import {
  KEYBOARD_PAD_IDLE,
  KEYBOARD_PAD_IDLE_TICKS,
  keyboardPad,
  nextKeyboardPad,
  type KeyboardPadEvent,
  type KeyboardPadState,
} from './keyboardPad'

const run = (events: KeyboardPadEvent[], from: KeyboardPadState = KEYBOARD_PAD_IDLE) =>
  events.reduce(nextKeyboardPad, from)

describe('keyboardPad', () => {
  it('pads by how far the keyboard reaches past the navigation-bar inset', () => {
    // The emulator's numbers: an 891 dp window, a keyboard top at 555, a 24 dp bar.
    expect(keyboardPad({ viewBottom: 891, keyboardTop: 555, bottomInset: 24 })).toBe(312)
  })

  it('is zero when the window resized and the keyboard reaches nothing', () => {
    expect(keyboardPad({ viewBottom: 555, keyboardTop: 555, bottomInset: 24 })).toBe(0)
  })
})

describe('nextKeyboardPad', () => {
  const padded = run([
    { type: 'show', shown: 1 },
    { type: 'measured', shown: 1, pad: 312 },
  ])

  it('applies the measurement for the keyboard on screen', () => {
    expect(padded.pad).toBe(312)
  })

  it('drops the pad when the keyboard hides', () => {
    expect(run([{ type: 'hide', shown: 2 }], padded).pad).toBe(0)
  })

  it('ignores a measurement that lands after the hide that followed it', () => {
    const state = run([
      { type: 'show', shown: 1 },
      { type: 'hide', shown: 2 },
      { type: 'measured', shown: 1, pad: 312 },
    ])
    expect(state.pad).toBe(0)
  })

  it('takes a re-measure for a keyboard that changed height', () => {
    const state = run(
      [
        { type: 'show', shown: 2 },
        { type: 'measured', shown: 2, pad: 400 },
      ],
      padded,
    )
    expect(state.pad).toBe(400)
  })

  it('keeps the newer measurement when the older one lands after it', () => {
    const state = run(
      [
        { type: 'show', shown: 2 },
        { type: 'measured', shown: 2, pad: 400 },
        { type: 'measured', shown: 1, pad: 312 },
      ],
      padded,
    )
    expect(state.pad).toBe(400)
  })

  it('keeps the pad while an input is focused', () => {
    const checks = Array.from(
      { length: 10 },
      () => ({ type: 'check', inputFocused: true }) as const,
    )
    expect(run(checks, padded).pad).toBe(312)
  })

  it('rides out a moment with nothing focused, as focus moves between fields', () => {
    const state = run(
      [
        { type: 'check', inputFocused: false },
        { type: 'check', inputFocused: true },
        { type: 'check', inputFocused: false },
      ],
      padded,
    )
    expect(state.pad).toBe(312)
  })

  it('lets go of a pad nothing is typing into, so the tab bar comes back', () => {
    // The hide never arrived: the field was on a screen that has been popped.
    const checks = Array.from(
      { length: KEYBOARD_PAD_IDLE_TICKS },
      () => ({ type: 'check', inputFocused: false }) as const,
    )
    expect(run(checks, padded).pad).toBe(0)
  })

  it('leaves an unpadded state alone', () => {
    const state = run([{ type: 'check', inputFocused: false }])
    expect(state).toBe(KEYBOARD_PAD_IDLE)
  })
})
