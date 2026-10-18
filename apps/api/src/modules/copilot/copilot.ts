import {
  copilotAgeAllows,
  COPILOT_RULES,
  ERROR_CODES,
  type CopilotCheckRequest,
  type CopilotExplainRequest,
  type CopilotReplyIdeasRequest,
  type CopilotResponse,
  type CopilotResult,
  type CopilotStatus,
  type CopilotUnavailableReason,
  type Locale,
  type PlanLimits,
} from '@langx/shared'
import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota, getQuotaStatus, refundQuota } from '../../lib/quota'
import { assertConversationAccess } from '../chat/access'
import type { Message } from '../chat/conversations'
import { loadMutableMessage } from '../chat/mutations'
import type { StructuredProvider } from '../official/assistantProvider'
import { effectiveTier } from '../profiles/entitlement'
import { getProfile, type Profile } from '../profiles/profiles'
import { claimCopilotCall } from './budget'
import { copilotCacheKey, lookupCopilotResult, rememberCopilotResult } from './cache'
import { hasCopilotConsent } from './consent'
import {
  clip,
  firstLevel,
  learnerFacts,
  MODEL_OUTPUT,
  readerLanguage,
  systemPromptFor,
} from './prompts'

/**
 * What Copilot needs from the process: the two switches, and somewhere to say
 * that a call failed.
 *
 * **Two switches, and both must be on.** `provider` is there when a key is
 * configured; `enabled` is the operator's `flags.copilotEnabled`, which starts
 * off. The key is shared with the @langx assistant, so a key alone must never
 * be what turns Copilot on — that is a decision about the privacy policy and
 * the store forms, not about credentials.
 */
export interface CopilotDeps {
  db: Db
  provider: StructuredProvider | null
  enabled: boolean
  /** Never handed the person's text — only the action and the error. */
  log: { error: (fields: object, message: string) => void }
}

function unavailable(reason: CopilotUnavailableReason, message: string): ApiError {
  return new ApiError(ERROR_CODES.COPILOT_UNAVAILABLE, message, { reason })
}

async function loadProfile(db: Db, userId: string): Promise<Profile> {
  const profile = await getProfile(db, userId)
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  return profile
}

/** Where Copilot stands for this person today — what the consent sheet and the app read first. */
export async function getCopilotStatus(
  deps: Pick<CopilotDeps, 'db' | 'provider' | 'enabled'>,
  userId: string,
  now: Date = new Date(),
): Promise<CopilotStatus> {
  const profile = await loadProfile(deps.db, userId)
  const on = deps.enabled && deps.provider !== null
  const oldEnough = copilotAgeAllows(profile.birthDate, now)
  const quota = await getQuotaStatus(deps.db, userId, effectiveTier(profile), 'copilot')
  return {
    available: on && oldEnough,
    reason: !on ? 'off' : !oldEnough ? 'age' : null,
    consented: hasCopilotConsent(profile),
    consentVersion: COPILOT_RULES.consentVersion,
    quota: {
      limit: quota.limit,
      remaining: quota.remaining,
      nextAvailableAt: quota.nextAvailableAt?.toISOString() ?? null,
    },
  }
}

export type CopilotQuestion =
  | ({ action: 'check' } & CopilotCheckRequest)
  | ({ action: 'replyIdeas' } & CopilotReplyIdeasRequest)
  | ({ action: 'explain' } & CopilotExplainRequest)

/** A question, read and checked, ready to be asked of the model or found in the cache. */
interface Job {
  /** Exactly what the model is sent as the user turn — and so what the cache is keyed on. */
  userTurn: string
  /** Asks, and turns the model's answer into what the client is sent. `null` is no answer. */
  run: (provider: StructuredProvider) => Promise<CopilotResult | null>
}

/**
 * The last few lines of the thread, oldest first, as `me` and `them`.
 *
 * Text only — messages and corrections. Never a voice note, a photo, a
 * view-once, a line deleted for everyone or hidden by this reader, and never
 * a name or an id: the model is told who said what by role alone.
 */
