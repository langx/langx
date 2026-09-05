import { describe, expect, it } from 'vitest'
import { RESERVED_HANDLES } from './reservedHandles'
import { TOKEN_GRANT_KINDS, TOKEN_KINDS, TOKEN_RULES, isGrantKind } from './token'
import { INVITE_QUERY_PARAM, inviteHandleFromUrl, inviteQrUrl, inviteUrl } from './referral'

describe('the invite link', () => {
  it('is a profile link with a marker, so every link already shared still works', () => {
    expect(inviteUrl('deniz')).toBe('https://app.langx.io/deniz?invite=1')
  })

  it('drops a leading @, the way profileUrl does', () => {
    expect(inviteUrl('@deniz')).toBe(inviteUrl('deniz'))
  })

  it('points the QR at the same marker the server branches on', () => {
    expect(inviteQrUrl('https://api.langx.io', 'deniz')).toBe(
      'https://api.langx.io/public/qr/deniz?invite=1',
    )
  })

  it('round-trips', () => {
    expect(inviteHandleFromUrl(inviteUrl('deniz'))).toBe('deniz')
  })
})

describe('inviteHandleFromUrl', () => {
  /**
   * "Share my profile" says nothing about referrals. Treating an unmarked
   * profile link as an invite would make copy that already shipped false, and
   * would attribute people who were never invited.
   */
  it('refuses an unmarked profile link', () => {
    expect(inviteHandleFromUrl('https://app.langx.io/deniz')).toBeNull()
    expect(inviteHandleFromUrl('https://app.langx.io/deniz?invite=0')).toBeNull()
    expect(inviteHandleFromUrl('https://app.langx.io/deniz?other=1')).toBeNull()
  })

  it('reads a custom-scheme deep link, where URL parsers disagree', () => {
    expect(inviteHandleFromUrl('langx://deniz?invite=1')).toBe('deniz')
    expect(inviteHandleFromUrl('langx:///deniz?invite=1')).toBe('deniz')
  })

  it('takes the marker among other parameters, and ignores a fragment', () => {
    expect(inviteHandleFromUrl('https://app.langx.io/deniz?utm=x&invite=1')).toBe('deniz')
    expect(inviteHandleFromUrl('https://app.langx.io/deniz?invite=1#top')).toBe('deniz')
  })

  it('lower-cases, because a handle is lower-case and a link is typed by hand', () => {
    expect(inviteHandleFromUrl('https://app.langx.io/DENIZ?invite=1')).toBe('deniz')
  })

  /**
   * Total by construction. This runs on a cold start from
   * `Linking.getInitialURL()`, where a throw is a launch that never finishes.
   */
  it('answers null for anything it does not recognise, and never throws', () => {
    for (const input of [
      null,
      undefined,
      '',
      'not a url',
      'https://app.langx.io/?invite=1',
      'https://app.langx.io/no!thandle?invite=1',
      'https://app.langx.io/ab?invite=1',
    ]) {
      expect(inviteHandleFromUrl(input), String(input)).toBeNull()
    }
  })

  /**
   * A reserved segment is a screen, not a person. `discover` cannot be a
   * handle, so a link to it is not an invite from anybody.
   */
  it('does not read a route as a referrer', () => {
    const handle = inviteHandleFromUrl(`https://app.langx.io/discover?${INVITE_QUERY_PARAM}=1`)
    expect(handle === null || RESERVED_HANDLES.has(handle)).toBe(true)
  })
})

describe('referral rules', () => {
  /** The number every piece of public copy quotes, kept true by arithmetic. */
  it('adds up to the figure the marketing quotes', () => {
    const { activation, subscription, maxPerInvitee } = TOKEN_RULES.referral
    expect(activation + subscription).toBe(maxPerInvitee)
  })

  /**
   * Reversing these two is exactly the edit a review misses: both are numbers
   * in the same block, and swapped they still add up.
   */
  it('pays more for a subscription than for an activation', () => {
    expect(TOKEN_RULES.referral.subscription).toBeGreaterThan(TOKEN_RULES.referral.activation)
  })

  /**
   * If either fell out of the grant list, the week and month tables would
   * start ranking invitations — which is the one thing the leaderboard is not
   * for. Nothing else would fail.
   */
  /** The invite page quotes one figure for the newcomer; this keeps it true. */
  it('starts an invited newcomer on the total the invite page quotes', () => {
    const { inviteeActivation, inviteeTotal } = TOKEN_RULES.referral
    expect(inviteeActivation).toBeGreaterThan(0)
    expect(TOKEN_RULES.signupBonus + inviteeActivation).toBe(inviteeTotal)
  })

  it('keeps all three kinds out of the weekly leaderboard', () => {
    for (const kind of ['referral', 'referralSubscription', 'referralWelcome'] as const) {
      expect(TOKEN_KINDS as readonly string[], kind).toContain(kind)
      expect(TOKEN_GRANT_KINDS as readonly string[], kind).toContain(kind)
      expect(isGrantKind(kind), kind).toBe(true)
    }
  })

  it('reserves the invite screen name, so nobody can own that link', () => {
    expect(RESERVED_HANDLES.has('invite')).toBe(true)
  })
})
