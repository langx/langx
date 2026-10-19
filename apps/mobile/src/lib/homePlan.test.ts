import { MEETING_SOON_MINUTES, TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  greetingFor,
  nextStreakMilestone,
  planHome,
  soonMeeting,
  streakNeedsToday,
  waitingThreads,
  type HomeState,
  type HomeThread,
} from './homePlan'

const NOW = new Date('2026-10-18T17:00:00Z')
const TODAY = '2026-10-18'
const YESTERDAY = '2026-10-17'

function thread(id: string, over: Partial<HomeThread> = {}): HomeThread {
  return {
    _id: id,
    unreplied: false,
    archived: false,
    partner: { _id: `u-${id}`, accountStatus: 'active' },
    ...over,
  }
}

/** Everything answered and nothing to do: the state of a quiet evening. */
function quiet(over: Partial<HomeState> = {}): HomeState {
  return {
    now: NOW,
    today: TODAY,
    threads: [thread('a')],
    meetings: [],
    streak: { current: 4, lastQualifiedDay: TODAY, qualifiedToday: true },
    freezes: 0,
    echoDue: 0,
    people: [],
    ...over,
  }
}

function minutesFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString()
}

describe('planHome', () => {
  it('leads with a thread waiting on you, above everything else', () => {
    expect(
      planHome(
        quiet({
          threads: [thread('a'), thread('b', { unreplied: true })],
          meetings: [
            {
              conversationId: 'm',
              withUserId: 'x',
              startsAt: minutesFromNow(10),
              durationMinutes: 30,
            },
          ],
          streak: { current: 4, lastQualifiedDay: YESTERDAY, qualifiedToday: false },
          echoDue: 12,
          people: [{ _id: 'p1' }],
        }),
      ),
    ).toEqual({ kind: 'reply', conversationId: 'b', partnerId: 'u-b' })
  })

  it('takes the newest waiting thread — the list is newest first', () => {
    const plan = planHome(
      quiet({ threads: [thread('new', { unreplied: true }), thread('old', { unreplied: true })] }),
    )
    expect(plan).toMatchObject({ kind: 'reply', conversationId: 'new' })
  })

  it('puts a call within the hour second', () => {
    const plan = planHome(
      quiet({
        meetings: [
          {
            conversationId: 'm',
            withUserId: 'x',
            startsAt: minutesFromNow(45),
            durationMinutes: 30,
          },
        ],
        streak: { current: 4, lastQualifiedDay: YESTERDAY, qualifiedToday: false },
        echoDue: 3,
      }),
    )
    expect(plan).toEqual({
      kind: 'session',
      conversationId: 'm',
      partnerId: 'x',
      startsAt: minutesFromNow(45),
    })
  })

  it('then the streak, when today has not counted and yesterday did', () => {
    expect(
      planHome(
        quiet({ streak: { current: 9, lastQualifiedDay: YESTERDAY, qualifiedToday: false } }),
      ),
    ).toEqual({ kind: 'streak', days: 9, via: 'chats' })
  })

  it('sends the streak to Echo when cards are waiting, since a review counts', () => {
    expect(
      planHome(
        quiet({
          streak: { current: 9, lastQualifiedDay: YESTERDAY, qualifiedToday: false },
          echoDue: 5,
        }),
      ),
    ).toEqual({ kind: 'streak', days: 9, via: 'echo' })
  })

  it('then Echo cards due', () => {
    expect(planHome(quiet({ echoDue: 12, people: [{ _id: 'p1' }] }))).toEqual({
      kind: 'echo',
      due: 12,
    })
  })

  it('then a hello to the first of today’s people', () => {
    expect(planHome(quiet({ people: [{ _id: 'p1' }, { _id: 'p2' }] }))).toEqual({
      kind: 'hello',
      personId: 'p1',
    })
  })

  it('has no hero when nothing is waiting and nobody is suggested', () => {
    expect(planHome(quiet())).toBeNull()
  })

  it('a brand-new account, with no streak yet, is offered a hello', () => {
    expect(
      planHome(
        quiet({
          threads: [],
          streak: { current: 0, lastQualifiedDay: null, qualifiedToday: false },
          people: [{ _id: 'p1' }],
        }),
      ),
    ).toEqual({ kind: 'hello', personId: 'p1' })
  })

  describe('while answers are still coming', () => {
    it('waits for the chat list, which outranks everything', () => {
      expect(planHome(quiet({ threads: undefined, echoDue: 12 }))).toBeUndefined()
    })

    it('does not wait for a later step once an earlier one has chosen', () => {
      expect(
        planHome(
          quiet({
            threads: [thread('a', { unreplied: true })],
            meetings: undefined,
            streak: undefined,
            echoDue: undefined,
            people: undefined,
          }),
        ),
      ).toMatchObject({ kind: 'reply' })
    })

    it('waits for the meetings before the streak can lead', () => {
      expect(
        planHome(
          quiet({
            meetings: undefined,
            streak: { current: 9, lastQualifiedDay: YESTERDAY, qualifiedToday: false },
          }),
        ),
      ).toBeUndefined()
    })

    it('waits for the due count before choosing the streak’s way in', () => {
      expect(
        planHome(
          quiet({
            streak: { current: 9, lastQualifiedDay: YESTERDAY, qualifiedToday: false },
            echoDue: undefined,
          }),
        ),
      ).toBeUndefined()
    })

    it('waits for Discover only when a hello is all that is left', () => {
      expect(planHome(quiet({ people: undefined }))).toBeUndefined()
      expect(planHome(quiet({ people: undefined, echoDue: 2 }))).toEqual({ kind: 'echo', due: 2 })
    })
  })
})

