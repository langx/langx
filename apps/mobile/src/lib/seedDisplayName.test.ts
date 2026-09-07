import { describe, expect, it } from 'vitest'
import { displayNameToSeed, nameFromEmail } from './seedDisplayName'

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

describe('nameFromEmail', () => {
  it('capitalises the words of the local part', () => {
    expect(nameFromEmail('alex.m94@example.com')).toBe('Alex M')
  })

  it('treats underscores, pluses and hyphens as word breaks', () => {
    expect(nameFromEmail('emily_rose+langx@example.com')).toBe('Emily Rose Langx')
  })

  it('drops digits', () => {
    expect(nameFromEmail('yuki2026@example.com')).toBe('Yuki')
  })

  it('falls back to the bare local part when only digits are left', () => {
    expect(nameFromEmail('12345@example.com')).toBe('12345')
  })

  it('ignores surrounding whitespace', () => {
    expect(nameFromEmail('  sam@example.com ')).toBe('Sam')
  })
})
