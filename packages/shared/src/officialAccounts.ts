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
   * 500 is arithmetic, not a feeling: a reply costs roughly half a cent at
   * Sonnet rates, so this is about $3 a day and under $100 a month in the
   * worst case. Raise it when the bill is worth paying; it is one number and
   * the app says the same thing to the 501st person it says to the 31st.
   */
  globalRepliesPerDay: 500,
  historyMessages: 20,
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
