import Anthropic from '@anthropic-ai/sdk'
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

/**
 * Short. This is a chat message in a language-exchange app, not a document,
 * and a wall of text in a chat bubble is its own kind of unhelpful. Thinking
 * counts against the same ceiling, hence the headroom over what the reply
 * itself needs.
 */
const MAX_TOKENS = 4096

export function createAnthropicProvider(env: Env): AssistantProvider | null {
  if (!env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  return {
    async respond({ system, history, tools }) {
      const runner = client.beta.messages.toolRunner({
        model: env.ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        /*
         * The work is a short answer about a product, sometimes with one tool
         * call behind it. `low` is what that costs; the ceiling above is there
         * for the thinking, not the sentence.
         */
        output_config: { effort: 'low' },
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
