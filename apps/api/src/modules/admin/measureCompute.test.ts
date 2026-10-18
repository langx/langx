import { describe, expect, it } from 'vitest'
import {
  UNKNOWN_REFUSAL_KIND,
  medianOf,
  planReturns,
  tallyCohorts,
  tallyFirstMessages,
  tallyRefusals,
  twoWayInstants,
  weekStartsFrom,
  type CohortMember,
  type Thread,
} from './measureCompute'

const HOUR = 60 * 60 * 1000

/** A Wednesday, well after visits started being recorded. */
const NOW = new Date('2026-11-18T12:00:00Z')
const MONDAY_OF_NOW = '2026-11-16'

const at = (iso: string) => new Date(iso)
const hoursAfter = (base: Date, hours: number) => new Date(base.getTime() + hours * HOUR)

function member(id: string, createdAt: string, timeZone = 'UTC'): CohortMember {
  return { id, createdAt: at(createdAt), timeZone }
}

describe('weekStartsFrom', () => {
  it('lists the Mondays from the first to the current week, newest first', () => {
    expect(weekStartsFrom(at('2026-11-02T00:00:00Z'), NOW)).toEqual([
      '2026-11-16',
      '2026-11-09',
      '2026-11-02',
    ])
  })

  it('is one week when the window is this week', () => {
    expect(weekStartsFrom(at(`${MONDAY_OF_NOW}T00:00:00Z`), NOW)).toEqual([MONDAY_OF_NOW])
  })
})

describe('medianOf', () => {
  it('is null for nothing, the middle for an odd count and the mean of the middle two otherwise', () => {
    expect(medianOf([])).toBeNull()
    expect(medianOf([9, 1, 5])).toBe(5)
    expect(medianOf([4, 1, 3, 10])).toBe(3.5)
    expect(medianOf([7])).toBe(7)
  })
})

describe('which return days are asked for', () => {
  it('asks for a day only once it has fully passed', () => {
    // Joined three days ago: day 1 is over, 7 and 30 are not.
    const plan = planReturns([member('a', '2026-11-15T09:00:00Z')], NOW)
    expect(plan.get('a')).toEqual([{ n: 1, id: 'a:2026-11-16' }])
  })

  it('asks for all three once the thirtieth day is behind them', () => {
    const plan = planReturns([member('a', '2026-10-01T09:00:00Z')], NOW)
    expect(plan.get('a')?.map((lookup) => lookup.n)).toEqual([1, 7, 30])
    expect(plan.get('a')?.[2]?.id).toBe('a:2026-10-31')
  })

  it('counts days on the person’s own calendar, not UTC', () => {
    // 23:30 on the 10th in Toronto is already the 11th in UTC. Their streak
    // calls the 10th day 0, so day 1 is the 11th local and day 7 the 17th — a
    // UTC reading would look for the 12th and the 18th, which is still today.
    const plan = planReturns([member('a', '2026-11-11T04:30:00Z', 'America/Toronto')], NOW)
    expect(plan.get('a')).toEqual([
      { n: 1, id: 'a:2026-11-11' },
      { n: 7, id: 'a:2026-11-17' },
    ])
  })

  it('asks for nothing before visits were recorded', () => {
    const plan = planReturns([member('a', '2026-08-10T09:00:00Z')], NOW)
    expect(plan.get('a')?.map((lookup) => lookup.n)).toEqual([30])
  })

  it('falls back to UTC for a zone nobody can read', () => {
    const plan = planReturns([member('a', '2026-11-10T09:00:00Z', 'Not/AZone')], NOW)
    expect(plan.get('a')?.[0]?.id).toBe('a:2026-11-11')
  })
})

describe('twoWayInstants', () => {
  it('files a reply under both people and skips an unanswered thread', () => {
    const reply = at('2026-11-17T10:00:00Z')
    const byPerson = twoWayInstants([
      { participants: ['a', 'b'], firstMessageAt: at('2026-11-17T09:00:00Z'), firstReplyAt: reply },
      { participants: ['a', 'c'], firstMessageAt: at('2026-11-17T09:00:00Z'), firstReplyAt: null },
    ])
    expect(byPerson.get('a')).toEqual([reply])
    expect(byPerson.get('b')).toEqual([reply])
    expect(byPerson.has('c')).toBe(false)
  })
})

