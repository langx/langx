import { describe, expect, it } from 'vitest'
import type { Env } from '../../env'
import { createAnthropicProvider, sendsEffort } from './assistantProvider'

function envWith(over: Partial<Env>): Env {
  return { ANTHROPIC_MODEL: 'claude-haiku-4-5', ...over } as Env
}

describe('the Anthropic provider', () => {
  it('is null without a key, which is what "the assistant is off" means', () => {
    expect(createAnthropicProvider(envWith({}))).toBeNull()
    expect(createAnthropicProvider(envWith({ ANTHROPIC_API_KEY: '' }))).toBeNull()
  })

  it('is built when there is one', () => {
    expect(createAnthropicProvider(envWith({ ANTHROPIC_API_KEY: 'sk-test' }))).not.toBeNull()
  })
})

/**
 * `output_config.effort` is rejected by Haiku 4.5 rather than ignored, so
 * sending it to the default model would 400 every reply — the kind of failure
 * that is total, immediate and invisible until somebody writes to @langx.
 *
 * Asserted against the shape rather than through a request, because the thing
 * worth pinning is the rule, and the request needs a network and a key.
 */
describe('which models are sent an effort level', () => {
  it('never sends it to Haiku', () => {
    expect(sendsEffort('claude-haiku-4-5')).toBe(false)
  })

  it('sends it to the thinking models, which otherwise default to high', () => {
    for (const model of ['claude-sonnet-5', 'claude-opus-5', 'claude-opus-4-8']) {
      expect(sendsEffort(model), model).toBe(true)
    }
  })
})
