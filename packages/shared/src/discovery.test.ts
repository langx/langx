import { describe, expect, it } from 'vitest'
import { discoveryQuerySchema } from './discovery'

describe('discoveryQuerySchema', () => {
  it('defaults sort to recommended and limit to 20 when omitted', () => {
    const result = discoveryQuerySchema.parse({})
    expect(result).toMatchObject({ sort: 'recommended', limit: 20 })
  })

  it('coerces querystring limit/ageMin/ageMax into numbers', () => {
    const result = discoveryQuerySchema.parse({ limit: '5', ageMin: '20', ageMax: '30' })
    expect(result).toMatchObject({ limit: 5, ageMin: 20, ageMax: 30 })
  })

  it('rejects a limit above the page-size cap', () => {
    expect(discoveryQuerySchema.safeParse({ limit: '999' }).success).toBe(false)
  })

  it('rejects ageMin greater than ageMax', () => {
    const result = discoveryQuerySchema.safeParse({ ageMin: '40', ageMax: '30' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown language code for targetLanguage', () => {
    expect(discoveryQuerySchema.safeParse({ targetLanguage: 'xx' }).success).toBe(false)
  })

  it('rejects an unknown sort value', () => {
    expect(discoveryQuerySchema.safeParse({ sort: 'popular' }).success).toBe(false)
  })
})
