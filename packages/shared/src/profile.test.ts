import { describe, expect, it } from 'vitest'
import { handleSchema } from './handle'
import { onboardingProfileSchema, updateProfileSchema } from './profile'

const NOW = new Date('2026-08-26T00:00:00Z')

describe('handle format', () => {
  it('accepts a normal handle and lowercases it', () => {
    expect(handleSchema.parse('Behic_01')).toBe('behic_01')
  })

  it('rejects too short, too long, and a leading digit', () => {
    expect(handleSchema.safeParse('ab').success).toBe(false)
    expect(handleSchema.safeParse('a'.repeat(21)).success).toBe(false)
    expect(handleSchema.safeParse('1abc').success).toBe(false)
  })

  it('rejects characters outside letters/digits/underscore', () => {
    expect(handleSchema.safeParse('be-hic').success).toBe(false)
    expect(handleSchema.safeParse('be hic').success).toBe(false)
  })
})

function baseOnboarding() {
  return {
    handle: 'newuser',
    displayName: 'New User',
    birthYear: 1995,
    gender: 'undisclosed' as const,
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'B1' as const, priority: 1 }],
  }
}

describe('onboardingProfileSchema', () => {
  it('accepts a minimal valid profile', () => {
    const result = onboardingProfileSchema.safeParse(baseOnboarding())
    expect(result.success).toBe(true)
  })

  it('rejects an underage birthYear — the real gate lives here, not just in age.ts', () => {
    const result = onboardingProfileSchema.safeParse({
      ...baseOnboarding(),
      birthYear: NOW.getUTCFullYear() - 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a learning language that is also listed as native', () => {
    const result = onboardingProfileSchema.safeParse({
      ...baseOnboarding(),
      nativeLanguages: [{ code: 'en' }],
      learning: [{ code: 'en', level: 'B1', priority: 1 }],
    })
    expect(result.success).toBe(false)
  })

  it('requires at least one native and one learning language', () => {
    expect(
      onboardingProfileSchema.safeParse({ ...baseOnboarding(), nativeLanguages: [] }).success,
    ).toBe(false)
    expect(onboardingProfileSchema.safeParse({ ...baseOnboarding(), learning: [] }).success).toBe(
      false,
    )
  })

  it('rejects an unknown language code', () => {
    const result = onboardingProfileSchema.safeParse({
      ...baseOnboarding(),
      nativeLanguages: [{ code: 'zz' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('accepts a partial update with just one field', () => {
    expect(updateProfileSchema.safeParse({ bio: 'hello' }).success).toBe(true)
  })

  it('rejects overlap only when both arrays are present together', () => {
    expect(
      updateProfileSchema.safeParse({
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'en', level: 'B1', priority: 1 }],
      }).success,
    ).toBe(false)

    // Updating just `learning` can't be checked without the stored profile —
    // that cross-check is the repository's job, not the schema's.
    expect(
      updateProfileSchema.safeParse({ learning: [{ code: 'en', level: 'B1', priority: 1 }] })
        .success,
    ).toBe(true)
  })

  it('does not accept a handle field at all — renaming is out of scope', () => {
    const result = updateProfileSchema.safeParse({ handle: 'newhandle', bio: 'hi' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('handle' in result.data).toBe(false)
    }
  })
})
