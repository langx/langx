import {
  ACTIVATION_RULES,
  COHORT_RETURN_DAYS,
  FIRST_MESSAGE_RULES,
  isActivated,
  isActivationSettled,
  isReturnMeasurable,
  localDayKey,
  shiftDayKey,
  weekStartKey,
  type AdminCohortRow,
  type AdminFirstMessageWeek,
  type AdminRate,
  type AdminRefusalKind,
  type CohortReturnDay,
} from '@langx/shared'

/**
 * The arithmetic behind the measurement screen, with no database in it.
 *
 * Everything that decides what a number *means* is here, so it can be tested
 * against a fixture a line long: who counts as returned, who is still too
 * recent to judge, what "unanswered" is. `measure.ts` fetches rows and hands
 * them over; nothing in this file knows a collection exists.
 */

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const WEEK_DAYS = 7

/** Someone who signed up: the one row of `profiles` the cohorts need. */
export interface CohortMember {
  id: string
  createdAt: Date
  /** IANA zone; their own calendar is the one "Day 7" is counted on. */
  timeZone: string
}

/**
 * A conversation between two people.
 *
 * `firstReplyAt` is the instant the person who did **not** open it first
 * wrote — the moment it became two-way — or `null` while nobody has answered.
 */
export interface Thread {
  participants: readonly string[]
  firstMessageAt: Date
  firstReplyAt: Date | null
}

/** The Mondays from `from` (a Monday) to `now`'s week, newest first. */
export function weekStartsFrom(from: Date, now: Date): string[] {
  const last = weekStartKey(now)
  const keys: string[] = []
  for (let key = weekStartKey(from); key <= last; key = shiftDayKey(key, WEEK_DAYS)) {
    keys.push(key)
  }
  return keys.reverse()
}

export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  // Even count: the mean of the two in the middle, so a median of two replies
  // is not secretly the slower of them.
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

// ─── Cohorts ──────────────────────────────────────────────────────────────

export interface ReturnLookup {
  n: CohortReturnDay
  /** The `streakDays` `_id` that proves they were there on that day. */
  id: string
}

/**
 * Which `streakDays` documents to ask for, per member — only for the days that
 * have fully passed on their own calendar and that the server was recording.
 *
 * Their own calendar, because that is the clock `streakDays` is keyed on: a
 * person who joined at 23:30 in Toronto joined on a different UTC day from the
 * one their streak calls day 0.
 */
export function planReturns(
  members: readonly CohortMember[],
  now: Date,
): Map<string, ReturnLookup[]> {
  const plan = new Map<string, ReturnLookup[]>()
  for (const member of members) {
    const signupDay = localDayKey(member.createdAt, member.timeZone)
    const today = localDayKey(now, member.timeZone)
    const lookups: ReturnLookup[] = []
    for (const n of COHORT_RETURN_DAYS) {
      if (isReturnMeasurable(signupDay, n, today)) {
        lookups.push({ n, id: `${member.id}:${shiftDayKey(signupDay, n)}` })
      }
    }
    plan.set(member.id, lookups)
  }
  return plan
}

/** Every instant a conversation became two-way, per person in it. */
export function twoWayInstants(threads: readonly Thread[]): Map<string, Date[]> {
  const byPerson = new Map<string, Date[]>()
  for (const thread of threads) {
    if (!thread.firstReplyAt) continue
    for (const person of thread.participants) {
      const list = byPerson.get(person) ?? []
      list.push(thread.firstReplyAt)
      byPerson.set(person, list)
    }
  }
  return byPerson
}

const emptyRate = (): AdminRate => ({ count: 0, of: 0 })

type CohortCounts = Omit<AdminCohortRow, 'weekStart'>

function emptyCohort(): CohortCounts {
  return {
    signedUp: 0,
    returned: { d1: emptyRate(), d7: emptyRate(), d30: emptyRate() },
    activated: emptyRate(),
  }
}

const RETURN_KEY = { 1: 'd1', 7: 'd7', 30: 'd30' } as const satisfies Record<
  CohortReturnDay,
  keyof AdminCohortRow['returned']
>

function addRate(into: AdminRate, from: AdminRate): void {
  into.count += from.count
  into.of += from.of
}

/**
 * One row per week, newest first, plus the total across them.
 *
 * Weeks with nobody in them are kept as zero rows rather than dropped: a week
 * with no sign-ups is a fact about acquisition, and a table that skipped it
 * would read as if the weeks on either side were adjacent.
 */
export function tallyCohorts(input: {
  weeks: readonly string[]
  members: readonly CohortMember[]
  plan: ReadonlyMap<string, readonly ReturnLookup[]>
  /** The `streakDays` ids that exist. */
  returned: ReadonlySet<string>
  twoWay: ReadonlyMap<string, readonly Date[]>
  now: Date
}): { rows: AdminCohortRow[]; totals: CohortCounts } {
  const rows = new Map(input.weeks.map((week) => [week, emptyCohort()]))

  for (const member of input.members) {
    const row = rows.get(weekStartKey(member.createdAt))
    // A member outside the weeks asked for: the read was wider than the table.
    if (!row) continue
    row.signedUp++

    for (const lookup of input.plan.get(member.id) ?? []) {
      const rate = row.returned[RETURN_KEY[lookup.n]]
      rate.of++
      if (input.returned.has(lookup.id)) rate.count++
    }

    // Only once the window has closed: before that, "not activated" is "not
    // yet", and counting it would drag every young cohort down.
    if (isActivationSettled(member.createdAt, input.now, ACTIVATION_RULES)) {
      row.activated.of++
      if (isActivated(member.createdAt, input.twoWay.get(member.id) ?? [], ACTIVATION_RULES)) {
        row.activated.count++
      }
    }
  }

  const totals = emptyCohort()
  for (const row of rows.values()) {
    totals.signedUp += row.signedUp
    addRate(totals.returned.d1, row.returned.d1)
    addRate(totals.returned.d7, row.returned.d7)
    addRate(totals.returned.d30, row.returned.d30)
    addRate(totals.activated, row.activated)
  }
  return {
    rows: input.weeks.map((weekStart) => ({
      weekStart,
      ...(rows.get(weekStart) ?? emptyCohort()),
    })),
    totals,
  }
}

