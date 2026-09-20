import { COMMENT_TO_DM_PAYLOADS, COMMENT_TO_DM_RULES, commentAsksForLink } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { decideForComment, decideForMessage } from './flow'

const NOW = new Date('2026-09-17T12:00:00Z')

function comment(overrides: Partial<Parameters<typeof decideForComment>[0]> = {}) {
  return {
    kind: 'comment' as const,
    commentId: 'c1',
    text: 'LANGX please',
    fromId: 'visitor',
    ...overrides,
  }
}

function context(overrides: Partial<Parameters<typeof decideForComment>[1]> = {}) {
  return { seen: false, selfId: 'us', postedAt: NOW, now: NOW, random: () => 0.5, ...overrides }
}

describe('commentAsksForLink', () => {
  it('matches the keyword whatever case it is typed in', () => {
    expect(commentAsksForLink('LangX!!')).toBe(true)
    expect(commentAsksForLink('send me the LINK 🙏')).toBe(true)
  })

  it('matches whole words only', () => {
    // Otherwise "linkedin", "blinking" and half the comments under any post
    // would each earn a DM.
    expect(commentAsksForLink('following you on linkedin')).toBe(false)
    expect(commentAsksForLink('langxx')).toBe(false)
  })
})

describe('decideForComment', () => {
  it('answers a comment asking for the link', () => {
    // Derived, not written down: the range is config, and a literal here
    // turns tuning it into a failing test that says nothing is wrong.
    const { min, max } = COMMENT_TO_DM_RULES.replyDelayMs
    const action = decideForComment(comment(), context())
    expect(action).toEqual({
      kind: 'answerComment',
      commentId: 'c1',
      delayMs: min + (max - min) / 2,
    })
  })

  it('waits somewhere inside the configured range', () => {
    const { min, max } = COMMENT_TO_DM_RULES.replyDelayMs
    const soonest = decideForComment(comment(), context({ random: () => 0 }))
    const latest = decideForComment(comment(), context({ random: () => 1 }))
    expect(soonest).toMatchObject({ delayMs: min })
    expect(latest).toMatchObject({ delayMs: max })
  })

  it('ignores a comment it has already answered', () => {
    // The platform allows one private reply per comment, so a retried webhook
    // must not spend a second attempt at it.
    expect(decideForComment(comment(), context({ seen: true }))).toMatchObject({ kind: 'ignore' })
  })

  it('ignores its own comments', () => {
    expect(decideForComment(comment({ fromId: 'us' }), context())).toMatchObject({ kind: 'ignore' })
  })

  it('ignores a comment without the keyword', () => {
    expect(decideForComment(comment({ text: 'nice video' }), context())).toMatchObject({
      kind: 'ignore',
    })
  })

  it('ignores a comment past the private reply window', () => {
    const postedAt = new Date(NOW.getTime() - COMMENT_TO_DM_RULES.privateReplyWindowMs - 1000)
    const action = decideForComment(comment(), context({ postedAt }))
    expect(action.kind).toBe('ignore')
    expect(action.kind === 'ignore' && action.because).toContain('7-day')
  })
})

describe('decideForMessage', () => {
  const ASKED_AT = new Date('2026-09-19T20:00:00Z')
  const AFTER = new Date(ASKED_AT.getTime() + 5_000)
  const message = { kind: 'message' as const, senderId: 'them', text: 'READY', at: AFTER }
  /** Following, nothing sent yet, inside the window, never asked anything. */
  const fresh = { follows: true, delivered: false, withinWindow: true, followAsks: 0 }

  it('asks which phone they are on before handing anything over', () => {
    expect(decideForMessage(message, fresh)).toEqual({ kind: 'askPlatform', recipientId: 'them' })
  })

  it('delivers once the question has been asked and answered', () => {
    const action = decideForMessage(message, { ...fresh, platformAskedAt: ASKED_AT })
    expect(action).toEqual({ kind: 'deliver', recipientId: 'them' })
  })

  it('ignores the copy of the tap that prompted the question', () => {
    // One tap reaches us twice — the button press and the message the button
    // leaves in the thread. Both carry the time of the tap, which is before
    // the question they caused. Without this the second copy answers the
    // question nobody has seen yet, and the link goes out unchosen.
    const tap = { ...message, at: new Date(ASKED_AT.getTime() - 8_000) }
    const action = decideForMessage(tap, { ...fresh, platformAskedAt: ASKED_AT })
    expect(action.kind).toBe('ignore')
  })

  it('records which button they tapped, without it changing the link', () => {
    // Both answers send the same URL. The answer is kept because it is the
    // only read we get on whether Instagram sends us iOS or Android people.
    const action = decideForMessage(
      { ...message, text: COMMENT_TO_DM_PAYLOADS.android },
      { ...fresh, platformAskedAt: ASKED_AT },
    )
    expect(action).toEqual({ kind: 'deliver', recipientId: 'them', platform: 'android' })
  })

  it('delivers anyway when they typed instead of tapping', () => {
    // The question was a beat, never a gate.
    const action = decideForMessage(
      { ...message, text: 'iphone i guess' },
      { ...fresh, platformAskedAt: ASKED_AT },
    )
    expect(action).toEqual({ kind: 'deliver', recipientId: 'them' })
  })

  it('asks for the follow when there is none yet', () => {
    const action = decideForMessage(message, { ...fresh, follows: false })
    expect(action).toEqual({
      kind: 'askToFollow',
      recipientId: 'them',
      recheckMs: COMMENT_TO_DM_RULES.followRecheckMs,
    })
  })

  it('stops asking, and sends the link, once it has asked enough times', () => {
    // The gate is worth having and it is not worth losing somebody over:
    // whoever has tapped this many times either cannot follow or has and
    // Instagram will not say so.
    const action = decideForMessage(message, {
      ...fresh,
      follows: false,
      followAsks: COMMENT_TO_DM_RULES.followAsksBeforeGivingUp,
    })
    expect(action).toEqual({ kind: 'askPlatform', recipientId: 'them' })
  })

  it('keeps asking right up to the limit', () => {
    const action = decideForMessage(message, {
      ...fresh,
      follows: false,
      followAsks: COMMENT_TO_DM_RULES.followAsksBeforeGivingUp - 1,
    })
    expect(action).toMatchObject({ kind: 'askToFollow' })
  })

  it('acts on any reply, not only the word the private reply asked for', () => {
    // The consent that matters is that they wrote back at all; insisting on
    // an exact READY would drop everyone who typed "ready!" or their own
    // language's version of it.
    const action = decideForMessage(
      { ...message, text: 'evet lütfen' },
      { ...fresh, platformAskedAt: ASKED_AT },
    )
    expect(action).toMatchObject({ kind: 'deliver' })
  })

  it('sends nothing twice', () => {
    expect(
      decideForMessage(message, { ...fresh, delivered: true, platformAskedAt: ASKED_AT }),
    ).toMatchObject({ kind: 'ignore' })
  })

  it('sends nothing outside the 24-hour window', () => {
    // Meta answers this call with a success the user never sees, which is the
    // failure mode worth having a test for.
    const action = decideForMessage(message, {
      ...fresh,
      withinWindow: false,
      platformAskedAt: ASKED_AT,
    })
    expect(action.kind).toBe('ignore')
    expect(action.kind === 'ignore' && action.because).toContain('24-hour')
  })
})
