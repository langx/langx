/**
 * How promotional mail is paced. Both channels' marketing passes and the
 * campaign queue read these; nothing else does.
 */

/**
 * The fewest days between two pieces of marketing to the same person, on
 * either channel. The service kinds each have their own rhythm — a digest per
 * absence, a visit summary per week — but a person on the receiving end of
 * all the promotional ones at once experiences one sender, and this is that
 * sender's rate.
 */
export const MARKETING_MIN_GAP_DAYS = 7

/**
 * Where a campaign comes from, which is the consent it rests on.
 *
 *   consented  `promotions.email` is true on the profile.
 *   v1         those, plus every pre-created v1 row that has not said no —
 *              v1's sign-up took the consent and v2 has no record of it.
 *   all        plus everybody else with a verified address.
 *   v1deleted  the addresses v1's deleted accounts left behind, held in
 *              `v1DeletedContacts`; no account, so an unsubscribe forgets
 *              the address rather than switching anything off.
 */
export const CAMPAIGN_SOURCES = ['consented', 'v1', 'all', 'v1deleted'] as const
export type CampaignSource = (typeof CAMPAIGN_SOURCES)[number]

/**
 * How many campaign mails a day, by the campaign's age in days. The last
 * value holds from then on.
 *
 * A ramp rather than one burst, and not because of any quota: mailbox
 * providers rate a domain on what it did yesterday, and one that goes from
 * twenty mails a day to four thousand in an hour gets throttled — with the
 * penalty landing on the verification links as well as the campaign. Three
 * days for a few thousand people is the price of the transactional mail
 * still arriving.
 *
 * Raised twice on 11 September 2026, Behic's call both times, after the v1
 * campaign's first day went to Apple relay addresses that bounced and was
 * lost. The shape is what the ramp is for — each day twice the one before,
 * never a jump — and that is intact; the floor moved because the reasoning
 * above was written when the domain sent twenty mails a day and it had been
 * sending a few hundred for a fortnight by then.
 */
export const CAMPAIGN_WARMUP_PER_DAY = [1000, 2000, 4000, 8000] as const

/** The day's budget for a campaign that started `dayIndex` days ago. */
export function campaignDayBudget(dayIndex: number): number {
  const index = Math.max(0, Math.min(dayIndex, CAMPAIGN_WARMUP_PER_DAY.length - 1))
  return CAMPAIGN_WARMUP_PER_DAY[index] ?? 0
}

/**
 * The hours of the UTC day a campaign may go out in. Recipients of a
 * broadcast have no timezone on file — the v1 rows have no profile — so
 * this cannot be their clock; 08–20 UTC is daytime from Lisbon to Istanbul
 * and morning-to-afternoon across the Americas, which is most of the list.
 */
export const CAMPAIGN_SEND_WINDOW_UTC = { from: 8, to: 20 } as const

/**
 * The share of the day's remaining budget one scheduler tick may send, so
 * the budget is spread over the window rather than spent at its start.
 * `tickMinutes` is the scheduler's interval.
 */
export function campaignTickShare(now: Date, budgetLeftToday: number, tickMinutes: number): number {
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes()
  const windowEnd = CAMPAIGN_SEND_WINDOW_UTC.to * 60
  if (minute < CAMPAIGN_SEND_WINDOW_UTC.from * 60 || minute >= windowEnd) return 0
  const ticksLeft = Math.max(1, Math.ceil((windowEnd - minute) / tickMinutes))
  return Math.max(0, Math.ceil(budgetLeftToday / ticksLeft))
}
