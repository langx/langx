import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * The standalone Settings pages each have a second drawing under
 * `flags.v3Home`, in its own file, and the promise is that only the drawing
 * differs: the words, the screen-reader names and the requests are today's.
 * Two copies of a form are two places for one of them to drift, so this
 * holds the v3 copy to the current one.
 *
 * Read over the AST, so a comment that names a key or a path does not count:
 * every message key, every API path, every call that does something (see
 * `DRAWING_CALLS`) and every accessibility role but `button` the current
 * screen uses must also be used by its v3 twin. The v3
 * file may add — a heading the board draws — but not drop, so a consent
 * line, a refusal's wording or a radio's role cannot quietly go missing from
 * one look.
 */
const APP = path.resolve(__dirname, '../../app/(app)')
const SCREENS = path.resolve(__dirname, '../screens/settings')

const PAIRS: readonly { current: string; v3: string }[] = [
  { current: 'settings/username.tsx', v3: 'UsernameScreenV3.tsx' },
  { current: 'settings/password.tsx', v3: 'PasswordScreenV3.tsx' },
  { current: 'settings/sign-in-methods.tsx', v3: 'SignInMethodsScreenV3.tsx' },
  { current: 'settings/delete-account.tsx', v3: 'DeleteAccountScreenV3.tsx' },
  { current: 'settings/feedback.tsx', v3: 'FeedbackScreenV3.tsx' },
  { current: 'settings/location.tsx', v3: 'LocationGuideScreenV3.tsx' },
  { current: 'settings/push.tsx', v3: 'PushGuideScreenV3.tsx' },
  { current: 'settings/voices.tsx', v3: 'VoiceCreditsScreenV3.tsx' },
  { current: 'app-language.tsx', v3: 'AppLanguageScreenV3.tsx' },
  { current: 'languages/index.tsx', v3: 'LanguagesScreenV3.tsx' },
  { current: 'languages/pick.tsx', v3: 'LanguagePickScreenV3.tsx' },
  { current: 'blocked.tsx', v3: 'BlockedScreenV3.tsx' },
  { current: 'link-device.tsx', v3: 'LinkDeviceScreenV3.tsx' },
]

describe('v3 Settings pages keep the current pages’ words and requests', () => {
  for (const { current, v3 } of PAIRS) {
    it(`${v3} uses everything ${current} does`, () => {
      const before = uses(path.join(APP, current))
      const after = uses(path.join(SCREENS, v3))
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
      for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
      for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
      // `button` is left out: every control in the kit is one, and a v3 page
      // that draws `Button` names no role itself.
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })
  }
})
