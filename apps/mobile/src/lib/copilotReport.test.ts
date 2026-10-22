import { COPILOT_REPORT_MAX_ANSWER_CHARS, copilotReportRequestSchema } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  copilotAnswerText,
  copilotReportOffersQuestion,
  copilotReportRequest,
} from './copilotReport'

const check = {
  action: 'check',
  corrected: 'I have an apple.',
  changed: true,
  reason: 'An, before a vowel.',
} as const

describe('copilotAnswerText', () => {
  it('writes each answer as the card showed it', () => {
    expect(copilotAnswerText(check)).toBe('I have an apple.\nAn, before a vowel.')
    expect(
      copilotAnswerText({ action: 'check', corrected: 'Hi.', changed: false, reason: null }),
    ).toBe('Hi.\n(no change)')
    expect(
      copilotAnswerText({
        action: 'sayIt',
        options: [
          { text: 'Hola', gloss: 'casual' },
          { text: 'Buenas', gloss: '' },
        ],
      }),
    ).toBe('Hola — casual\nBuenas')
    expect(copilotAnswerText({ action: 'replyIdeas', ideas: ['Sure!', 'Why not?'] })).toBe(
      'Sure!\nWhy not?',
    )
    expect(copilotAnswerText({ action: 'explain', explanation: 'It means hello.' })).toBe(
      'It means hello.',
    )
  })
})

describe('copilotReportRequest', () => {
  it('sends the draft only when the box is ticked', () => {
    expect(copilotReportRequest(check, ' I have a apple. ', false)).toEqual({
      action: 'check',
      answer: 'I have an apple.\nAn, before a vowel.',
    })
    expect(copilotReportRequest(check, ' I have a apple. ', true)).toMatchObject({
      question: 'I have a apple.',
    })
  })

  it('never sends a question for Explain or Reply ideas, ticked or not', () => {
    const explain = { action: 'explain', explanation: 'It means hello.' } as const
    expect(copilotReportOffersQuestion(explain, 'merhaba')).toBe(false)
    expect(copilotReportRequest(explain, 'merhaba', true)).not.toHaveProperty('question')
    const ideas = { action: 'replyIdeas' as const, ideas: ['Sure!'] }
    expect(copilotReportOffersQuestion(ideas, '')).toBe(false)
  })

  it('always builds something the server accepts', () => {
    const long = { action: 'explain', explanation: 'a'.repeat(5000) } as const
    const request = copilotReportRequest(long, '', false)
    expect(request.answer).toHaveLength(COPILOT_REPORT_MAX_ANSWER_CHARS)
    expect(copilotReportRequestSchema.safeParse(request).success).toBe(true)
    expect(
      copilotReportRequestSchema.safeParse(copilotReportRequest(check, 'I have a apple.', true))
        .success,
    ).toBe(true)
  })
})
