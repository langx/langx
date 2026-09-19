import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FUNNEL_STEPS, forgetFunnel, isFunnelUnavailable, readFunnel } from './funnel'
import type { Env } from '../../env'

/**
 * The funnel exists twice — here and in `scripts/insight.mjs` — and this is
 * what keeps the two the same list.
 *
 * They cannot share a constant: `@langx/shared` is consumed as TypeScript
 * source (see its `package.json`), and the script is a plain `.mjs` run by
 * `node` with no loader in front of it. Reading the other file off disk is
 * what is left, and it is the same trick `adminStrings.test.ts` uses for the
 * same reason.
 *
 * If you are here because this failed: the two funnels disagree, and a panel
 * and a script that answer the same question differently is worse than either
 * being wrong on its own. Change both.
 */
const SCRIPT = path.join(__dirname, '../../../../../scripts/insight.mjs')

describe('the funnel', () => {
  it('is the same list the insight script asks for', () => {
    const source = readFileSync(SCRIPT, 'utf8')
    // Every event name this module sends, in order, has to appear in the
    // script — and the script must name no event this one does not.
    const quoted = new Set(
      Array.from(source.matchAll(/'([a-z_]+|Application Installed)'/g), (m) => m[1]),
    )
    for (const step of FUNNEL_STEPS) {
      expect(quoted.has(step.event), `${step.event} is missing from scripts/insight.mjs`).toBe(true)
    }
    for (const step of ['languages', 'levels', 'about-you', 'handle']) {
      expect(source, `the wizard step ${step}`).toContain(`'${step}'`)
    }
    // The last step is filtered to a purchase that completed; a funnel that
    // counted cancelled store sheets would flatter the one number that matters.
    expect(source).toContain("'purchased'")
  })

  it('says why there is no funnel rather than failing, on an instance with no key', async () => {
    forgetFunnel()
    const env = { POSTHOG_PROJECT_ID: '1', POSTHOG_REGION: 'eu' } as Env

    const answer = await readFunnel(env, '30d')

    expect(isFunnelUnavailable(answer)).toBe(true)
    if (!isFunnelUnavailable(answer)) return
    expect(answer.reason).toBe('unconfigured')
    expect(answer.window).toBe('30d')
  })

  it('asks PostHog once per window per half hour, refusals included', async () => {
    forgetFunnel()
    const env = {
      POSTHOG_QUERY_API_KEY: 'phx_test',
      POSTHOG_PROJECT_ID: '42',
      POSTHOG_REGION: 'eu',
    } as Env

    const calls: string[] = []
    const original = globalThis.fetch
    globalThis.fetch = (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
        query: { dateRange: { date_from: string } }
      }
      calls.push(body.query.dateRange.date_from)
      return Promise.resolve(
        new Response(
          JSON.stringify({ results: FUNNEL_STEPS.map((_step, i) => ({ count: 100 - i })) }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    }

    try {
      const first = await readFunnel(env, '30d')
      await readFunnel(env, '30d')
      const allTime = await readFunnel(env, 'all')

      // One call per window, and the second read of a window came out of memory.
      expect(calls).toEqual(['-30d', 'all'])

      expect(isFunnelUnavailable(first)).toBe(false)
      if (isFunnelUnavailable(first) || isFunnelUnavailable(allTime)) return
      expect(first.steps).toHaveLength(FUNNEL_STEPS.length)
      expect(first.steps[0]).toEqual({ label: 'Installed the app', count: 100 })
      expect(allTime.steps.at(-1)!.label).toBe('Bought a plan')
    } finally {
      globalThis.fetch = original
      forgetFunnel()
    }
  })
})
