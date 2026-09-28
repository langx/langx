import { describe, expect, it } from 'vitest'
import { deletionFeedbackPayload } from './deletionFeedback'

describe('deletionFeedbackPayload', () => {
  it('sends nothing when the step was skipped', () => {
    expect(deletionFeedbackPayload(null, '')).toEqual({})
    expect(deletionFeedbackPayload(null, '   \n ')).toEqual({})
  })

  it('sends what was answered, and only that', () => {
    expect(deletionFeedbackPayload('taking_a_break', '')).toEqual({ reason: 'taking_a_break' })
    expect(deletionFeedbackPayload(null, ' Too quiet. ')).toEqual({ note: 'Too quiet.' })
    expect(deletionFeedbackPayload('other', 'Moving on.')).toEqual({
      reason: 'other',
      note: 'Moving on.',
    })
  })
})
