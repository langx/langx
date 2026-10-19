import { MEETING_SOON_MINUTES, streakSavable } from '@langx/shared'

/**
 * What Home leads with: the one next step, and the one yellow button on the
 * screen.
 *
 * Pure, and kept here rather than in the screen, because the order is the
 * whole design and the screen is only its drawing. Each kind names what it
 * needs to be drawn and nothing else; the screen looks the names and faces up
 * from the caches it already has.
 */
export type HomeHero =
  /** Somebody wrote last and is waiting on you. */
  | { kind: 'reply'; conversationId: string; partnerId: string }
  /** An agreed call starts within `MEETING_SOON_MINUTES`, or is on now. */
  | { kind: 'session'; conversationId: string; partnerId: string; startsAt: string }
  /**
   * Today has not counted yet and yesterday's run is still alive. `via` is
   * the quickest thing that would count: cards waiting in Echo, or a message.
   */
  | { kind: 'streak'; days: number; via: 'echo' | 'chats' }
  /** Cards are due in Echo. */
  | { kind: 'echo'; due: number }
  /** Nothing else is waiting: say hello to the first of today's people. */
  | { kind: 'hello'; personId: string }

/** The slice of a chat-list row this reads. */
export interface HomeThread {
  _id: string
  /** They spoke last, so the next move is the reader's. */
  unreplied: boolean
  archived: boolean
  partner?: {
    _id: string
    official?: true
    accountStatus: 'active' | 'suspended' | 'deleted'
  }
}

export interface HomeMeeting {
  conversationId: string
  withUserId: string
  startsAt: string
  durationMinutes: number
}

export interface HomeState {
  now: Date
  /** The reader's calendar day, `YYYY-MM-DD` — see `deviceDayKey`. */
  today: string
  /** The chat list's first page, newest first. Undefined until it arrives. */
  threads: readonly HomeThread[] | undefined
  meetings: readonly HomeMeeting[] | undefined
  streak: { current: number; lastQualifiedDay: string | null; qualifiedToday: boolean } | undefined
  /** Banked freezes, which keep a streak alive across one missed day. */
  freezes: number
  /** Cards due in Echo now. */
  echoDue: number | undefined
  /** Today's people, in Discover's order, already without anyone you talk to. */
  people: readonly { _id: string }[] | undefined
}

/**
 * The threads waiting on the reader, newest first.
 *
 * An archived thread is one somebody put away on purpose, and an official
 * account's thread is an announcement — neither is a person waiting for a
 * reply. A suspended or deleted partner cannot read one. A muted thread stays:
 * muting stops the buzzing, not the other person waiting.
 */
export function waitingThreads<T extends HomeThread>(threads: readonly T[]): T[] {
  return threads.filter(
    (thread) =>
      thread.unreplied &&
      !thread.archived &&
      thread.partner !== undefined &&
      thread.partner.official !== true &&
      thread.partner.accountStatus === 'active',
  )
}

/**
 * The agreed call that is near enough to be the next step: starting within
 * `MEETING_SOON_MINUTES`, or started and not yet over — the list is polled,
 * so a call that began a few minutes ago can still be in it.
 */
export function soonMeeting(meetings: readonly HomeMeeting[], now: Date): HomeMeeting | undefined {
  const at = now.getTime()
  return meetings.find((meeting) => {
    const starts = Date.parse(meeting.startsAt)
    const ends = starts + meeting.durationMinutes * 60_000
    return starts - at <= MEETING_SOON_MINUTES * 60_000 && ends > at
  })
}

/**
 * Whether today still has to count for the streak to live.
 *
 * Not "the number is above zero": nothing decays `current` the moment a day
 * is missed, so a run that broke last week still carries its number until the
 * nightly pass. `streakSavable` is the server's own test of "still alive", and
 * a streak that is beyond saving is not a reason to send anybody anywhere.
 */
export function streakNeedsToday(state: Pick<HomeState, 'streak' | 'freezes' | 'today'>): boolean {
  const streak = state.streak
  if (!streak || streak.qualifiedToday) return false
  return streakSavable(streak, state.freezes, state.today)
}

/**
 * The hero, in this order: a thread waiting on you → a call within the hour →
 * today's streak not yet earned → Echo cards due → say hello to today's
 * person.
 *
 * Someone waiting comes first because they are the one thing on the list
 * that is a person rather than a habit; the call next, because it has a clock
 * on it; then the streak, which also has one (midnight). Echo and a hello are
 * always there to be done and so go last.
 *
 * Three answers. A hero; `null` when none of the five has anything to say —
 * Home then has no hero, and the yellow moves to the card that owns it next;
 * and `undefined` while a step that could outrank the rest has not answered,
 * so the card does not open as "Review 12 cards" and turn into "Anna is
 * waiting" when the chat list lands. Only the steps above the one chosen are
 * waited for. A request that failed is passed as an empty answer, not as
 * `undefined`: a hero held back for a request that is not coming is a screen
 * with no next step at all.
 */
export function planHome(state: HomeState): HomeHero | null | undefined {
  if (state.threads === undefined) return undefined
  const waiting = waitingThreads(state.threads)[0]
  if (waiting?.partner) {
    return { kind: 'reply', conversationId: waiting._id, partnerId: waiting.partner._id }
  }

  if (state.meetings === undefined) return undefined
  const meeting = soonMeeting(state.meetings, state.now)
  if (meeting) {
    return {
      kind: 'session',
      conversationId: meeting.conversationId,
      partnerId: meeting.withUserId,
      startsAt: meeting.startsAt,
    }
  }

  // The streak step reads the due count too, to say which way is quickest.
  if (state.streak === undefined || state.echoDue === undefined) return undefined
  const due = state.echoDue
  if (streakNeedsToday(state)) {
    return { kind: 'streak', days: state.streak.current, via: due > 0 ? 'echo' : 'chats' }
  }

  if (due > 0) return { kind: 'echo', due }

  if (state.people === undefined) return undefined
  const person = state.people[0]
  return person ? { kind: 'hello', personId: person._id } : null
}

/**
 * The next streak milestone above `current`, from `TOKEN_RULES`'s table, or
 * null past the last one. Read from the table rather than restated, so the
 * strip on Home and the payout cannot disagree about where the next one is.
 */
export function nextStreakMilestone(
  current: number,
  milestones: Readonly<Record<number, number>>,
): { day: number; reward: number } | null {
  const days = Object.keys(milestones)
    .map(Number)
    .filter((day) => day > current)
    .sort((a, b) => a - b)
  const day = days[0]
  return day === undefined ? null : { day, reward: milestones[day] ?? 0 }
}

/** Which greeting the header uses, by the hour on the reader's clock. */
export type HomeGreeting = 'morning' | 'afternoon' | 'evening'

export function greetingFor(hour: number): HomeGreeting {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}
