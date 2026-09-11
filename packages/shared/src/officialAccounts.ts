/**
 * The accounts LangX itself speaks from.
 *
 * They are ordinary profile rows, not a message type: a conversation with
 * @langx has to look, sort, unread-count and translate exactly like a
 * conversation with a person, and every one of those behaviours already
 * exists for profiles. A parallel "system message" world would have to
 * re-earn all of it.
 *
 * The list lives here rather than in the API because the app needs the same
 * two names — the tick beside a display name and the avatar URL are drawn
 * client-side from what the server sends.
 */
export const OFFICIAL_HANDLES = ['langx', 'copilot'] as const
export type OfficialHandle = (typeof OFFICIAL_HANDLES)[number]

/**
 * A `Record`, not a field on the list above, so adding a handle does not
 * compile until somebody has decided what the account is called.
 */
export const OFFICIAL_DISPLAY_NAMES: Record<OfficialHandle, string> = {
  langx: 'LangX',
  copilot: 'Copilot',
}

export function isOfficialHandle(handle: string): handle is OfficialHandle {
  return (OFFICIAL_HANDLES as readonly string[]).includes(handle.trim().toLowerCase())
}

/**
 * What the assistant behind @langx is allowed to do per conversation.
 *
 * Config here for the same reason `PLAN_LIMITS` is: a threshold read at a
 * call site is a threshold that gets copied. `repliesPerDay` is a cost
 * ceiling — every reply is a paid model call — and `historyMessages` is how
 * much of the conversation it is shown, which is the other half of the same
 * bill.
 */
export const OFFICIAL_ASSISTANT = {
  /** Replies to one person, in one day. Stops a single conversation running up a bill. */
  repliesPerDay: 30,
  /**
   * Replies to **everybody**, in one UTC day — the ceiling that actually
   * bounds the bill, because the one above is per person and the number of
   * people is not bounded by anything.
   *
   * The arithmetic, at Sonnet rates ($2 per million in, $10 out) and with the
   * two bounds below in force: about 3,500 tokens of input and at most 1,024
   * of output, so **1.7 cents is the most one reply can cost**. Five hundred
   * of those is $8.60 a day, $260 a month — a ceiling, not an estimate, and an
   * ordinary reply is a fraction of it.
   *
   * Note what this is a ceiling on: replies, and therefore spend, only because
   * `historyCharsPerMessage` and `maxReplyTokens` make a reply's cost bounded.
   * Without those two a reply could carry ten thousand tokens of history and
   * four thousand of answer, and five hundred of *those* is nearer a thousand
   * dollars a month. A cap on the count of something whose price is unbounded
   * is not a cap on anything.
   */
  globalRepliesPerDay: 500,
  historyMessages: 20,
  /**
   * How much of an *older* message is shown. The newest one — the question
   * being answered — is never cut.
   *
   * A chat message may be 2,000 characters, so twenty of them is 40,000: ten
   * thousand tokens of input on a reply that answers the last one. This is the
   * difference between a ceiling on the count of replies and a ceiling on what
   * they cost, and the count was never the expensive part.
   */
  historyCharsPerMessage: 400,
  /**
   * Room for two or three sentences and the thinking behind them, and not much
   * more. Output is five times the price of input on every model here, so this
   * is the number that decides the bill — `max_tokens` is a hard stop the
   * model cannot exceed, unlike a request to be brief.
   */
  maxReplyTokens: 1024,
} as const

/**
 * Where the picture comes from. Served by the API rather than uploaded, so a
 * fresh database has the right face without anybody seeding one, and the
 * account cannot be left holding a link to storage that a self-host does not
 * have. Mirrors `generatedAvatarUrl`.
 */
export function officialAvatarUrl(apiBaseUrl: string, handle: OfficialHandle): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/public/avatar/official/${handle}`
}
