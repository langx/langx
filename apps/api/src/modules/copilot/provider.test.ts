import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../env'
import { createCopilotProvider } from './provider'

const BASE = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB: 'langx_copilot_provider_test',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:4000',
}

/** Building a provider makes no request, so none of this touches the network. */
describe('the Copilot provider', () => {
  it('is absent without a key, which is Copilot off — and the app still boots', () => {
    expect(createCopilotProvider(loadEnv(BASE))).toBeNull()
    expect(createCopilotProvider(loadEnv({ ...BASE, ANTHROPIC_API_KEY: '' }))).toBeNull()
  })

  it("uses COPILOT_MODEL when set, and the assistant's model otherwise", () => {
    const key = { ANTHROPIC_API_KEY: 'test-key-not-real' }
    const shared = createCopilotProvider(
      loadEnv({ ...BASE, ...key, ANTHROPIC_MODEL: 'assistant-model' }),
    )
    expect(shared?.model).toBe('assistant-model')
    const own = createCopilotProvider(
      loadEnv({
        ...BASE,
        ...key,
        ANTHROPIC_MODEL: 'assistant-model',
        COPILOT_MODEL: 'copilot-model',
      }),
    )
    expect(own?.model).toBe('copilot-model')
  })
})
