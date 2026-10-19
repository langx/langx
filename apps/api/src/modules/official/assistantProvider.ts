import Anthropic from '@anthropic-ai/sdk'
import { OFFICIAL_ASSISTANT } from '@langx/shared'
import { betaZodOutputFormat, betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
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
 * The models that **reject** `output_config.effort` rather than ignoring it:
 * Haiku 4.5 and Sonnet 4.5, and everything before the 4.5 generation, which
 * is where the parameter arrived. The dated ids of Opus 4 and Sonnet 4 begin
 * `-4-2025…`, hence those two entries.
 */
const REFUSES_EFFORT = [
  'claude-3',
  'claude-haiku-4',
  'claude-sonnet-4-5',
  'claude-sonnet-4-0',
  'claude-sonnet-4-2025',
  'claude-opus-4-0',
  'claude-opus-4-1',
  'claude-opus-4-2025',
]

/**
 * Whether this model is sent an effort level.
 *
 * Sending it to a model in `REFUSES_EFFORT` would 400 every reply, invisibly,
 * until somebody wrote to @langx. Every newer model takes it, and defaults to
 * thinking harder than this workload needs — `high`, or `medium` on Haiku 5.5
 * and Opus 5.5 — so they are sent `low`.
 *
 * This used to withhold effort from every Haiku, written when the only Haiku
 * was 4.5. Haiku 5.5 takes it, so a move to the cheap model would have left
 * it thinking at its `medium` default — paying for thought nobody asked for,
 * on exactly the change that was meant to save money.
 *
 * Prefixes rather than ids: the rule is about generations, and the list only
 * names old ones, so a new model is sent `low` without anybody editing this.
 */
export function sendsEffort(model: string): boolean {
  return !REFUSES_EFFORT.some((prefix) => model.startsWith(prefix))
}

/**
 * Whether a refused request is re-run server-side, on the model Anthropic
 * recommends for that kind of refusal (`fallbacks: "default"`).
 *
 * Only for the models that offer it: Fable 5.1, Opus 5 and 5.5, Sonnet 5.5.
 * Haiku 5.5 has no fallback, and a beta an endpoint does not recognise is a
 * 400 on every call — so everything else is sent nothing, and a refusal comes
 * back as one, which the caller handles. Copilot's only; the assistant keeps
 * its own reasoning, below.
 */
const OFFERS_REFUSAL_FALLBACK = ['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5-5']

export function sendsRefusalFallback(model: string): boolean {
  return OFFERS_REFUSAL_FALLBACK.some((prefix) => model.startsWith(prefix))
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
        // See `effort` above: absent for the models in `REFUSES_EFFORT`,
        // present for every other.
        ...effort,
        /*
         * The tool definitions and the system prompt are the same bytes on
         * every request, and they are the prefix in that order, so a
         * breakpoint after them is worth asking for.
         *
         * The prefix is the tools and the system prompt, around 1,650 tokens —
         * not the whole request, since the history changes every turn. That is
         * over Opus 5's minimum of 512 and over Sonnet 5's 1,024, and under
         * Haiku 4.5's 4,096. So it misses on the default model and lands on
         * either of the two somebody would switch to, which is the right way
         * round: the discount arrives with the model that needs it.
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

/** One question with one typed answer — what Copilot asks. */
export interface StructuredRequest<T> {
  system: string
  /** Everything the model is asked about, as the one user turn. */
  prompt: string
  schema: z.ZodType<T>
}

/**
 * The same provider asked for one typed answer instead of a turn in a
 * conversation: structured output, so what comes back is JSON the schema
 * accepts, or nothing.
 *
 * An interface for `AssistantProvider`'s reason — everything worth testing
 * about Copilot (the consent gate, the allowance, the cache, what a refusal
 * says) is orchestration, and none of it should need a key or a network.
 *
 * `null` means no answer: the model declined, ran out of room before the
 * answer was whole, or wrote something the schema refuses. A thrown error is
 * a failure to reach it at all. The caller words both, and gives back the
 * allowance either way.
 */
export interface StructuredProvider {
  /** Which model answers — part of a cached answer's key, so a new model starts a fresh cache. */
  readonly model: string
  ask<T>(request: StructuredRequest<T>): Promise<T | null>
}

export function createStructuredProvider(
  apiKey: string | undefined,
  model: string,
  maxTokens: number,
): StructuredProvider | null {
  if (!apiKey) return null
  const client = new Anthropic({ apiKey })

  // `sendsEffort`'s rule, decided once rather than per request.
  const effort = sendsEffort(model) ? { effort: 'low' as const } : {}
  const fallback = sendsRefusalFallback(model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    : {}

  return {
    model,
    async ask({ system, prompt, schema }) {
      let message
      try {
        message = await client.beta.messages.parse({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }],
          output_config: { ...effort, format: betaZodOutputFormat(schema) },
          ...fallback,
        })
      } catch (error) {
        /*
         * A refused or cut-off answer is not JSON the schema accepts, and the
         * SDK's parse is what notices first — it throws a plain
         * `AnthropicError` before `stop_reason` can be read. That is "no
         * answer", not an outage. `APIError` is the request itself failing,
         * and goes up as one.
         */
        if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
          return null
        }
        throw error
      }
      // Checked before the answer is read, for `respond`'s reason above.
      if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') return null
      return message.parsed_output
    },
  }
}
