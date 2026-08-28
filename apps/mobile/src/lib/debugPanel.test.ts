import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDebugPanelEnabled } from './debugPanel'

function setEnv(dev: boolean, flag: string | undefined) {
  vi.stubGlobal('__DEV__', dev)
  if (flag === undefined) delete process.env.EXPO_PUBLIC_DEBUG_PANEL
  else process.env.EXPO_PUBLIC_DEBUG_PANEL = flag
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.EXPO_PUBLIC_DEBUG_PANEL
})

describe('isDebugPanelEnabled', () => {
  it('is on only when both conditions hold', () => {
    setEnv(true, '1')
    expect(isDebugPanelEnabled()).toBe(true)
  })

  /**
   * The condition that actually protects a shipped bundle: `EXPO_PUBLIC_*` is
   * inlined at build time, so a flag left set in a shell can otherwise follow
   * a web export into production.
   */
  it('is off in a production bundle however the environment is set', () => {
    setEnv(false, '1')
    expect(isDebugPanelEnabled()).toBe(false)
  })

  it('is off in development without the flag', () => {
    setEnv(true, undefined)
    expect(isDebugPanelEnabled()).toBe(false)
  })

  it('does not treat some other truthy value as the flag', () => {
    setEnv(true, 'true')
    expect(isDebugPanelEnabled()).toBe(false)
  })
})
