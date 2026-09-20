import { z } from 'zod'
import { TOKEN_RULES } from './token'

/**
 * Badges are **derived**, never stored.
 *
 * Everything one could assert is already a fact the ledger or the profile
 * holds: a 30-day streak is `streak.longest >= 30`, a thousand corrections is a
 * count of `correction` rows. A `badges` collection would be a second copy of
 * those numbers, written from a different code path, and the first time the two
 * disagreed the badge would be the one lying.
 *
 * The catalogue is config for the same reason `TOKEN_RULES` is: the thresholds
 * are product decisions, and the streak ones are not even decisions made here —
 * they are read straight off the milestones that pay out, so a badge can never
 * appear for a streak length the economy does not recognise.
 */
export const BADGE_KINDS = [
  'streak',
  'correction',
  'messages',
  'tokens',
  'veteran',
  'origin',
] as const
export type BadgeKind = (typeof BADGE_KINDS)[number]

/**
 * What a kind *is*, which decides the two things the arithmetic cannot.
 *
 * `counter` is the shape every kind had until `origin`: a number that only
 * goes up, with thresholds along it, so "99 of the way to 100" is a sentence
 * somebody can act on. `cohort` is a fact about who somebody is — you were in
 * v1 or you were not. There is no scale, so there is no progress to draw and
 * no "one more" to offer, and a cohort badge that is not yours is dropped from
 * the catalogue rather than sent locked.
 *
 * A `Record` for the same reason `progress` is one in `getBadgeSummary`: a
 * kind added to `BADGE_KINDS` does not compile until somebody has said which
 * of the two it is. Nothing else would fail — a cohort badge measured as a
 * counter simply sits at the bottom of `next` forever, offering a badge nobody
 * can go and earn.
 */
export const BADGE_SHAPES: Record<BadgeKind, 'counter' | 'cohort'> = {
  streak: 'counter',
  correction: 'counter',
  messages: 'counter',
  tokens: 'counter',
  veteran: 'counter',
  origin: 'cohort',
}

export function isCohortBadge(kind: BadgeKind): boolean {
  return BADGE_SHAPES[kind] === 'cohort'
}

/**
 * Every kind has to be **monotonic** — a number that can only go up.
 *
 * That is not a style rule, it is what makes a badge a badge: `streak` reads
 * `longest` rather than `current` precisely so a broken streak does not take
 * one away. It is also why followers and banked freezes are not kinds here,
 * tempting as they are: both go down, and an achievement that can be revoked
 * is not an achievement.
 *
 * A `cohort` kind meets the rule the only way a boolean can — it goes 0 to 1
 * once and never back — and meets it more firmly than the counters do: the v1
 * cohort is closed, so `origin` cannot be taken away by definition rather than
 * by care. See `BADGE_SHAPES`.
 */
export interface BadgeDefinition {
  id: string
  kind: BadgeKind
  /**
   * What the kind counts: days for `streak` and `veteran`, corrections
   * written, messages sent, tokens ever earned.
   */
  threshold: number
  label: string
  /**
   * Glyph name, Feather by default — `mci:` in front means
   * MaterialCommunityIcons instead, for the two marks Feather has no glyph
   * for (a sprout and a coin in a hand).
   *
   * A prefix rather than a second field: the family is a property of the name,
   * not of the badge, and a `{ family, name }` pair for the sake of two
   * entries would be read at every call site to answer a question only the
   * grid asks. `badgeGlyph.test.ts` on the mobile side checks every name here
   * against the shipped glyph maps, so a typo is a failing test rather than an
   * empty circle.
   *
   * On the definition rather than switched on in the grid: the icon is a
   * property of the kind, and a `kind === 'streak' ? … : …` ternary silently
   * gave every new kind the correction tick. The streak used to be `null`
   * here and a "🔥" in the grid — the one emoji left in a column of glyphs,
   * and drawn differently on every platform.
   *
   * **The names themselves are frozen.** They travel in the API's DTO, so the
   * app reading one is not always the app this file shipped with: the day the
   * badges wore drawings instead, their names went in here, and every install
   * that had not taken the update asked a vector font for `candle` and got its
   * missing-glyph box — a profile full of question marks, on builds an
   * over-the-air update could not always reach. A new badge takes whichever of
   * these six is closest. Nothing new goes here, and nothing here changes.
   */
  icon: string
}

/**
 * Correction milestones. Unlike the streak ones these have no payout to be read
 * off, so they are written here — chosen as one, then roughly a decade apart, so
 * the next badge is always visible without ever being close.
 */
const CORRECTION_THRESHOLDS = [1, 10, 100, 1000, 5000, 10_000, 25_000] as const

/** Messages sent, lifetime. `profile.stats.messagesSent`, which only ever grows. */
const MESSAGE_THRESHOLDS = [100, 1000, 10_000, 50_000] as const

/**
 * Tokens **earned**, lifetime — the all-time aggregate, never the balance.
 * Spending is deliberately kept out of `tokenAggregates`, so buying a frame
 * cannot cost somebody a badge they already had.
 */
