import { z } from 'zod'

/**
 * Copilot: four one-tap helps inside a chat, written by a model.
 *
 * - **Check** — your sentence, corrected if it needs it, with one reason.
 * - **Reply ideas** — a few short replies to the thread, at your level, for
 *   you to edit. Never sent by themselves.
 * - **Explain** — what a text your partner sent means, or what a person's
 *   correction changed and why. It explains the human's change; it never
 *   offers one of its own.
 * - **Say it** — what you want to say, written in your own language, as a
 *   few natural ways to say it in the language you are learning. A tap puts
 *   one in your draft; nothing is sent.
 *
 * Here is only what both sides must agree on: the actions, the shapes, and
 * the numbers that bound the bill. How an answer looks — blue, labelled
 * "AI · may be wrong", never the green a person's correction wears — is the
 * client's. See `docs/decisions.md` → _Copilot ships dark, behind two
 * switches and a consent_.
 */
export const COPILOT_ACTIONS = ['check', 'replyIdeas', 'explain', 'sayIt'] as const
export type CopilotAction = (typeof COPILOT_ACTIONS)[number]

export const COPILOT_RULES = {
  /**
   * The consent sheet the person agreed to. Raise it when the sheet's words
   * change what they agree to — what is sent, or to whom — and everybody is
   * asked again: a consent recorded against other words is not this one.
   *
   * 2 since Explain reads a plain message the partner sent, which version
   * 1's words did not mention.
   */
  consentVersion: 2,
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
  /**
   * What Explain is shown, cut to this: a partner's message, or a
   * correction's original and fix, each.
   */
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
  /** What a person may ask Say it to put into words: a chat line, not a paragraph. */
  maxSayItChars: 200,
  /** Ways to say it offered at once — at most; fewer when the model gives fewer. */
  sayItOptions: 3,
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
export const COPILOT_UNAVAILABLE_REASONS = [
  'off',
  'age',
  'partner_age',
  'busy',
  'no_answer',
] as const
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

/**
 * `messageId` is the one to explain, in that thread: a correction either of
 * them wrote, or a text message the partner sent.
 */
export const copilotExplainRequestSchema = z.object({
  conversationId,
  messageId: z.string().trim().min(1),
})
export type CopilotExplainRequest = z.infer<typeof copilotExplainRequestSchema>

/**
 * `text` is what the person wants to say, in their own language;
 * `targetLanguage` is a `LANGUAGES` code — the client picks it, and the
 * server refuses one it does not know.
 */
export const copilotSayItRequestSchema = z.object({
  conversationId,
  text: z.string().trim().min(1).max(COPILOT_RULES.maxSayItChars),
  targetLanguage: z.string().trim().min(2).max(10),
})
export type CopilotSayItRequest = z.infer<typeof copilotSayItRequestSchema>

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
  z.object({
    action: z.literal('sayIt'),
    /** At most `sayItOptions`, each with a few words in the reader's language on how it differs. */
    options: z.array(z.object({ text: z.string(), gloss: z.string() })),
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
  /**
   * Why not, when not: `off` for the operator's switch, no key, or an
   * account the operator has not allowed — the app hides Copilot for all
   * three alike — or `age` for the person's age.
   */
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

/**
 * Allowing one account to use Copilot, or taking it back — the operator
 * panel's per-account switch. It opens nothing by itself: the flag, a key,
 * the age floor and the person's own consent all still apply.
 */
export const adminCopilotAccessRequestSchema = z.object({ allowed: z.boolean() })
export type AdminCopilotAccessRequest = z.infer<typeof adminCopilotAccessRequestSchema>

/** One allowed account, as `GET /admin/copilot/access` lists it. */
export interface AdminCopilotAccessRow {
  userId: string
  username: string
  displayName: string
  /** When access was given, as an ISO string. */
  at: string
}
