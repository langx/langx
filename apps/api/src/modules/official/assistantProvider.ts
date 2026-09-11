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

/**
 * Whether this model is sent an effort level.
 *
 * `effort` tunes how much a model thinks, and Haiku does not think — it
 * **rejects** the parameter rather than ignoring it, so sending it to the
 * default model would 400 every reply, invisibly, until somebody wrote to
 * @langx. Every other model here defaults to thinking hard, which this
 * workload does not need, so they are sent `low`.
 *
 * A prefix match rather than a list of ids: the rule is about the family, and
 * a list would be one more thing to remember to edit.
 */
export function sendsEffort(model: string): boolean {
  return !model.startsWith('claude-haiku')
}

export function createAnthropicProvider(env: Env): AssistantProvider | null {
  if (!env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const effort = sendsEffort(env.ANTHROPIC_MODEL)
    ? { output_config: { effort: 'low' as const } }
    : {}

  return {
    async respond({ system, history, tools }) {
      const runner = client.beta.messages.toolRunner({
        model: env.ANTHROPIC_MODEL,
        max_tokens: OFFICIAL_ASSISTANT.maxReplyTokens,
        system,
        // See `effort` above: present for the thinking models, absent for Haiku,
        // which refuses it.
        ...effort,
        /*
         * The tool definitions and the system prompt are the same bytes on
         * every request, and they are the prefix in that order, so a
         * breakpoint after them is worth asking for.
         *
         * On the default model it will not fire: Haiku 4.5 wants a prefix of
         * 4,096 tokens before it caches anything and this one is around 3,500.
         * It is here anyway because it is free when it misses, and because the
         * thinking models ask for less — 512 on Opus 5, 1,024 on Sonnet 5 —
         * so whoever switches models gets the discount without editing this.
         * `usage.cache_read_input_tokens` is what says whether it landed.
         *
         * Nothing is padded to reach a threshold: a longer prompt bought to
         * earn a discount on itself is not a saving.
         */
        cache_control: { type: 'ephemeral' },
        /*
         * No server-side refusal fallback. It is a feature of the frontier
         * models, and a beta header an endpoint does not recognise is a 400 on
         * every call rather than a quiet no-op — a worse failure than the one
         * it protects against. The refusal itself is still handled below: the
         * turn comes back 200 with `stop_reason: 'refusal'` and the caller
         * words it.
         */
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