describe('tallyCohorts', () => {
  const weeks = ['2026-11-09', '2026-11-02']

  function run(members: CohortMember[], returned: string[], threads: Thread[] = []) {
    return tallyCohorts({
      weeks,
      members,
      plan: planReturns(members, NOW),
      returned: new Set(returned),
      twoWay: twoWayInstants(threads),
      now: NOW,
    })
  }

  it('counts who came back on the day, against who could have', () => {
    const members = [
      member('a', '2026-11-03T09:00:00Z'),
      member('b', '2026-11-04T09:00:00Z'),
      member('c', '2026-11-05T09:00:00Z'),
    ]
    const { rows, totals } = run(members, ['a:2026-11-04', 'b:2026-11-05', 'a:2026-11-10'])

    const week = rows.find((row) => row.weekStart === '2026-11-02')
    expect(week?.signedUp).toBe(3)
    expect(week?.returned.d1).toEqual({ count: 2, of: 3 })
    // Day 7 has passed for all three; only the first was back on it.
    expect(week?.returned.d7).toEqual({ count: 1, of: 3 })
    expect(week?.returned.d30).toEqual({ count: 0, of: 0 })
    expect(totals.returned.d1).toEqual({ count: 2, of: 3 })
  })

  it('leaves out of both sides anyone whose day has not finished', () => {
    // Joined this morning: day 1 is tomorrow, and the activation window is open.
    const members = [member('a', '2026-11-18T08:00:00Z')]
    const { rows } = tallyCohorts({
      weeks: [MONDAY_OF_NOW],
      members,
      plan: planReturns(members, NOW),
      returned: new Set(),
      twoWay: new Map(),
      now: NOW,
    })
    expect(rows[0]?.signedUp).toBe(1)
    expect(rows[0]?.returned.d1).toEqual({ count: 0, of: 0 })
    expect(rows[0]?.activated).toEqual({ count: 0, of: 0 })
  })

  it('keeps an empty week as a row of zeros', () => {
    const { rows } = run([], [])
    expect(rows.map((row) => row.weekStart)).toEqual(weeks)
    expect(rows.every((row) => row.signedUp === 0)).toBe(true)
  })

  it('does not count a member outside the weeks it was asked for', () => {
    const { totals } = run([member('old', '2026-09-01T09:00:00Z')], [])
    expect(totals.signedUp).toBe(0)
  })

  describe('activation', () => {
    const joined = '2026-11-03T09:00:00Z'
    const joinedAt = at(joined)
    const thread = (replyAfterHours: number | null, other = 'x'): Thread => ({
      participants: ['a', other],
      firstMessageAt: hoursAfter(joinedAt, 1),
      firstReplyAt: replyAfterHours === null ? null : hoursAfter(joinedAt, replyAfterHours),
    })

    it('needs two conversations that became two-way inside the window', () => {
      const { rows } = run([member('a', joined)], [], [thread(2, 'x'), thread(40, 'y')])
      expect(rows.find((row) => row.weekStart === '2026-11-02')?.activated).toEqual({
        count: 1,
        of: 1,
      })
    })

    it('does not count a conversation nobody answered, or one answered too late', () => {
      const { rows } = run(
        [member('a', joined)],
        [],
        [thread(2, 'x'), thread(null, 'y'), thread(80, 'z')],
      )
      expect(rows.find((row) => row.weekStart === '2026-11-02')?.activated).toEqual({
        count: 0,
        of: 1,
      })
    })

    it('leaves a member whose window is still open out of the rate', () => {
      const joinedYesterday = '2026-11-17T09:00:00Z'
      const result = tallyCohorts({
        weeks: [MONDAY_OF_NOW],
        members: [member('a', joinedYesterday)],
        plan: planReturns([member('a', joinedYesterday)], NOW),
        returned: new Set(),
        twoWay: new Map(),
        now: NOW,
      })
      expect(result.rows[0]?.activated).toEqual({ count: 0, of: 0 })
    })
  })
})

