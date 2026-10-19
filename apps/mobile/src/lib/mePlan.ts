import type { BadgeKind } from '@langx/shared'
import { PARTNER_HUES, type PartnerHue } from './theme/tokens'

/*
 * The decisions behind the redesign's Me tab, away from React so they can be
 * tested — the same split `homePlan.ts` makes for Home. The screen is
 * `src/screens/MeScreenV3.tsx`.
 */

/** The first week's four steps, in the order the list draws them. */
export const FIRST_WEEK_STEPS = ['hello', 'correction', 'echo', 'invite'] as const
export type FirstWeekStep = (typeof FIRST_WEEK_STEPS)[number]

/** As much of a chat-list row as the hello step reads. */
export interface FirstWeekThread {
  lastMessage: { senderId: string }
  bothSpoke: boolean
  partner?: { displayName: string; official?: true } | undefined
}

export interface FirstWeekInput {
  meId: string
  /**
   * `/me/tokens`'s `firstWeek`. Absent past the first week — the server's
   * call, so every phone agrees with it — and from an API older than it.
   */
  firstWeek: { corrected: boolean } | undefined
  /** The chat list's first page: `undefined` while it loads, `[]` when it failed. */
  threads: readonly FirstWeekThread[] | undefined
  /** Echo cards held — `/echo/summary`'s `total`. */
  echoCards: number | undefined
  /** People who signed up with this account's invite — `/me/referrals`'s `totals.invited`. */
  invited: number | undefined
}

export interface FirstWeekPlan {
  done: Readonly<Record<FirstWeekStep, boolean>>
  /** How many of the four are done. Under `FIRST_WEEK_STEPS.length`, or there is no plan. */
  count: number
  /** Who the hello went to, for "you said hello to Yuki". */
  helloTo?: string
}

/**
 * The first week's checklist; `null` when Me shows its numbers instead; and
 * `undefined` while one of the four sources is still on its way.
 *
 * `null` past the first week, and once all four are done: a finished list
 * has nothing left to ask, and by then there are numbers to show. Waiting
 * rather than drawing what has arrived, so a tick does not land on a step a
 * moment after the list did — a source that failed is passed in as empty and
 * reads as not done, which is the honest default for a step nobody can see.
 *
 * **Said hello** is a thread this person has written in: they spoke last, or
 * both have spoken, so a reply to somebody else's hello counts and a hello
 * still unanswered does too. The @langx welcome does not — answering the app
 * is not saying hello to a person.
 */
export function planFirstWeek(input: FirstWeekInput): FirstWeekPlan | null | undefined {
  if (!input.firstWeek) return null
  const { threads, echoCards, invited } = input
  if (threads === undefined || echoCards === undefined || invited === undefined) return undefined

  const hello = threads.find(
    (thread) =>
      thread.partner?.official !== true &&
      (thread.bothSpoke || thread.lastMessage.senderId === input.meId),
  )
  const done: Record<FirstWeekStep, boolean> = {
    hello: hello !== undefined,
    correction: input.firstWeek.corrected,
    echo: echoCards > 0,
    invite: invited > 0,
  }
  const count = FIRST_WEEK_STEPS.filter((step) => done[step]).length
  if (count === FIRST_WEEK_STEPS.length) return null
  return {
    done,
    count,
    ...(hello?.partner ? { helloTo: hello.partner.displayName } : {}),
  }
}

/** What the next badge's card offers to do about it. */
export type NextBadgeAction = 'correct' | 'write'

/**
 * The button on the next badge's card, or `null` for a badge nothing done
 * today brings closer by a press: a streak badge counts the longest run,
 * which showing up holds; a member-for badge counts days; the cohort badge
 * cannot be worked towards at all. Tokens are earned by talking, so the
 * tokens badge is the same button as the messages one.
 */
export function nextBadgeAction(kind: BadgeKind): NextBadgeAction | null {
  switch (kind) {
    case 'correction':
      return 'correct'
    case 'messages':
    case 'tokens':
      return 'write'
    case 'streak':
    case 'veteran':
    case 'origin':
      return null
  }
}

/**
 * Whether the row of numbers is worth drawing: not when every one of them
 * has arrived as a zero. A row of three zeros is the page of zeros a quiet
 * account must not be shown; one zero beside two real numbers is a number
 * like the others. Anything still loading or missing keeps the row, which is
 * then a skeleton or a dash until it is not.
 */
export function showStats(values: readonly (number | undefined)[]): boolean {
  return !values.every((value) => value === 0)
}

/**
 * The hues for the screen's colour blocks, in the order asked for, with the
 * person's own hue swapped out wherever it was asked for.
 *
 * The hero is drawn in the person's hue, and a block under it in the same
 * colour reads as part of it — Marina is aqua, and an aqua "Posts" tile
 * looked like the bottom of her header. Each clash takes the first of the
 * six that is neither the person's nor already on the screen, so the blocks
 * stay distinct from each other as well as from the hero.
 */
export function blockHues(own: PartnerHue, wanted: readonly PartnerHue[]): PartnerHue[] {
  const spare = PARTNER_HUES.filter((hue) => hue !== own && !wanted.includes(hue))
  return wanted.map((hue) => (hue === own ? (spare.shift() ?? hue) : hue))
}
