import { readFileSync } from 'node:fs'
import path from 'node:path'
import { COPILOT_ACTIONS, PLAN_LIMITS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { COPILOT_PAGE_HELPS, copilotAllowances, copilotPageAction } from './copilotPage'

describe('copilotAllowances', () => {
  it('reads both plans, and Pro is more answers — what the page says Pro is', () => {
    const allowances = copilotAllowances()
    expect(allowances).toEqual({
      free: PLAN_LIMITS.free.copilotPer24h,
      pro: PLAN_LIMITS.pro.copilotPer24h,
    })
    expect(allowances!.pro).toBeGreaterThan(allowances!.free)
  })
})

describe('COPILOT_PAGE_HELPS', () => {
  it('lists every help exactly once, so a fifth cannot ship without a row on the page', () => {
    expect([...COPILOT_PAGE_HELPS].sort()).toEqual([...COPILOT_ACTIONS].sort())
  })
})

describe('copilotPageAction', () => {
  const ready = { available: true, consented: true }
  const asking = { available: true, consented: false }
  const refused = { available: false, consented: true }

  it('sends a member Copilot answers to a chat, whether or not they have agreed yet', () => {
    expect(copilotPageAction({ v3: true, session: 'member', service: true, status: ready })).toBe(
      'tryInChat',
    )
    // The consent sheet is the thread's, at the first tap; the page does not ask.
    expect(copilotPageAction({ v3: true, session: 'member', service: true, status: asking })).toBe(
      'tryInChat',
    )
  })

  it('offers nothing when Copilot is off for this person', () => {
    expect(
      copilotPageAction({ v3: true, session: 'member', service: false, status: ready }),
    ).toBeNull()
    expect(
      copilotPageAction({ v3: true, session: 'member', service: true, status: refused }),
    ).toBeNull()
    // `GET /copilot` has not answered, or answered with an error (an
    // unverified email): no button until it says yes.
    expect(
      copilotPageAction({ v3: true, session: 'member', service: true, status: undefined }),
    ).toBeNull()
  })

  it('asks a guest to sign up only where Copilot is on', () => {
    expect(
      copilotPageAction({ v3: true, session: 'guest', service: true, status: undefined }),
    ).toBe('signUp')
    expect(
      copilotPageAction({ v3: true, session: 'guest', service: false, status: undefined }),
    ).toBeNull()
  })

  it('offers nothing on the current look, whose thread draws no Copilot', () => {
    expect(
      copilotPageAction({ v3: false, session: 'member', service: true, status: ready }),
    ).toBeNull()
    expect(
      copilotPageAction({ v3: false, session: 'guest', service: true, status: undefined }),
    ).toBeNull()
  })

  it('offers nothing before the session is known', () => {
    expect(
      copilotPageAction({ v3: true, session: 'none', service: true, status: ready }),
    ).toBeNull()
  })
})

/**
 * The screen draws `signUp` once, in the hero. It once had a second copy at
 * the foot as well, and a guest saw the same button twice (#2084). Read from
 * the source, as `homeProducts.test.ts` reads the product screens, since the
 * screen cannot be rendered under vitest.
 */
describe('CopilotScreenV3', () => {
  const source = readFileSync(path.resolve(__dirname, '../screens/CopilotScreenV3.tsx'), 'utf8')
  const count = (needle: string) => source.split(needle).length - 1

  it('asks a guest to sign up in one place, with one call to the sign-up', () => {
    expect(count("'copilot.page.signUp'"), 'the sign-up label').toBe(1)
    expect(count('requireAccount('), 'calls to requireAccount').toBe(1)
  })
})
