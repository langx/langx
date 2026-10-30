import { MOD_APPLICATION_MIN_STREAK } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { modSheetEnd } from './modSheet'

const viewer = {
  loaded: true,
  guest: false,
  moderator: false,
  streak: MOD_APPLICATION_MIN_STREAK,
  open: false,
}

describe('modSheetEnd', () => {
  it('offers the application from the required streak on', () => {
    expect(modSheetEnd(viewer)).toBe('apply')
  })

  it('locks it a day short', () => {
    expect(modSheetEnd({ ...viewer, streak: MOD_APPLICATION_MIN_STREAK - 1 })).toBe('locked')
  })

  it('says an application is waiting rather than offering a second', () => {
    expect(modSheetEnd({ ...viewer, open: true })).toBe('sent')
  })

  it('waits for the status before offering anything', () => {
    expect(modSheetEnd({ ...viewer, open: undefined })).toBe('none')
  })

  it('tells a moderator they are one, whatever their streak', () => {
    expect(modSheetEnd({ ...viewer, moderator: true, streak: 0 })).toBe('moderator')
  })

  it('offers a guest nothing', () => {
    expect(modSheetEnd({ ...viewer, guest: true })).toBe('none')
  })
})
