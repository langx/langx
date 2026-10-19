import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PLAN_TIERS, PRO_BENEFITS, isPaidTier, type PlanTier } from '@langx/shared'
import type { InfiniteData } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { ConversationDto } from '../api/queries'
import { PAYWALL_SOURCES } from './analyticsEvents'
import type { ConversationPageDto } from './conversationCache'
import { BENEFIT_COPY } from './paywallBenefits'
import {
  FIRST_REPLY_FRESH_MS,
  appIconTap,
  badgeSheetBenefits,
  badgeSheetEnd,
  firstReplyShownTo,
  isAnsweredFirstReply,
  noOtherTwoWayThread,
  showsFirstReplyCard,
  showsSeePlans,
  withFirstReplyShown,
} from './proRoads'

const ROOT = path.join(__dirname, '../../../..')

describe('the paywall source list', () => {
  it('declares every road once', () => {
    expect(new Set(PAYWALL_SOURCES).size).toBe(PAYWALL_SOURCES.length)
    for (const road of ['settings', 'app_icon', 'pro_badge', 'first_reply'] as const) {
      expect(PAYWALL_SOURCES.filter((source) => source === road)).toHaveLength(1)
    }
  })

  /*
   * A value PostHog receives that the event list does not explain is a road
   * nobody knows to read. The list in `docs/analytics.md` is what a dashboard
   * is built from, so it has to name every source the app can send.
   */
  it('is the list docs/analytics.md names', () => {
    const doc = readFileSync(path.join(ROOT, 'docs/analytics.md'), 'utf8')
    const note = doc.slice(doc.indexOf('- **`source`** on the paywall'))
    const named = note.slice(0, note.indexOf('\n- **'))
    for (const source of PAYWALL_SOURCES) expect(named).toContain(`\`${source}\``)
  })
})

/** Every plan an account can hold, as the roads see it. */
const HELD: readonly { tier: PlanTier; gift: boolean; label: string }[] = [
  { tier: 'free', gift: false, label: 'free' },
  { tier: 'pro', gift: false, label: 'paid or lifetime Pro' },
  { tier: 'pro', gift: true, label: 'a gift of Pro' },
]

describe('Pro is never sold to', () => {
  it.each(HELD)(
    '$label: Settings draws "See the plans" only where something is left to buy',
    (held) => {
      expect(showsSeePlans({ loaded: true, ...held })).toBe(held.tier === 'free' || held.gift)
    },
  )

  it('Settings draws nothing before the profile has loaded', () => {
    for (const held of HELD) expect(showsSeePlans({ loaded: false, ...held })).toBe(false)
  })

  it('an app-icon tile sells only to the free plan, and does nothing while loading', () => {
    expect(appIconTap({ loaded: true, tier: 'free' })).toBe('paywall')
    expect(appIconTap({ loaded: true, tier: 'pro' })).toBe('choose')
    for (const tier of PLAN_TIERS) expect(appIconTap({ loaded: false, tier })).toBe('wait')
  })

  it('the PRO badge sells only to a free account looking at somebody else', () => {
    for (const tier of PLAN_TIERS) {
      for (const loaded of [true, false]) {
        for (const guest of [true, false]) {
          for (const own of [true, false]) {
            const end = badgeSheetEnd({ loaded, tier, guest, own })
            const sells = loaded && !guest && !own && tier === 'free'
            expect(end === 'sell').toBe(sells)
            if (loaded && !guest && isPaidTier(tier)) expect(end).toBe('owned')
          }
        }
      }
    }
  })

  it('the first-reply card never shows for Pro or a guest, whatever else holds', () => {
    for (const tier of PLAN_TIERS) {
      for (const guest of [true, false]) {
        const shows = showsFirstReplyCard({
          viewer: { loaded: true, tier, guest },
          seen: false,
          partnerIsPerson: true,
          answeredFirstReply: true,
          firstTwoWay: true,
        })
        expect(shows).toBe(tier === 'free' && !guest)
      }
    }
  })
})

const NOW = Date.parse('2026-10-18T12:00:00Z')
const MINUTE = 60_000

/**
 * A thread, oldest message first: `m` is the viewer, `p` the partner, a
 * minute apart, the last of them `endedAgo` before now.
 */
function thread(spoken: string, { hasOlder = false, endedAgo = 0 } = {}) {
  const messages = [...spoken].map((who, i) => ({
    senderId: who === 'm' ? 'me' : 'them',
    createdAt: new Date(NOW - endedAgo - (spoken.length - 1 - i) * MINUTE).toISOString(),
  }))
  // The screen hands them over newest first.
  return { viewerId: 'me', messages: messages.reverse(), hasOlder, now: NOW }
}