const TOKEN_THRESHOLDS = [10_000, 50_000, 250_000] as const

/**
 * Days since the account was created. One, two and three years.
 *
 * Loyalty rather than effort, and that is the point of having it beside
 * `streak.1095`: three years of turning up is reachable, three years without
 * missing a day is not, and the easy one is what stops the hard one reading as
 * decoration.
 */
const VETERAN_THRESHOLDS = [365, 730, 1095] as const

function correctionLabel(threshold: number): string {
  return threshold === 1 ? 'First correction' : `${threshold.toLocaleString('en-US')} corrections`
}

/**
 * The catalogue, in the order the badges screen draws it: **cohort badges
 * first, then the ladders.**
 *
 * A cohort badge is one row and the whole of its kind — there is no next rung
 * and no way to work towards it, so it is the only thing on that screen a
 * reader cannot act on. Buried between the eighth streak and the third token
 * total it reads as one more entry in a long list; at the top it reads as what
 * it is. The ladders below it lose nothing by being second: they are already
 * grouped, and a group announces itself.
 *
 * `badges.test.ts` holds the order, so appending a second cohort badge to the
 * bottom of this array fails rather than quietly sinking it.
 */
export const BADGES: readonly BadgeDefinition[] = [
  {
    /**
     * The one badge nobody new can ever earn: this account was opened by
     * `precreate-v1-users.ts` for somebody who was on LangX v1.
     *
     * The id names the fact and the label does the wording, as everywhere else
     * here — `Early Adopter` is what a reader sees, `origin.v1` is what the
     * notification, the inbox row and `notifiedBadgeIds` carry, and neither
     * moves if the other is reworded.
     *
     * A threshold of 1 is a boolean wearing a number, so the one `>=` in
     * `getBadgeSummary` still serves every kind.
     */
    id: 'origin.v1',
    kind: 'origin' as const,
    threshold: 1,
    label: 'Early Adopter',
    icon: 'mci:sprout',
  },
  ...Object.keys(TOKEN_RULES.streakMilestones)
    .map(Number)
    .sort((a, b) => a - b)
    .map((days) => ({
      id: `streak.${days}`,
      kind: 'streak' as const,
      threshold: days,
      label: `${days} days`,
      icon: 'zap',
    })),
  ...CORRECTION_THRESHOLDS.map((count) => ({
    id: `correction.${count}`,
    kind: 'correction' as const,
    threshold: count,
    label: correctionLabel(count),
    icon: 'check',
  })),
  ...MESSAGE_THRESHOLDS.map((count) => ({
    id: `messages.${count}`,
    kind: 'messages' as const,
    threshold: count,
    label: `${count.toLocaleString('en-US')} messages`,
    icon: 'message-square',
  })),
  ...TOKEN_THRESHOLDS.map((count) => ({
    id: `tokens.${count}`,
    kind: 'tokens' as const,
    threshold: count,
    label: `${count.toLocaleString('en-US')} tokens earned`,
    // Not Feather's `award`, which is a rosette — the same picture the badges
    // screen is already made of, and so a mark that says "badge" where it
    // should say "tokens".
    icon: 'mci:hand-coin',
  })),
  ...VETERAN_THRESHOLDS.map((days) => ({
    id: `veteran.${days}`,
    kind: 'veteran' as const,
    threshold: days,
    label: `${days} days a member`,
    icon: 'calendar',
  })),
]

export function findBadge(id: string): BadgeDefinition | undefined {
  return BADGES.find((badge) => badge.id === id)
}

export const earnedBadgeSchema = z.object({
  id: z.string(),
  kind: z.enum(BADGE_KINDS),
  threshold: z.number().int(),
  label: z.string(),
  icon: z.string().nullable(),
  earned: z.boolean(),
  /**
   * When it was earned, if that is knowable. A streak badge has the ledger row
   * that paid the milestone, and a veteran badge is `createdAt` plus its own
   * threshold. The counting kinds have no date at all: the count is a total,
   * and nothing records which correction was the thousandth.
   */
  earnedAt: z.string().nullable(),
})
export type EarnedBadge = z.infer<typeof earnedBadgeSchema>

/** `GET /me/badges`. */
export const badgeSummarySchema = z.object({
  badges: z.array(earnedBadgeSchema),
  earnedCount: z.number().int(),
  /**
   * The nearest unearned badge, or `null` when they are all earned. `current`
   * is where the user stands on that badge's own scale, so the client can draw
   * the bar without knowing which kind it is.
   *
   * "Nearest" is by fraction of the way there, not by position in `BADGES`.
   * Taking the first unearned entry was defensible with two kinds and is not
   * with five: it would offer a three-year streak to somebody one correction
   * short of a badge they could earn this afternoon.
   */
  next: z
    .object({
      id: z.string(),
      kind: z.enum(BADGE_KINDS),
      label: z.string(),
      current: z.number().int(),
      threshold: z.number().int(),
      reward: z.number().int(),
    })
    .nullable(),
})
export type BadgeSummary = z.infer<typeof badgeSummarySchema>