describe('tallyFirstMessages', () => {
  const weeks = [MONDAY_OF_NOW, '2026-11-09']
  const opened = at('2026-11-10T09:00:00Z')
  const thread = (replyAfterHours: number | null, firstMessageAt = opened): Thread => ({
    participants: ['a', 'b'],
    firstMessageAt,
    firstReplyAt: replyAfterHours === null ? null : hoursAfter(firstMessageAt, replyAfterHours),
  })

  it('counts a late reply as unanswered after a day, and only a silent thread as never answered', () => {
    const { rows, totals } = tallyFirstMessages({
      weeks,
      now: NOW,
      threads: [thread(2), thread(30), thread(null)],
    })
    const week = rows.find((row) => row.weekStart === '2026-11-09')
    expect(week).toMatchObject({ started: 3, settled: 3, unanswered: 2, neverAnswered: 1 })
    expect(totals).toMatchObject({ started: 3, settled: 3, unanswered: 2, neverAnswered: 1 })
  })

  it('does not judge a message that is not yet a day old', () => {
    const recent = hoursAfter(NOW, -3)
    const { rows } = tallyFirstMessages({ weeks, now: NOW, threads: [thread(null, recent)] })
    expect(rows.find((row) => row.weekStart === MONDAY_OF_NOW)).toMatchObject({
      started: 1,
      settled: 0,
      unanswered: 0,
      neverAnswered: 0,
    })
  })

  it('takes the median over the conversations that got a reply', () => {
    // Replies after 10, 30 and 90 minutes, and one that never came.
    const minutes = (m: number): Thread => ({
      participants: ['a', 'b'],
      firstMessageAt: opened,
      firstReplyAt: new Date(opened.getTime() + m * 60 * 1000),
    })
    const { rows, totals } = tallyFirstMessages({
      weeks,
      now: NOW,
      threads: [minutes(10), minutes(30), minutes(90), thread(null)],
    })
    expect(rows.find((row) => row.weekStart === '2026-11-09')?.medianReplyMinutes).toBe(30)
    expect(totals.medianReplyMinutes).toBe(30)
  })

  it('has no median where nobody replied, and ignores a thread outside the weeks', () => {
    const { rows, totals } = tallyFirstMessages({
      weeks,
      now: NOW,
      threads: [thread(null), thread(5, at('2026-09-01T09:00:00Z'))],
    })
    expect(rows.find((row) => row.weekStart === '2026-11-09')?.medianReplyMinutes).toBeNull()
    expect(totals.started).toBe(1)
  })
})

describe('tallyRefusals', () => {
  it('counts refusals and the people they reached, per limit', () => {
    const kinds = tallyRefusals([
      { total: 3, kinds: ['initiations', 'initiations', 'translations'] },
      { total: 1, kinds: ['initiations'] },
    ])
    expect(kinds).toEqual([
      { kind: 'initiations', refusals: 3, people: 2 },
      { kind: 'translations', refusals: 1, people: 1 },
    ])
  })

  it('calls a refusal with no kind unknown, and puts it last', () => {
    const kinds = tallyRefusals([
      // Five instants kept, one kind: four were recorded before kinds were.
      { total: 5, kinds: ['media'] },
      { total: 2, kinds: [] },
    ])
    expect(kinds.at(-1)).toEqual({ kind: UNKNOWN_REFUSAL_KIND, refusals: 6, people: 2 })
    expect(kinds[0]).toEqual({ kind: 'media', refusals: 1, people: 1 })
  })

  it('never reports a negative unknown when the kinds outnumber the instants', () => {
    expect(tallyRefusals([{ total: 1, kinds: ['media', 'media'] }])).toEqual([
      { kind: 'media', refusals: 2, people: 1 },
    ])
  })

  it('is empty when nobody was refused', () => {
    expect(tallyRefusals([])).toEqual([])
  })

  it('orders the most refused limit first, ties by name', () => {
    const kinds = tallyRefusals([
      { total: 2, kinds: ['transcripts', 'chatVoices'] },
      { total: 1, kinds: ['media'] },
      { total: 1, kinds: ['media'] },
    ])
    expect(kinds.map((entry) => entry.kind)).toEqual(['media', 'chatVoices', 'transcripts'])
  })
})
