import { createHash } from 'node:crypto'
import { COPILOT_RULES, type CopilotAction, type CopilotResult } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { COPILOT_PROMPT_VERSION } from './prompts'

interface CopilotCacheDoc {
  /** The question's hash — see `copilotCacheKey`. */
  _id: string
  result: CopilotResult
  createdAt: Date
  expiresAt: Date
}

/**
 * The hash of everything that decides an answer: the prompt's version, the
 * model, the action and the exact user turn the model would be sent — which
 * already holds the text, the languages and levels, and the reader's
 * language. Change any of those and it is a different question.
 *
 * Nothing that identifies the asker goes in, so two people asking the same
 * thing share one answer — the common sentences are the ones asked most —
 * and the row says nothing about who asked. Only somebody holding the exact
 * text can arrive at a key, and what they find is the answer to that text.
 */
export function copilotCacheKey(model: string, action: CopilotAction, userTurn: string): string {
  return createHash('sha256')
    .update(JSON.stringify([COPILOT_PROMPT_VERSION, model, action, userTurn]))
    .digest('hex')
}

export async function lookupCopilotResult(db: Db, key: string): Promise<CopilotResult | null> {
  const hit = await db.collection<CopilotCacheDoc>(COLLECTIONS.copilotCache).findOne({ _id: key })
  return hit?.result ?? null
}

/**
 * Keeps an answer for `COPILOT_RULES.cacheDays`.
 *
 * `$setOnInsert` with `upsert`, `rememberTranslation`'s shape: two people
 * missing on the same new question at once each paid their own unit, and the
 * second write is a no-op rather than a duplicate-key error.
 */
export async function rememberCopilotResult(
  db: Db,
  key: string,
  result: CopilotResult,
  now: Date = new Date(),
): Promise<void> {
  await db.collection<CopilotCacheDoc>(COLLECTIONS.copilotCache).updateOne(
    { _id: key },
    {
      $setOnInsert: {
        result,
        createdAt: now,
        expiresAt: new Date(now.getTime() + COPILOT_RULES.cacheDays * 24 * 60 * 60 * 1000),
      },
    },
    { upsert: true },
  )
}