async function recentLines(
  db: Db,
  conversationId: ObjectId,
  userId: string,
): Promise<{ from: 'me' | 'them'; text: string }[]> {
  const rows = await db
    .collection<Message>(COLLECTIONS.messages)
    .find(
      {
        conversationId,
        type: { $in: ['text', 'correction'] },
        deletedAt: { $exists: false },
        viewOnce: { $exists: false },
        hiddenFor: { $ne: userId },
      },
      { projection: { senderId: 1, body: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(COPILOT_RULES.contextMessages)
    .toArray()

  return rows
    .reverse()
    .filter((row) => row.body.trim().length > 0)
    .map((row) => ({
      from: row.senderId === userId ? ('me' as const) : ('them' as const),
      text: clip(row.body.trim(), COPILOT_RULES.contextCharsPerMessage),
    }))
}

/**
 * Reads what the question is about, through the same doors everything else
 * in a chat goes through: `assertConversationAccess` for the thread, and
 * `loadMutableMessage` for a message in it. So a blocked pair, a thread the
 * caller is not in, or a message from somewhere else is refused exactly as
 * it would be anywhere else — before anything is read for the model.
 */
async function prepare(
  db: Db,
  userId: string,
  profile: Profile,
  locale: Locale,
  question: CopilotQuestion,
): Promise<Job> {
  const learner = learnerFacts(profile)

  if (question.action === 'check') {
    await assertConversationAccess(db, question.conversationId, userId)
    const sentence = question.text.trim()
    const userTurn = JSON.stringify({ learner, readerLanguage: readerLanguage(locale), sentence })
    return {
      userTurn,
      run: async (provider) => {
        const output = await provider.ask({
          system: systemPromptFor('check'),
          prompt: userTurn,
          schema: MODEL_OUTPUT.check,
        })
        const corrected = output?.corrected.trim()
        if (!output || !corrected) return null
        // Decided by comparing, not taken from the model: "changed" is a
        // claim about two strings, and the server holds both.
        const changed = corrected !== sentence
        const reason = output.reason?.trim()
        return { action: 'check', corrected, changed, reason: changed && reason ? reason : null }
      },
    }
  }

  if (question.action === 'replyIdeas') {
    const conversation = await assertConversationAccess(db, question.conversationId, userId)
    const thread = await recentLines(db, conversation._id, userId)
    if (thread.length === 0) {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is nothing to reply to yet', {
        reason: 'empty_thread',
      })
    }
    const userTurn = JSON.stringify({ learner, thread })
    return {
      userTurn,
      run: async (provider) => {
        const output = await provider.ask({
          system: systemPromptFor('replyIdeas'),
          prompt: userTurn,
          schema: MODEL_OUTPUT.replyIdeas,
        })
        const ideas = (output?.ideas ?? [])
          .map((idea) => idea.trim())
          .filter((idea) => idea.length > 0)
          .slice(0, COPILOT_RULES.replyIdeas)
        return ideas.length > 0 ? { action: 'replyIdeas', ideas } : null
      },
    }
  }

  const { message } = await loadMutableMessage(
    db,
    userId,
    question.conversationId,
    question.messageId,
  )
  const correction = message.correction
  if (
    message.type !== 'correction' ||
    !correction ||
    message.deletedAt ||
    message.hiddenFor?.includes(userId)
  ) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That message is not a correction', {
      reason: 'not_a_correction',
    })
  }
  const userTurn = JSON.stringify({
    level: firstLevel(profile),
    readerLanguage: readerLanguage(locale),
    original: clip(correction.original, COPILOT_RULES.maxExplainChars),
    corrected: clip(correction.corrected, COPILOT_RULES.maxExplainChars),
    note: correction.note ? clip(correction.note, COPILOT_RULES.contextCharsPerMessage) : null,
  })
  return {
    userTurn,
    run: async (provider) => {
      const output = await provider.ask({
        system: systemPromptFor('explain'),
        prompt: userTurn,
        schema: MODEL_OUTPUT.explain,
      })
      const explanation = output?.explanation.trim()
      return explanation ? { action: 'explain', explanation } : null
    },
  }
}

/**
 * One Copilot answer.
 *
 * The order is the design, and each step is there to keep something from
 * reaching the next:
 *
 * 1. **The service** — the operator's switch and a key. Off, nothing is read.
 * 2. **The person** — old enough, and agreed to the current consent sheet.
 *    Nothing of theirs is read for the model, let alone sent, before both.
 * 3. **The question** — through the chat's own access checks.
 * 4. **The cache** — an answer somebody already paid for costs nothing.
 * 5. **The person's allowance**, then **everybody's** — in that order, so a
 *    free account refused its own allowance spends nothing of the global
 *    day; and the person's unit is given back if the global day is spent.
 * 6. **The model** — and if it declines or fails, the unit is given back:
 *    telling somebody it did not work while charging them is the unfairness
 *    `refundQuota` exists for.
 */
export async function askCopilot(
  deps: CopilotDeps,
  userId: string,
  locale: Locale,
  question: CopilotQuestion,
  now: Date = new Date(),
): Promise<CopilotResponse> {
  const { db, provider } = deps
  if (!deps.enabled || !provider) throw unavailable('off', 'Copilot is off')

  const profile = await loadProfile(db, userId)
  if (!copilotAgeAllows(profile.birthDate, now)) {
    throw unavailable('age', 'Copilot is not available on this account')
  }
  if (!hasCopilotConsent(profile)) {
    throw new ApiError(ERROR_CODES.COPILOT_CONSENT_REQUIRED, 'Agree to the Copilot sheet first')
  }

  const job = await prepare(db, userId, profile, locale, question)
  const key = copilotCacheKey(provider.model, question.action, job.userTurn)
  const hit = await lookupCopilotResult(db, key)
  if (hit) return { source: 'ai', cached: true, result: hit }

  const quota = await consumeQuota(db, userId, effectiveTier(profile), 'copilot')
  if (!quota.consumed) {
    throw new ApiError(ERROR_CODES.QUOTA_EXCEEDED, 'Daily Copilot limit reached', {
      limit: 'copilotPer24h' satisfies keyof PlanLimits,
      ...(quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : {}),
    })
  }

  if (!(await claimCopilotCall(db, now))) {
    await refundQuota(db, userId, 'copilot', quota.spentAt)
    throw unavailable('busy', 'Copilot has answered all it can today')
  }

  let result: CopilotResult | null
  try {
    result = await job.run(provider)
  } catch (error) {
    deps.log.error({ err: error, action: question.action }, 'copilot call failed')
    result = null
  }
  if (!result) {
    await refundQuota(db, userId, 'copilot', quota.spentAt)
    throw unavailable('no_answer', 'Copilot could not answer that')
  }

  await rememberCopilotResult(db, key, result, now)
  return { source: 'ai', cached: false, result }
}
