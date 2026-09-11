import { describe, expect, it } from 'vitest'
import { newHandleSchema } from './handle'
import {
  OFFICIAL_DISPLAY_NAMES,
  OFFICIAL_HANDLES,
  isOfficialHandle,
  officialAvatarUrl,
} from './officialAccounts'
import { isReservedHandle } from './reservedHandles'

describe('official accounts', () => {
  /**
   * The one that matters. The API creates these accounts at boot and takes
   * the handle it is given; if the word were claimable, a person could be
   * holding it first and the boot would either fail or — worse, had the
   * unique index not been there — overwrite them. Reserving it is what makes
   * that race impossible, and nothing else in the codebase would notice if
   * somebody added a third official account and forgot.
   */
  it('reserves every official handle, so onboarding cannot claim one', () => {
    for (const handle of OFFICIAL_HANDLES) {
      expect(isReservedHandle(handle), handle).toBe(true)
      expect(newHandleSchema.safeParse(handle).success, handle).toBe(false)
    }
  })

  it('names every handle', () => {
    for (const handle of OFFICIAL_HANDLES) {
      expect(OFFICIAL_DISPLAY_NAMES[handle], handle).toBeTruthy()
    }
  })

  it('matches a handle the way a claim would, and nothing else', () => {
    expect(isOfficialHandle(' LangX ')).toBe(true)
    expect(isOfficialHandle('langx_official')).toBe(false)
  })

  it('builds an avatar URL without doubling the slash', () => {
    expect(officialAvatarUrl('https://api.langx.io/', 'copilot')).toBe(
      'https://api.langx.io/public/avatar/official/copilot',
    )
  })
})
