import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { loadEnv } from '../../env'
import { createStructuredProvider } from '../official/assistantProvider'
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

  describe('a model that never answers', () => {
    let server: Server | undefined
    const savedBaseUrl = process.env.ANTHROPIC_BASE_URL

    afterEach(() => {
      server?.closeAllConnections()
      server?.close()
      if (savedBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = savedBaseUrl
    })

    // A local server that takes the request and never replies: the stall the
    // SDK's ten-minute default would sit through. The provider must give up
    // on its own timeout and throw, which `askCopilot` turns into a refund.
    it('gives up after its timeout instead of the SDK default', async () => {
      server = createServer(() => {})
      await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
      const { port } = server.address() as AddressInfo
      process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`

      const provider = createStructuredProvider('test-key-not-real', 'test-model', 16, {
        timeoutMs: 200,
        maxRetries: 0,
      })
      const started = Date.now()
      await expect(
        provider?.ask({ system: 's', prompt: '{}', schema: z.object({ ok: z.boolean() }) }),
      ).rejects.toThrow()
      expect(Date.now() - started).toBeLessThan(5_000)
    })
  })
})