// ─── First messages ───────────────────────────────────────────────────────

type FirstMessageCounts = Omit<AdminFirstMessageWeek, 'weekStart'>

function emptyFirstMessageWeek(): FirstMessageCounts {
  return {
    started: 0,
    settled: 0,
    unanswered: 0,
    neverAnswered: 0,
    medianReplyMinutes: null,
  }
}

/**
 * How first messages fare, per week they were sent.
 *
 * A first message is **settled** once the threshold has passed since it was
 * sent; only settled ones can be unanswered, because a message sent a minute
 * ago is not ignored, it is new. "Unanswered" includes the ones answered late:
 * the sender waited the whole day either way. `neverAnswered` is the part that
 * is still silent now.
 *
 * The median runs over the conversations that did get a reply, however late.
 * It is therefore a little optimistic for the newest weeks — the slow replies
 * have not happened yet — and the screen says so.
 */
export function tallyFirstMessages(input: {
  weeks: readonly string[]
  threads: readonly Thread[]
  now: Date
}): { rows: AdminFirstMessageWeek[]; totals: FirstMessageCounts } {
  const thresholdMs = FIRST_MESSAGE_RULES.unansweredAfterHours * HOUR_MS
  const rows = new Map(input.weeks.map((week) => [week, emptyFirstMessageWeek()]))
  const minutes = new Map<string, number[]>(input.weeks.map((week) => [week, []]))
  const allMinutes: number[] = []
  const totals = emptyFirstMessageWeek()

  for (const thread of input.threads) {
    const week = weekStartKey(thread.firstMessageAt)
    const row = rows.get(week)
    if (!row) continue

    const waited = thread.firstReplyAt
      ? Math.max(0, thread.firstReplyAt.getTime() - thread.firstMessageAt.getTime())
      : null
    const settled = input.now.getTime() - thread.firstMessageAt.getTime() >= thresholdMs

    for (const target of [row, totals]) {
      target.started++
      if (!settled) continue
      target.settled++
      if (waited === null) {
        target.unanswered++
        target.neverAnswered++
      } else if (waited > thresholdMs) {
        target.unanswered++
      }
    }
    if (waited !== null) {
      minutes.get(week)?.push(waited / MINUTE_MS)
      allMinutes.push(waited / MINUTE_MS)
    }
  }

  const rounded = (value: number | null) => (value === null ? null : Math.round(value))
  return {
    rows: input.weeks.map((weekStart) => ({
      weekStart,
      ...(rows.get(weekStart) ?? emptyFirstMessageWeek()),
      medianReplyMinutes: rounded(medianOf(minutes.get(weekStart) ?? [])),
    })),
    totals: { ...totals, medianReplyMinutes: rounded(medianOf(allMinutes)) },
  }
}

// ─── Refusals ─────────────────────────────────────────────────────────────

/** What was found on one profile: how many refusals, and the kinds that were kept. */
export interface RefusalRow {
  /** Refusals in the window — `quotaRefusals`, the list that has always existed. */
  total: number
  /** The kinds recorded for them — `quotaRefusalKinds`, which may be shorter. */
  kinds: readonly string[]
}

export const UNKNOWN_REFUSAL_KIND = 'unknown'

/**
 * Refusals per limit, and how many people each one reached.
 *
 * A refusal with no kind is one recorded before kinds were kept, so a profile
 * contributes `total - kinds` of them to "unknown" instead of the panel
 * guessing which limit it was. Most-refused first, with "unknown" last so it
 * reads as a footnote rather than as a limit.
 */
export function tallyRefusals(rows: readonly RefusalRow[]): AdminRefusalKind[] {
  const byKind = new Map<string, { refusals: number; people: number }>()
  const bump = (kind: string, n: number) => {
    const entry = byKind.get(kind) ?? { refusals: 0, people: 0 }
    entry.refusals += n
    entry.people += 1
    byKind.set(kind, entry)
  }

  for (const row of rows) {
    const perKind = new Map<string, number>()
    for (const kind of row.kinds) perKind.set(kind, (perKind.get(kind) ?? 0) + 1)
    for (const [kind, n] of perKind) bump(kind, n)
    const unknown = Math.max(0, row.total - row.kinds.length)
    if (unknown > 0) bump(UNKNOWN_REFUSAL_KIND, unknown)
  }

  return [...byKind]
    .map(([kind, entry]) => ({ kind, ...entry }))
    .sort((a, b) => {
      if (a.kind === UNKNOWN_REFUSAL_KIND) return 1
      if (b.kind === UNKNOWN_REFUSAL_KIND) return -1
      return b.refusals - a.refusals || a.kind.localeCompare(b.kind)
    })
}