describe('the first reply', () => {
  it('is a thread the viewer opened, answered after the partner wrote back', () => {
    expect(isAnsweredFirstReply(thread('mpm'))).toBe(true)
    expect(isAnsweredFirstReply(thread('mmppm'))).toBe(true)
  })

  it('waits until the reply has been answered', () => {
    expect(isAnsweredFirstReply(thread('mp'))).toBe(false)
    expect(isAnsweredFirstReply(thread('mpp'))).toBe(false)
  })

  it('is not a thread the partner opened, or one nobody answered', () => {
    expect(isAnsweredFirstReply(thread('pmp'))).toBe(false)
    expect(isAnsweredFirstReply(thread('pm'))).toBe(false)
    expect(isAnsweredFirstReply(thread('mmm'))).toBe(false)
    expect(isAnsweredFirstReply(thread(''))).toBe(false)
  })

  it('says nothing about a thread whose start is not loaded', () => {
    expect(isAnsweredFirstReply(thread('mpm', { hasOlder: true }))).toBe(false)
  })

  it('is news for a day after the answer', () => {
    const lately = FIRST_REPLY_FRESH_MS - MINUTE
    expect(isAnsweredFirstReply(thread('mpm', { endedAgo: lately }))).toBe(true)
  })

  /*
   * The build that carries the card reaches accounts whose one short exchange
   * happened long ago. Opening that thread again is not their first reply.
   */
  it('is not an old exchange opened again', () => {
    const long = FIRST_REPLY_FRESH_MS + MINUTE
    expect(isAnsweredFirstReply(thread('mpm', { endedAgo: long }))).toBe(false)
  })

  it('is dated by the first answer, not by whatever was said after it', () => {
    const earlier = thread('mpm', { endedAgo: 2 * FIRST_REPLY_FRESH_MS })
    const since = thread('pm')
    const messages = [...since.messages, ...earlier.messages]
    expect(isAnsweredFirstReply({ ...since, messages })).toBe(false)
  })

  it('reads an answer it cannot date as not recent', () => {
    const answered = thread('mpm')
    const messages = answered.messages.map((message, i) =>
      i === 0 ? { ...message, createdAt: 'not a date' } : message,
    )
    expect(isAnsweredFirstReply({ ...answered, messages })).toBe(false)
  })
})

function conversation(id: string, bothSpoke: boolean, official = false): ConversationDto {
  return {
    _id: id,
    participants: ['me', `${id}-partner`],
    lastMessage: { body: '', senderId: 'me', createdAt: '2026-10-18T12:00:00Z' },
    unread: 0,
    pinned: false,
    archived: false,
    muted: false,
    unreplied: false,
    bothSpoke,
    mediaLockedFor: 0,
    updatedAt: '2026-10-18T12:00:00Z',
    partner: {
      _id: `${id}-partner`,
      handle: id,
      displayName: id,
      isOnline: false,
      accountStatus: 'active',
      ...(official ? { official: true as const } : {}),
    },
  }
}

function list(
  items: ConversationDto[],
  nextCursor: string | null = null,
): InfiniteData<ConversationPageDto> {
  return { pages: [{ items, pinned: [], nextCursor }], pageParams: [''] }
}

describe('a first two-way thread', () => {
  it('is one with no other two-way thread beside it', () => {
    expect(
      noOtherTwoWayThread('a', list([conversation('a', true), conversation('b', false)])),
    ).toBe(true)
    expect(noOtherTwoWayThread('a', list([conversation('a', true), conversation('b', true)]))).toBe(
      false,
    )
  })

  it('does not count a thread with an official account', () => {
    expect(
      noOtherTwoWayThread(
        'a',
        list([conversation('a', true), conversation('copilot', true, true)]),
      ),
    ).toBe(true)
  })

  it('is unknown when the list is not loaded, or not loaded to its end', () => {
    expect(noOtherTwoWayThread('a', undefined)).toBeNull()
    expect(noOtherTwoWayThread('a', list([conversation('a', true)], 'more'))).toBeNull()
  })
})

describe('the first-reply card is shown at most once per account', () => {
  const eligible = {
    viewer: { loaded: true, tier: 'free' as const, guest: false },
    partnerIsPerson: true,
    answeredFirstReply: true,
    firstTwoWay: true,
  }

  it('shows only once the device has said it has not been shown', () => {
    expect(showsFirstReplyCard({ ...eligible, seen: false })).toBe(true)
    expect(showsFirstReplyCard({ ...eligible, seen: true })).toBe(false)
    expect(showsFirstReplyCard({ ...eligible, seen: null })).toBe(false)
  })

  it('remembers an account once it has been shown, and only that account', () => {
    const stored = withFirstReplyShown(null, 'a')
    expect(firstReplyShownTo(stored, 'a')).toBe(true)
    expect(firstReplyShownTo(stored, 'b')).toBe(false)
    expect(withFirstReplyShown(stored, 'a')).toEqual(['a'])
  })

  it('reads anything that is not a list of ids as nothing shown', () => {
    for (const stored of [null, undefined, '1', 1, { a: true }, [1, 2]]) {
      expect(firstReplyShownTo(stored, 'a')).toBe(false)
    }
  })

  it('keeps the newest accounts when the list is full', () => {
    let stored: string[] = []
    for (let i = 0; i < 30; i++) stored = withFirstReplyShown(stored, `account-${i}`)
    expect(stored).toHaveLength(20)
    expect(firstReplyShownTo(stored, 'account-29')).toBe(true)
    expect(firstReplyShownTo(stored, 'account-0')).toBe(false)
  })

  it('needs every other condition too', () => {
    expect(showsFirstReplyCard({ ...eligible, seen: false, partnerIsPerson: false })).toBe(false)
    expect(showsFirstReplyCard({ ...eligible, seen: false, answeredFirstReply: false })).toBe(false)
    expect(showsFirstReplyCard({ ...eligible, seen: false, firstTwoWay: null })).toBe(false)
    expect(showsFirstReplyCard({ ...eligible, seen: false, firstTwoWay: false })).toBe(false)
    expect(
      showsFirstReplyCard({
        ...eligible,
        seen: false,
        viewer: { ...eligible.viewer, loaded: false },
      }),
    ).toBe(false)
  })
})

describe('the "What\'s Pro?" sheet', () => {
  it('lists the paywall comparison lead and counts only shipped benefits after it', () => {
    const { rows, more } = badgeSheetBenefits()
    for (const benefit of rows) expect(BENEFIT_COPY[benefit].shipped).toBe(true)
    const rest = PRO_BENEFITS.filter((benefit) => !rows.includes(benefit))
    expect(more).toBe(rest.filter((benefit) => BENEFIT_COPY[benefit].shipped).length)
  })
})
