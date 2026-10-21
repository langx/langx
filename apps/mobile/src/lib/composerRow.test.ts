import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { composerShowsMic } from './composerRow'

describe('composerShowsMic', () => {
  it('draws the mic beside an empty field', () => {
    expect(composerShowsMic({ value: '', recording: false })).toBe(true)
    expect(composerShowsMic({ value: '   ', recording: false })).toBe(true)
  })

  it('gives the mic’s slot to the field once a draft is typed', () => {
    expect(composerShowsMic({ value: 'I have been in Lisbon', recording: false })).toBe(false)
  })

  it('keeps the mic while a note records, where it is the stop button', () => {
    expect(composerShowsMic({ value: '', recording: true })).toBe(true)
  })
})

/*
 * The regression itself: with text typed, the row held the field, a disabled
 * mic, Copilot's button and the send, and the field shrank to about half the
 * row. ComposerV3 imports react-native, which vitest cannot load, so this
 * reads the source for the two things that keep the field wide.
 */
describe('ComposerV3 row', () => {
  const source = readFileSync(
    path.resolve(__dirname, '../components/thread/ComposerV3.tsx'),
    'utf8',
  )

  it('draws the mic only when composerShowsMic says so', () => {
    expect(source).toMatch(/\{onMic && showMic \?/)
    expect(source).toMatch(/const showMic = composerShowsMic\(/)
  })

  it('lets the field take the row’s free width', () => {
    const field = /\n {2}field: \{([^}]*)\}/.exec(source)?.[1] ?? ''
    expect(field).toMatch(/flex: 1/)
    expect(field).toMatch(/minWidth: 0/)
  })
})
