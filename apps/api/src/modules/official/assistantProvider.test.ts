import { describe, expect, it } from 'vitest'
import type { Env } from '../../env'
import {
  createAnthropicProvider,
  createStructuredProvider,
  sendsEffort,
  sendsRefusalFallback,
} from './assistantProvider'

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
 * `output_config.effort` is rejected by Haiku 4.5 and Sonnet 4.5 rather than
 * ignored, so sending it to one of them would 400 every reply — the kind of failure
 * that is total, immediate and invisible until somebody writes to @langx.
 *
 * Asserted against the shape rather than through a request, because the thing
 * worth pinning is the rule, and the request needs a network and a key.
 */
describe('which models are sent an effort level', () => {
  it('never sends it to the models that reject it', () => {
    for (const model of [
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5',
      'claude-opus-4-1',
      'claude-sonnet-4-20250514',
    ]) {
      expect(sendsEffort(model), model).toBe(false)
    }
  })

  it('sends it to the thinking models, which otherwise default to high', () => {
    for (const model of ['claude-sonnet-5', 'claude-opus-5', 'claude-opus-4-8']) {
      expect(sendsEffort(model), model).toBe(true)
    }
  })

  /**
   * The rule used to be "no Haiku". Haiku 5.5 takes effort and defaults to
   * `medium`, so that rule left the cheap model thinking more than asked —
   * on the very change meant to save money.
   */
  it('sends it to Haiku 5.5, and to the models that default to medium', () => {
    for (const model of ['claude-haiku-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5']) {
      expect(sendsEffort(model), model).toBe(true)
    }
  })
})

describe('which models are sent a refusal fallback', () => {
  it('sends it only to the models that offer one', () => {
    for (const model of [
      'claude-opus-5-5',
      'claude-opus-5',
      'claude-sonnet-5-5',
      'claude-fable-5-1',
    ]) {
      expect(sendsRefusalFallback(model), model).toBe(true)
    }
    // Haiku 5.5 has none, and an unknown beta is a 400 on every call.
    for (const model of ['claude-sonnet-5', 'claude-haiku-5-5', 'claude-haiku-4-5']) {
      expect(sendsRefusalFallback(model), model).toBe(false)
    }
  })
})

describe('the structured provider', () => {
  it('is null without a key — one of the two ways Copilot is off', () => {
    expect(createStructuredProvider(undefined, 'claude-sonnet-5', 1024)).toBeNull()
    expect(createStructuredProvider('', 'claude-sonnet-5', 1024)).toBeNull()
  })

  it('says which model answers, for the cache key', () => {
    expect(createStructuredProvider('sk-test', 'claude-sonnet-5', 1024)?.model).toBe(
      'claude-sonnet-5',
    )
  })
})
