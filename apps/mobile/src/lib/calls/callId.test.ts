import { callIdSchema } from '@langx/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newCallId } from './callId'

describe('newCallId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is an id the server will accept', () => {
    expect(callIdSchema.safeParse(newCallId()).success).toBe(true)
  })

  /** Hermes has `getRandomValues` at best, and on an old build not even that. */
  it('builds one by hand where the runtime has no randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37 + 11) % 256
        return bytes
      },
    })
    const id = newCallId()
    expect(callIdSchema.safeParse(id).success).toBe(true)
    // Version 4, variant 1 — the two fields that make it a UUID a phone's
    // call screen will take.
    expect(id[14]).toBe('4')
    expect('89ab').toContain(id[19])
  })

  it('still answers with no crypto at all, and not with the same id twice', () => {
    vi.stubGlobal('crypto', undefined)
    const first = newCallId()
    expect(callIdSchema.safeParse(first).success).toBe(true)
    expect(newCallId()).not.toBe(first)
  })
})
