import { describe, expect, it } from 'vitest'
import { FORBIDDEN_PROPERTY_KEYS, sanitizeEventProperties } from './analyticsEvents'

describe('sanitizeEventProperties', () => {
  it('keeps primitives and null, and nothing else', () => {
    expect(
      sanitizeEventProperties({
        kind: 'text',
        reply: false,
        count: 3,
        feature: null,
        nested: { a: 1 },
        list: [1, 2],
        fn: () => 1,
        missing: undefined,
        nan: Number.NaN,
      }),
    ).toEqual({ kind: 'text', reply: false, count: 3, feature: null })
  })

  /**
   * The store declaration says bodies and personal details never reach
   * analytics. A spread of the wrong object is the way that promise would be
   * broken by accident, so the keys such an object would carry are dropped.
   */
  it('drops every forbidden key', () => {
    const properties: Record<string, unknown> = { kind: 'text' }
    for (const key of FORBIDDEN_PROPERTY_KEYS) properties[key] = 'leaked'
    expect(sanitizeEventProperties(properties)).toEqual({ kind: 'text' })
  })

  it('cuts a string that is far longer than any legitimate value', () => {
    const clean = sanitizeEventProperties({ note: 'x'.repeat(1000) })
    expect(clean.note).toHaveLength(200)
  })
})
