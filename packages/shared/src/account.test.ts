import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_DELETION_NOTE_MAX,
  deleteAccountSchema,
  deletionRequestSchema,
  handlesMatch,
} from './account'

describe('handlesMatch', () => {
  it('accepts the handle exactly as it is stored', () => {
    expect(handlesMatch('sofia', 'sofia')).toBe(true)
  })

  it('accepts what people actually type', () => {
    // A leading `@` is what half the world types when asked for a handle, and
    // handles are stored lowercase, so neither is a reason to refuse.
    expect(handlesMatch('@sofia', 'sofia')).toBe(true)
    expect(handlesMatch('  Sofia ', 'sofia')).toBe(true)
    expect(handlesMatch('@@sofia', 'sofia')).toBe(true)
  })

  it('refuses anything else — this is the last gate before an account ends', () => {
    expect(handlesMatch('sofi', 'sofia')).toBe(false)
    expect(handlesMatch('sofia1', 'sofia')).toBe(false)
    expect(handlesMatch('so fia', 'sofia')).toBe(false)
    expect(handlesMatch('', 'sofia')).toBe(false)
    expect(handlesMatch('@', 'sofia')).toBe(false)
  })
})

describe('the optional answer to "why are you leaving?"', () => {
  it('is optional — an older build that sends only the confirmation still deletes', () => {
    expect(deleteAccountSchema.parse({ confirm: 'DELETE' })).toEqual({ confirm: 'DELETE' })
    expect(deletionRequestSchema.parse({ handle: 'sofia' })).toEqual({ handle: 'sofia' })
  })

  it('takes a reason from the list and a trimmed note', () => {
    expect(
      deleteAccountSchema.parse({ confirm: 'DELETE', reason: 'taking_a_break', note: '  soon ' }),
    ).toEqual({ confirm: 'DELETE', reason: 'taking_a_break', note: 'soon' })
  })

  it('treats an empty note as no note', () => {
    expect(deletionRequestSchema.parse({ handle: 'sofia', note: '   ' })).toEqual({
      handle: 'sofia',
    })
  })

  it('refuses a reason that is not on the list, and a note past the cap', () => {
    expect(deleteAccountSchema.safeParse({ confirm: 'DELETE', reason: 'meh' }).success).toBe(false)
    const long = 'a'.repeat(ACCOUNT_DELETION_NOTE_MAX + 1)
    expect(deleteAccountSchema.safeParse({ confirm: 'DELETE', note: long }).success).toBe(false)
  })
})
