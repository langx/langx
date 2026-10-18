import { z } from 'zod'

/**
 * Copilot: three one-tap helps inside a chat, written by a model.
 *
 * - **Check** — your sentence, corrected if it needs it, with one reason.
 * - **Reply ideas** — a few short replies to the thread, at your level, for
 *   you to edit. Never sent by themselves.
 * - **Explain** — what a person's correction changed, and why. It explains
 *   the human's change; it never offers one of its own.
 *
 * Here is only what both sides must agree on: the actions, the shapes, and
 * the numbers that bound the bill. How an answer looks — blue, labelled
 * "AI · may be wrong", never the green a person's correction wears — is the
 * client's. See `docs/decisions.md` → _Copilot ships dark, behind two
 * switches and a consent_.
 */
export const COPILOT_ACTIONS = ['check', 'replyIdeas', 'explain'] as const
export type CopilotAction = (typeof COPILOT_ACTIONS)[number]

export const COPILOT_RULES = {
  /**
   * The consent sheet the person agreed to. Raise it when the sheet's words
   * change what they agree to — what is sent, or to whom — and everybody is
   * asked again: a consent recorded against other words is not this one.
   */
  consentVersion: 1,
  /**
   * Off for 16- and 17-year-olds by default — a default for minors is a
   * product owner's decision, and the EU's DSA Art. 28 guidance leans the
   * same way. Lowering this to `MINIMUM_AGE` is what turns it on for them;
   * nothing else would need to change.
   */
  minimumAge: 18,
  /**
   * Answers the model writes for **everybody**, per UTC day — the ceiling
   * that bounds the bill, since `copilotPer24h` bounds one person and the
   * number of people is not bounded by anything. At the worst case worked
   * out on `copilotPer24h` (about 1.3 cents an answer at Sonnet 5's rates)
   * this is about $6.50 a day and $195 a month, at most. Set a spend limit
   * on the key as well: this is our ceiling, and that one is the provider's.
   */
  globalCallsPerDay: 500,
  /** A sentence to Check. Longer than a chat line rarely is; the cost is what is bounded. */
  maxCheckChars: 400,
  /**
   * How much of the thread Reply ideas reads: the last few lines, each cut
   * to this many characters — `OFFICIAL_ASSISTANT.historyCharsPerMessage`'s
   * reasoning, which is that the budget is characters and the bill is tokens,
   * at about two characters a token in Arabic and Russian.
   */
  contextMessages: 6,
  contextCharsPerMessage: 200,
  /** The original and the fix that Explain is shown, each cut to this. */
  maxExplainChars: 500,
  /**
   * The hard stop on what the model may write, thinking included. Output is
   * five times the price of input, so this is the number that decides the
   * worst case — `max_tokens` is a stop the model cannot pass, unlike a
   * request to be brief.
   */
  maxOutputTokens: 1024,
  /** Reply ideas offered at once. */
  replyIdeas: 3,
  /**
   * How long an answer is kept for whoever asks the same question next.
   * Short: an answer to a private thread is kept under a hash, linked to no
   * account, and a week is long enough for a common sentence to be asked
   * twice without the cache becoming an archive of anybody's chats.
   */
  cacheDays: 7,
} as const

/**
 * Why Copilot did not answer — the `reason` on `COPILOT_UNAVAILABLE`. See
 * `ERROR_CODES.COPILOT_UNAVAILABLE` for each one.
 */
export const COPILOT_UNAVAILABLE_REASONS = ['off', 'age', 'busy', 'no_answer'] as const
export type CopilotUnavailableReason = (typeof COPILOT_UNAVAILABLE_REASONS)[number]

/**
 * Whether somebody born on `birthDate` is old enough for Copilot today.
 *
 * Exact — the birthday has to have passed — where `ageFromBirthDate` counts
 * whole years from the birth year alone. That arithmetic is right for what
 * a profile prints; for a gate that keeps 17-year-olds out it would let one
 * in for up to a year. A calendar day against a calendar day, both as
 * `YYYY-MM-DD`, so the comparison is a string comparison and no time zone
 * moves it.
 */
export function copilotAgeAllows(birthDate: string, now: Date = new Date()): boolean {
  const today = now.toISOString().slice(0, 10)
  const cutoff = `${Number(today.slice(0, 4)) - COPILOT_RULES.minimumAge}${today.slice(4)}`
  return birthDate <= cutoff
}

const conversationId = z.string().trim().min(1)

export const copilotCheckRequestSchema = z.object({
  conversationId,
  text: z.string().trim().min(1).max(COPILOT_RULES.maxCheckChars),
})
export type CopilotCheckRequest = z.infer<typeof copilotCheckRequestSchema>

export const copilotReplyIdeasRequestSchema = z.object({ conversationId })
export type CopilotReplyIdeasRequest = z.infer<typeof copilotReplyIdeasRequestSchema>

/** `messageId` is a correction in that thread — the one to explain. */
export const copilotExplainRequestSchema = z.object({
  conversationId,
  messageId: z.string().trim().min(1),
})
export type CopilotExplainRequest = z.infer<typeof copilotExplainRequestSchema>

/**
 * The version of the sheet the person saw. Only the current one is accepted,
 * so an old build cannot record agreement to words that are no longer the
 * ones on offer.
 */
export const copilotConsentRequestSchema = z.object({ version: z.number().int() })

export const copilotResultSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('check'),
    /** The sentence as it should read; the same text when nothing needed changing. */
    corrected: z.string(),
    changed: z.boolean(),
    /** One reason, in the reader's app language. `null` when nothing changed. */
    reason: z.string().nullable(),
  }),
  z.object({
    action: z.literal('replyIdeas'),
    ideas: z.array(z.string()),
  }),
  z.object({
    action: z.literal('explain'),
    explanation: z.string(),
  }),
])
export type CopilotResult = z.infer<typeof copilotResultSchema>

export const copilotResponseSchema = z.object({
  /**
   * Always `'ai'`: every Copilot answer is a model's, and the client draws it
   * blue and labelled "AI · may be wrong". Sent rather than assumed so that a
   * screen rendering a result cannot be handed one without the label's cue.
   */
  source: z.literal('ai'),
  /** From `copilotCache` — such an answer cost no allowance. */
  cached: z.boolean(),
  result: copilotResultSchema,
})
export type CopilotResponse = z.infer<typeof copilotResponseSchema>

/** What `GET /copilot` says about this person, today. */
export const copilotStatusSchema = z.object({
  /** True when an answer could be asked for right now, consent aside. */
  available: z.boolean(),
  /** Why not, when not: the operator's switch or no key, or the person's age. */
  reason: z.enum(['off', 'age']).nullable(),
  /** Agreed to the current version of the consent sheet. */
  consented: z.boolean(),
  /** The version the consent sheet must send back. */
  consentVersion: z.number(),
  quota: z.object({
    limit: z.number().nullable(),
    remaining: z.number().nullable(),
    nextAvailableAt: z.string().nullable(),
  }),
})
export type CopilotStatus = z.infer<typeof copilotStatusSchema>
