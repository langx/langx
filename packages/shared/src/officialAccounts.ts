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

/**
 * Whether somebody can write to this account.
 *
 * Both are `false` today, so neither takes a message: the API refuses one and
 * the app draws no composer. `@langx` is a channel by design — it welcomes, it
 * announces, and a broadcast account that sometimes replies is a promise about
 * attention nobody can keep. `@copilot` is `false` only because it has not
 * opened yet.
 *
 * **This is the switch.** Everything behind `@copilot` is built, wired and
 * tested — the provider, the per-tier allowances, the daily budget, the
 * prompt, the tool. Opening it is this boolean and an `ANTHROPIC_API_KEY`;
 * without the key it answers that it cannot answer, which is why the flag and
 * the key are two decisions rather than one.
 *
 * A `Record`, so a third official account cannot be added without somebody
 * deciding which of the two kinds it is.
 */
export const OFFICIAL_WRITABLE: Record<OfficialHandle, boolean> = {
  langx: false,
  copilot: false,
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
  /**
   * Kept only so a caller can ask for the ceiling without a tier in hand;
   * **what a given account gets is `PLAN_LIMITS[tier].assistantRepliesPerDay`**,
   * which is the table every other per-tier number in this app lives in.
   *
   * The numbers there come from the price list rather than from a feeling
   * about fair use. A reply costs at most 1.64 cents — in Arabic, which is the
   * script that costs most, and see `historyCharsPerMessage` for why that
   * qualifier is load-bearing. So five a day is $2.46 a month, ten is $4.93
   * and fifteen is $7.40, and each sits under what its tier brings in. A flat
   * thirty put every account, paying or not, at $13.89.
   *
   * Rolling, not a calendar day: the allowance comes back through the morning
   * rather than all at once at a midnight in somebody else's timezone.
   */
  maxRepliesPerDay: 15,
  /**
   * Replies to **everybody**, in one UTC day — the ceiling that actually
   * bounds the bill, because the one above is per person and the number of
   * people is not bounded by anything.
   *
   * The arithmetic, at Sonnet 5 rates ($2 per million in, $10 out) and with
   * the two bounds below in force: about 4,500 tokens of input, of which the
   * cached prefix is most, and at most 1,024 of output — so **1.5 cents is
   * the most one reply can cost**, worked out in the script that costs most.
   * Five hundred of those is $8.20 a day and $246 a month. A ceiling, not an
   * estimate: an ordinary reply is a third of that, and an ordinary month of
   * somebody using the assistant is cents.
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
   *
   * Two hundred rather than four, because the budget is in **characters** and
   * the bill is in tokens, and the exchange rate between them is a property of
   * the script: roughly four characters to a token in English, three in
   * Turkish, two in Russian and Arabic. Four hundred held the per-person
   * ceiling under a subscription in English and broke it at $6.07 in Arabic —
   * which is the wrong way round, those being the readers this app exists
   * for. Two hundred holds it in every script we ship.
   */
  historyCharsPerMessage: 200,
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
