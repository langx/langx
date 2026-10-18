import { COPILOT_RULES } from '@langx/shared'
import type { Env } from '../../env'
import { createStructuredProvider, type StructuredProvider } from '../official/assistantProvider'

/**
 * The model behind Copilot, or `null` without a key.
 *
 * `null` is one of the two ways Copilot is off; `flags.copilotEnabled` is the
 * other, and the one that matters — a key is shared with the @langx
 * assistant, so having one says nothing about whether Copilot should answer.
 */
export function createCopilotProvider(env: Env): StructuredProvider | null {
  return createStructuredProvider(
    env.ANTHROPIC_API_KEY,
    env.COPILOT_MODEL ?? env.ANTHROPIC_MODEL,
    COPILOT_RULES.maxOutputTokens,
  )
}
