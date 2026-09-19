import { COMMENT_TO_DM_RULES, commentAsksForLink } from '@langx/shared'
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
    const action = decideForComment(comment(), context())
    expect(action).toEqual({ kind: 'answerComment', commentId: 'c1', delayMs: 55_000 })
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
  const message = { kind: 'message' as const, senderId: 'them', text: 'READY' }

  it('delivers once they follow', () => {
    const action = decideForMessage(message, {
      follows: true,
      delivered: false,
      withinWindow: true,
    })
    expect(action).toEqual({ kind: 'deliver', recipientId: 'them' })
  })

  it('asks for the follow when there is none yet', () => {
    const action = decideForMessage(message, {
      follows: false,
      delivered: false,
      withinWindow: true,
    })
    expect(action).toEqual({
      kind: 'askToFollow',
      recipientId: 'them',
      recheckMs: COMMENT_TO_DM_RULES.followRecheckMs,
    })
  })

  it('acts on any reply, not only the word the private reply asked for', () => {
    // The consent that matters is that they wrote back at all; insisting on
    // an exact READY would drop everyone who typed "ready!" or their own
    // language's version of it.
    const action = decideForMessage(
      { ...message, text: 'evet lütfen' },
      {
        follows: true,
        delivered: false,
        withinWindow: true,
      },
    )
    expect(action).toMatchObject({ kind: 'deliver' })
  })

  it('sends nothing twice', () => {
    expect(
      decideForMessage(message, { follows: true, delivered: true, withinWindow: true }),
    ).toMatchObject({ kind: 'ignore' })
  })

  it('sends nothing outside the 24-hour window', () => {
    // Meta answers this call with a success the user never sees, which is the
    // failure mode worth having a test for.
    const action = decideForMessage(message, {
      follows: true,
      delivered: false,
      withinWindow: false,
    })
    expect(action.kind).toBe('ignore')
    expect(action.kind === 'ignore' && action.because).toContain('24-hour')
  })
})