describe('waitingThreads', () => {
  it('keeps only threads where they spoke last', () => {
    expect(
      waitingThreads([thread('a'), thread('b', { unreplied: true })]).map((t) => t._id),
    ).toEqual(['b'])
  })

  it('leaves out an archived thread, an official account and a gone partner', () => {
    const threads = [
      thread('archived', { unreplied: true, archived: true }),
      thread('official', {
        unreplied: true,
        partner: { _id: 'langx', official: true, accountStatus: 'active' },
      }),
      thread('suspended', {
        unreplied: true,
        partner: { _id: 's', accountStatus: 'suspended' },
      }),
      thread('deleted', { unreplied: true, partner: { _id: 'd', accountStatus: 'deleted' } }),
      { _id: 'unresolved', unreplied: true, archived: false },
    ]
    expect(waitingThreads(threads)).toEqual([])
  })
})

describe('soonMeeting', () => {
  const meeting = (minutes: number, durationMinutes = 30) => ({
    conversationId: `c${minutes}`,
    withUserId: 'x',
    startsAt: minutesFromNow(minutes),
    durationMinutes,
  })

  it('counts a call starting exactly at the window’s edge', () => {
    expect(soonMeeting([meeting(MEETING_SOON_MINUTES)], NOW)).toBeDefined()
  })

  it('leaves out a call further away than the window', () => {
    expect(soonMeeting([meeting(MEETING_SOON_MINUTES + 1)], NOW)).toBeUndefined()
  })

  it('keeps a call that has started and is not over', () => {
    expect(soonMeeting([meeting(-10, 30)], NOW)).toBeDefined()
  })

  it('drops a call that has ended', () => {
    expect(soonMeeting([meeting(-30, 30)], NOW)).toBeUndefined()
  })
})

describe('streakNeedsToday', () => {
  it('is false once today has counted', () => {
    expect(
      streakNeedsToday({
        today: TODAY,
        freezes: 0,
        streak: { current: 5, lastQualifiedDay: TODAY, qualifiedToday: true },
      }),
    ).toBe(false)
  })

  it('is false for a streak already beyond saving', () => {
    expect(
      streakNeedsToday({
        today: TODAY,
        freezes: 0,
        streak: { current: 5, lastQualifiedDay: '2026-10-15', qualifiedToday: false },
      }),
    ).toBe(false)
  })

  it('is true across one missed day when a freeze is banked', () => {
    expect(
      streakNeedsToday({
        today: TODAY,
        freezes: 1,
        streak: { current: 5, lastQualifiedDay: '2026-10-16', qualifiedToday: false },
      }),
    ).toBe(true)
  })

  it('is false before the first day ever counted', () => {
    expect(
      streakNeedsToday({
        today: TODAY,
        freezes: 0,
        streak: { current: 0, lastQualifiedDay: null, qualifiedToday: false },
      }),
    ).toBe(false)
  })
})

describe('nextStreakMilestone', () => {
  it('reads the next rung from the token rules', () => {
    const first = Math.min(...Object.keys(TOKEN_RULES.streakMilestones).map(Number))
    expect(nextStreakMilestone(0, TOKEN_RULES.streakMilestones)).toEqual({
      day: first,
      reward: TOKEN_RULES.streakMilestones[first],
    })
  })

  it('skips a rung already reached', () => {
    expect(nextStreakMilestone(7, { 7: 50, 30: 250 })).toEqual({ day: 30, reward: 250 })
  })

  it('is null past the last rung', () => {
    expect(nextStreakMilestone(40, { 7: 50, 30: 250 })).toBeNull()
  })
})

describe('greetingFor', () => {
  it('splits the day at five, noon and six', () => {
    expect(greetingFor(4)).toBe('evening')
    expect(greetingFor(5)).toBe('morning')
    expect(greetingFor(11)).toBe('morning')
    expect(greetingFor(12)).toBe('afternoon')
    expect(greetingFor(17)).toBe('afternoon')
    expect(greetingFor(18)).toBe('evening')
  })
})
