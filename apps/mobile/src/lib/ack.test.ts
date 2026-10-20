import { describe, expect, it } from 'vitest'
import { ACK_TIMEOUT, readAck } from './ack'

const award = {
  tokens: 10,
  streak: {
    current: 3,
    longest: 9,
    lastQualifiedDay: '2026-10-19',
    advanced: true,
    milestoneXp: 0,
    freezeUsed: false,
  },
  capped: false,
}

describe('readAck', () => {
  it('keeps the award the server sends beside data', () => {
    expect(readAck(null, { ok: true, data: { _id: 'm1' }, award })).toEqual({
      data: { _id: 'm1' },
      award,
    })
  })

  it('answers no award when there is none, as a retry is answered', () => {
    const acked = readAck(null, { ok: true, data: { _id: 'm1' } })
    expect(acked).toEqual({ data: { _id: 'm1' } })
    expect('award' in acked).toBe(false)
  })

  it('drops an award that does not parse rather than drawing it', () => {
    expect(readAck(null, { ok: true, data: 1, award: { tokens: -3 } })).toEqual({ data: 1 })
    expect(readAck(null, { ok: true, data: 1, award: 'ten' })).toEqual({ data: 1 })
  })

  it('rejects a timeout, or no answer, with the timeout code', () => {
    expect(() => readAck(new Error('timeout'), undefined)).toThrow(
      expect.objectContaining({ code: ACK_TIMEOUT }),
    )
    expect(() => readAck(null, undefined)).toThrow(expect.objectContaining({ code: ACK_TIMEOUT }))
  })

  it("rejects a refusal with the API's code and message", () => {
    expect(() =>
      readAck(null, { ok: false, error: { code: 'QUOTA_EXCEEDED', message: 'no more' } }),
    ).toThrow(expect.objectContaining({ code: 'QUOTA_EXCEEDED', message: 'no more' }))
  })
})
