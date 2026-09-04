import { describe, expect, it } from 'vitest'
import { handlesMatch } from './account'

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
