import { describe, expect, it } from 'vitest'
import { displayNameToSeed } from './seedDisplayName'

const base = { current: '', accountName: 'Emily', hydrated: true, alreadySeeded: false }

describe('displayNameToSeed', () => {
  it('offers the account name to an empty, hydrated draft', () => {
    expect(displayNameToSeed(base)).toBe('Emily')
  })

  it('waits for hydration, so a stored name is never overwritten', () => {
    expect(displayNameToSeed({ ...base, hydrated: false })).toBeNull()
  })

  it('leaves a draft that already has a name alone', () => {
    expect(displayNameToSeed({ ...base, current: 'Em' })).toBeNull()
  })

  it('treats a whitespace-only draft as empty', () => {
    expect(displayNameToSeed({ ...base, current: '   ' })).toBe('Emily')
  })

  it('does nothing when the account has no name', () => {
    expect(displayNameToSeed({ ...base, accountName: '   ' })).toBeNull()
  })

  it('does not run twice, so a cleared field stays cleared', () => {
    expect(displayNameToSeed({ ...base, alreadySeeded: true })).toBeNull()
  })

  it('trims what it offers', () => {
    expect(displayNameToSeed({ ...base, accountName: '  Emily  ' })).toBe('Emily')
  })
})
