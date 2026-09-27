import { ERROR_CODES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'

describe('ApiError', () => {
  it('carries a reason into the body when one is given', () => {
    const error = new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That post is not asking', {
      reason: 'not_asked',
    })
    expect(error.statusCode).toBe(400)
    expect(error.toBody()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'That post is not asking',
      reason: 'not_asked',
    })
  })

  // Absent rather than `undefined`, so a body with nothing to add is the same
  // bytes it was before the field existed.
  it('leaves the reason out when there is none', () => {
    const body = new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found').toBody()
    expect(body).toEqual({ code: 'NOT_FOUND', message: 'Post not found' })
    expect('reason' in body).toBe(false)
  })
})
