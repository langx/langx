import { CALL_END_REASONS, CALL_MEDIA, CALL_OUTCOMES, SUPPORTED_LOCALES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../../i18n/runtime'
import {
  callRowIcon,
  callRowLabel,
  callStatusKey,
  closingLine,
  formatCallDuration,
} from './callLabels'

describe('callRowLabel', () => {
  it('reads the same call differently from each side', () => {
    const missed = { media: 'audio', outcome: 'missed' } as const
    // The person who was called missed it; the person who called got no answer.
    expect(callRowLabel(missed, false)).toEqual({
      title: 'calls.row.missedVoice',
      detail: null,
      missed: true,
    })
    expect(callRowLabel(missed, true)).toEqual({
      title: 'calls.row.outgoingVoice',
      detail: 'calls.row.noAnswer',
      missed: false,
    })
  })

  it('never tells a caller they were turned down', () => {
    const declined = { media: 'video', outcome: 'declined' } as const
    expect(callRowLabel(declined, true).detail).toBe('calls.row.noAnswer')
    // The person who declined sees their own choice, which is theirs to see.
    expect(callRowLabel(declined, false)).toMatchObject({
      title: 'calls.row.incomingVideo',
      detail: 'calls.row.declined',
      missed: false,
    })
  })

  it('counts a call that came while they were busy as one they missed', () => {
    expect(callRowLabel({ media: 'audio', outcome: 'busy' }, false).missed).toBe(true)
    expect(callRowLabel({ media: 'audio', outcome: 'busy' }, true).detail).toBe(
      'calls.row.noAnswer',
    )
  })

  it('leaves a call both took to its duration', () => {
    expect(callRowLabel({ media: 'video', outcome: 'completed' }, true)).toEqual({
      title: 'calls.row.outgoingVideo',
      detail: null,
      missed: false,
    })
    expect(callRowLabel({ media: 'video', outcome: 'completed' }, false).title).toBe(
      'calls.row.incomingVideo',
    )
  })

  it('says so, to both, when it was answered and never connected', () => {
    for (const mine of [true, false]) {
      expect(callRowLabel({ media: 'audio', outcome: 'failed' }, mine).detail).toBe(
        'calls.row.failed',
      )
    }
  })

  /**
   * `translate` returns a missing key verbatim, so a label no catalogue
   * defines is the dotted path drawn in somebody's thread.
   */
  it('resolves to a real sentence for every outcome, side and language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const media of CALL_MEDIA) {
        for (const outcome of CALL_OUTCOMES) {
          for (const mine of [true, false]) {
            const label = callRowLabel({ media, outcome }, mine)
            expect(t(label.title), `${locale} ${label.title}`).not.toBe(label.title)
            if (label.detail) {
              expect(t(label.detail), `${locale} ${label.detail}`).not.toBe(label.detail)
            }
          }
        }
      }
    }
  })
})

describe('formatCallDuration', () => {
  it('reads like a call timer', () => {
    expect(formatCallDuration(0)).toBe('0:00')
    expect(formatCallDuration(7)).toBe('0:07')
    expect(formatCallDuration(192)).toBe('3:12')
    expect(formatCallDuration(3765)).toBe('1:02:45')
  })

  it('does not draw a negative or a fractional second', () => {
    expect(formatCallDuration(-5)).toBe('0:00')
    expect(formatCallDuration(59.9)).toBe('0:59')
  })
})

describe('closingLine', () => {
  it('has a sentence for every way a call can end, in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const reason of CALL_END_REASONS) {
        const key = closingLine({ kind: 'ended', reason })
        expect(t(key, { name: 'Sofia' }), `${locale} ${key}`).not.toBe(key)
      }
    }
  })

  it('words a refusal by what the server said, and by whose switch it was', () => {
    expect(closingLine({ kind: 'refused', code: 'CALL_BUSY' })).toBe('calls.busy')
    expect(closingLine({ kind: 'refused', code: 'CALLS_REFUSED', reason: 'you' })).toBe(
      'calls.refusedYou',
    )
    expect(closingLine({ kind: 'refused', code: 'CALLS_REFUSED', reason: 'them' })).toBe(
      'calls.refusedThem',
    )
    // Said about them when the server did not say whose: the safer reading.
    expect(closingLine({ kind: 'refused', code: 'CALLS_REFUSED' })).toBe('calls.refusedThem')
  })

  it('gives a refusal this build has never heard of a plain sentence, not its code', () => {
    expect(closingLine({ kind: 'refused', code: 'SOMETHING_NEW' })).toBe('calls.failed')
  })

  it('tells the caller "no answer" whether it rang out or was declined', () => {
    expect(closingLine({ kind: 'ended', reason: 'declined' })).toBe(
      closingLine({ kind: 'ended', reason: 'timeout' }),
    )
  })
})

describe('callRowIcon', () => {
  it('is the camera for every video call, whichever way it went', () => {
    for (const outcome of CALL_OUTCOMES) {
      expect(callRowIcon({ media: 'video', outcome }, true)).toBe('video')
      expect(callRowIcon({ media: 'video', outcome }, false)).toBe('video')
    }
  })

  it('points a voice call the way it went', () => {
    expect(callRowIcon({ media: 'audio', outcome: 'completed' }, true)).toBe('phone-outgoing')
    expect(callRowIcon({ media: 'audio', outcome: 'completed' }, false)).toBe('phone-incoming')
    expect(callRowIcon({ media: 'audio', outcome: 'declined' }, false)).toBe('phone-incoming')
  })

  /** Missed is the callee's word. The caller's own unanswered call is still an outgoing one. */
  it('crosses the arrow only for the person who missed it', () => {
    expect(callRowIcon({ media: 'audio', outcome: 'missed' }, false)).toBe('phone-missed')
    expect(callRowIcon({ media: 'audio', outcome: 'busy' }, false)).toBe('phone-missed')
    expect(callRowIcon({ media: 'audio', outcome: 'missed' }, true)).toBe('phone-outgoing')
  })
})

describe('callStatusKey', () => {
  const base = {
    media: 'audio',
    remoteRinging: false,
    reconnecting: false,
    closing: null,
  } as const

  it('names the kind of call that is coming in', () => {
    expect(callStatusKey({ ...base, phase: 'incoming' })).toBe('calls.incomingVoice')
    expect(callStatusKey({ ...base, phase: 'incoming', media: 'video' })).toBe(
      'calls.incomingVideo',
    )
  })

  /** "Ringing" is a claim about the other phone; it waits for that phone to make it. */
  it('says ringing only once their device said so', () => {
    expect(callStatusKey({ ...base, phase: 'outgoing' })).toBe('calls.calling')
    expect(callStatusKey({ ...base, phase: 'outgoing', remoteRinging: true })).toBe('calls.ringing')
  })

  it('hands the line to the clock once the call is up', () => {
    expect(callStatusKey({ ...base, phase: 'active' })).toBeNull()
    expect(callStatusKey({ ...base, phase: 'active', reconnecting: true })).toBe(
      'calls.reconnecting',
    )
  })

  it('keeps saying connecting while the first path is still being found', () => {
    expect(callStatusKey({ ...base, phase: 'connecting', reconnecting: true })).toBe(
      'calls.connecting',
    )
  })

  it('closes with the line for why it ended', () => {
    expect(
      callStatusKey({ ...base, phase: 'ended', closing: { kind: 'ended', reason: 'timeout' } }),
    ).toBe('calls.noAnswer')
    expect(
      callStatusKey({
        ...base,
        phase: 'ended',
        closing: { kind: 'refused', code: 'CALL_COOLDOWN' },
      }),
    ).toBe('calls.cooldown')
  })
})
