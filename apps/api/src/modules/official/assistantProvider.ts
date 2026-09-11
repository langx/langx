import Anthropic from '@anthropic-ai/sdk'
import { OFFICIAL_ASSISTANT } from '@langx/shared'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import type { Env } from '../../env'

/** One side of the conversation as the model sees it. */
export interface AssistantTurn {
  role: 'user' | 'assistant'
  text: string
}

/**
 * Something the assistant can do on behalf of the person writing to it.
 *
 * `run` takes `unknown` and parses with `schema` rather than trusting a typed
 * argument: the values come back from a model, and the parse is the boundary.
 */
export interface AssistantTool {
  name: string
  description: string
  schema: z.ZodType
  run: (input: unknown) => Promise<string>
}

export interface AssistantRequest {
  system: string
  history: AssistantTurn[]
  tools: AssistantTool[]
}

/**
 * The assistant, behind an interface for the same reason `TranslationProvider`
 * is: everything worth testing about `respondAsOfficial` — which account
 * answers, the daily ceiling, what the tools write, what happens when a reply
 * fails — is orchestration, and none of it should need a network call or a key
 * to exercise.
 *
 * `null` means the model declined. The caller words that, because only it
 * knows what language the reader speaks.
 */
export interface AssistantProvider {
  respond(request: AssistantRequest): Promise<string | null>
}

export function createAnthropicProvider(env: Env): AssistantProvider | null {
  if (!env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  return {
    async respond({ system, history, tools }) {
      const runner = client.beta.messages.toolRunner({
        model: env.ANTHROPIC_MODEL,
        max_tokens: OFFICIAL_ASSISTANT.maxReplyTokens,
        system,
        /*
         * The work is a short answer about a product, sometimes with one tool
         * call behind it. `low` is what that costs; the ceiling above is there
         * for the thinking, not the sentence.
         */
        output_config: { effort: 'low' },
        /*
         * The tool definitions and the system prompt are the same bytes on
         * every request, and they are the prefix in that order, so a
         * breakpoint after them is worth asking for.
         *
         * Whether it *fires* depends on where that prefix lands against the
         * model's minimum cacheable length — 512 tokens on Opus 5, 1024 on
         * Sonnet 5. The system prompt alone is around 800; with the two tool
         * schemas in front of it the prefix is near enough to Sonnet's
         * threshold that it is not worth predicting from here. Below the
         * minimum this is a no-op with no error, so the honest thing is to ask
         * and let `usage.cache_read_input_tokens` say. Nothing here is padded
         * to reach a threshold: a longer prompt to earn a discount on itself
         * is not a saving.
         */
        cache_control: { type: 'ephemeral' },
        /*
         * If the model declines, the API re-runs the same request on a
         * fallback rather than handing back nothing. `'default'` routes by
         * refusal category, so there is no model list here to go stale.
         */
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        tools: tools.map((tool) =>
          betaZodTool({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.schema,
            run: (args) => tool.run(args),
          }),
        ),
        messages: history.map((turn) => ({ role: turn.role, content: turn.text })),
      })

      const final = await runner
      // Checked before the content is read: a refused turn still answers 200,
      // and `content` on one is not an answer to anything.
      if (final.stop_reason === 'refusal') return null

      return final.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()
    },
  }
}