/**
 * `GET /profiles/:handle/badges` — somebody else's shelf.
 *
 * Earned badges only, and no `next`. A locked row and the fraction under it
 * are progress, and progress is a live reading of how many tokens, messages
 * and corrections that person has — numbers the profile publishes as lifetime
 * totals or not at all. What a stranger gets to read here is what was done,
 * which is what a badge is for.
 *
 * `total` is the catalogue this account is measured against, and it is not
 * always `BADGES.length`: a cohort badge nobody in that cohort can earn is
 * dropped from their list entirely. Sent rather than inferred from `badges`,
 * which now holds only the earned ones, so the header reads the same "3 of 25
 * earned" here as it does on your own page.
 */
export const publicBadgesSchema = z.object({
  badges: z.array(earnedBadgeSchema),
  earnedCount: z.number().int(),
  total: z.number().int(),
})
export type PublicBadges = z.infer<typeof publicBadgesSchema>

/** One mark on the profile's badge strip: enough to draw it, and nothing else. */
export const profileBadgeSchema = z.object({
  id: z.string(),
  kind: z.enum(BADGE_KINDS),
  icon: z.string().nullable(),
})
export type ProfileBadge = z.infer<typeof profileBadgeSchema>

/**
 * Newest first, as closely as the data allows.
 *
 * It does not allow much, and the reason is worth knowing before reading the
 * order this produces: only `streak` and `veteran` badges carry an `earnedAt`.
 * A streak milestone has the ledger row that paid it and a veteran badge is
 * arithmetic on the account's birthday; the counting kinds have no date at
 * all, because a total is not an event and nothing records which correction
 * was the thousandth. See `earnedBadgeSchema`.
 *
 * So the sort is in two halves. The dated badges go first, latest to earliest,
 * which is the real answer where there is one. The undated ones follow in
 * reverse catalogue order — and that is not a shrug: within a ladder the
 * catalogue climbs, so reversing it puts the top rung first, and the top rung
 * is by definition the most recently earned of its kind. Nobody is ever shown
 * their 7-day badge ahead of their 365-day one.
 *
 * What it cannot do is order two ladders against each other, or a ladder
 * against a dated badge. A correction badge earned this morning may sit behind
 * a streak badge from March. That is the ceiling of what is recorded, not a
 * choice — moving it would mean writing a date at the moment each counting
 * badge is crossed, which is a migration and a new write on a hot path.
 */
export function badgesMostRecentFirst(badges: readonly EarnedBadge[]): EarnedBadge[] {
  const rank = (id: string) => {
    const index = CATALOGUE_INDEX.get(id)
    // An id that is not in the catalogue sorts last rather than first: it is
    // a badge this build does not know, and guessing it is the newest thing
    // this person did is the wrong guess to make.
    return index ?? -1
  }

  return [...badges].sort((a, b) => {
    const at = a.earnedAt ? Date.parse(a.earnedAt) : Number.NaN
    const bt = b.earnedAt ? Date.parse(b.earnedAt) : Number.NaN
    const aDated = !Number.isNaN(at)
    const bDated = !Number.isNaN(bt)
    if (aDated && bDated) return bt - at
    // An unparseable date is treated as no date rather than as an epoch,
    // which would quietly promote a broken row to the front of the strip.
    if (aDated !== bDated) return aDated ? -1 : 1
    // The catalogue's index, not the caller's: reading the order off the input
    // array would make this correct only for callers who happened to pass the
    // badges in catalogue order, which is a precondition nothing states.
    return rank(b.id) - rank(a.id)
  })
}

/** `BADGES` by id, so the sort above does not scan the catalogue per compare. */
const CATALOGUE_INDEX = new Map(BADGES.map((badge, index) => [badge.id, index]))

/**
 * What the profile's badge strip draws: **the newest badge of each kind, and
 * no other.**
 *
 * A ladder's rungs all wear one mark — thirty days and a hundred days are the
 * same achievement at two sizes, which the badge page says on purpose (see
 * `BadgeGrid`) because the number beside each row is there to tell them
 * apart. The strip has no such number, so a climbed ladder arrived as three
 * identical circles in a row, and three identical circles say "streak" once
 * and then say it twice more.
 *
 * So the strip keeps one of each, and `badgesMostRecentFirst` decides which:
 * for a dated kind the latest, and for an undated ladder the top rung, which
 * is the same answer by a different route. Nothing is lost by dropping the
 * rest — the row is one button onto the badge page, where every rung is a
 * row of its own.
 *
 * The sort happens here rather than being asked of the caller. It is what
 * picks the survivor, so a caller who passed badges in catalogue order would
 * otherwise get the *first* rung of each ladder — the seven-day streak — and
 * get it silently.
 *
 * This is also what bounds the payload, which a count used to: there are six
 * kinds, so a member with forty badges ships six marks and a "+34".
 */
export function badgeStripMarks(badges: readonly EarnedBadge[]): EarnedBadge[] {
  const seen = new Set<BadgeKind>()
  return badgesMostRecentFirst(badges).filter((badge) => {
    if (seen.has(badge.kind)) return false
    seen.add(badge.kind)
    return true
  })
}
