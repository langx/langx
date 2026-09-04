import { describe, expect, it } from 'vitest'
import {
  UPLOAD_START,
  advanceUpload,
  percentOf,
  thumbProgress,
  uploadFailed,
  uploadSent,
} from './uploadProgress'

describe('advanceUpload', () => {
  it('leaves "preparing" behind on the first byte', () => {
    expect(advanceUpload(UPLOAD_START, 10, 100)).toEqual({ phase: 'uploading', fraction: 0.1 })
  })

  /** A retried chunk reports fewer bytes than the last event did. */
  it('never runs backwards', () => {
    const half = advanceUpload(UPLOAD_START, 50, 100)
    expect(advanceUpload(half, 20, 100).fraction).toBe(0.5)
  })

  it('cannot exceed the whole file', () => {
    expect(advanceUpload(UPLOAD_START, 200, 100).fraction).toBe(1)
  })

  /** `lengthComputable` is false, so the event carries a zero total. */
  it('keeps whatever it had when the total is unknown', () => {
    const some = advanceUpload(UPLOAD_START, 30, 100)
    expect(advanceUpload(some, 40, 0)).toEqual({ phase: 'uploading', fraction: 0.3 })
  })

  it('divides no empty file by zero', () => {
    expect(advanceUpload(UPLOAD_START, 0, 0)).toEqual({ phase: 'uploading', fraction: 0 })
  })

  /** A late progress event after the PUT resolved must not reopen the bar. */
  it('ignores anything that arrives after the bytes are up', () => {
    const sent = uploadSent(advanceUpload(UPLOAD_START, 100, 100))
    expect(advanceUpload(sent, 50, 100)).toEqual(sent)
  })

  it('ignores anything that arrives after a failure', () => {
    const failed = uploadFailed(advanceUpload(UPLOAD_START, 40, 100))
    expect(advanceUpload(failed, 90, 100)).toEqual(failed)
  })
})

describe('uploadSent', () => {
  it('pins the bar full while the message is still being sent', () => {
    expect(uploadSent(advanceUpload(UPLOAD_START, 97, 100))).toEqual({
      phase: 'sending',
      fraction: 1,
    })
  })

  it('does not rescue a failure', () => {
    expect(uploadSent(uploadFailed(UPLOAD_START)).phase).toBe('failed')
  })
})

describe('percentOf', () => {
  it('rounds down, so it never reads 100 before it is', () => {
    expect(percentOf({ phase: 'uploading', fraction: 0.999 })).toBe(99)
    expect(percentOf({ phase: 'sending', fraction: 1 })).toBe(100)
    expect(percentOf(UPLOAD_START)).toBe(0)
  })
})

describe('thumbProgress', () => {
  it('draws nothing until something is being sent', () => {
    expect(thumbProgress(0, null)).toBeNull()
  })

  it('fills the row left to right, one file at a time', () => {
    const active = { index: 1, progress: { phase: 'uploading', fraction: 0.4 } as const }
    expect(thumbProgress(0, active)).toEqual({ phase: 'sending', fraction: 1 })
    expect(thumbProgress(1, active)).toBe(active.progress)
    expect(thumbProgress(2, active)).toBeNull()
  })
})
