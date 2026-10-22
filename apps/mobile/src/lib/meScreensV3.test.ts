import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * The profile, Me and growth pages each have a second drawing under
 * `flags.v3Home`, in its own file under `src/screens/`, and only the drawing
 * may differ: every key, request, call and role the current page uses, its
 * v3 twin uses too (the rule `settingsScreensV3.test.ts` holds Settings to).
 *
 * `except` names what a twin drops on purpose, each with the reason, so a
 * drop is a decision someone wrote down rather than one a diff hid.
 */
const APP = path.resolve(__dirname, '../../app/(app)')
const SCREENS = path.resolve(__dirname, '../screens')

const PAIRS: readonly { current: string; v3: string; except?: readonly string[] }[] = [
  // v3 draws every rung of a ladder on its shelf, not the two tips of it, and
  // asks for the v3 catalogue (`useBadgesV3`).
  { current: 'badges.tsx', v3: 'me/BadgesScreenV3.tsx', except: ['badgeLadderTips', 'useBadges'] },
  { current: 'share-profile.tsx', v3: 'me/ShareProfileScreenV3.tsx' },
  { current: 'testimonials.tsx', v3: 'me/TestimonialsScreenV3.tsx' },
  { current: 'profile-testimonials.tsx', v3: 'me/ProfileTestimonialsScreenV3.tsx' },
  // v3 draws no pronouns, so its form does not ask for them (_v3 draws no
  // pronouns_ in docs/decisions.md).
  {
    current: 'edit-profile.tsx',
    v3: 'me/EditProfileScreenV3.tsx',
    except: [
      'editProfile.pronouns',
      'editProfile.pronounsPlaceholder',
      'editProfile.pronounsHint',
      'pronouns.trim',
    ],
  },
  // The day counts are formatted for the locale (`toLocaleString`), not `String`ed.
  {
    current: 'streak/leaderboard.tsx',
    v3: 'me/StreakLeaderboardScreenV3.tsx',
    except: ['String'],
  },
  { current: 'wallet/leaderboard.tsx', v3: 'me/WalletLeaderboardScreenV3.tsx' },
  { current: 'wallet/pool.tsx', v3: 'me/PoolScreenV3.tsx' },
  { current: 'invite.tsx', v3: 'me/InviteScreenV3.tsx' },
  { current: 'gift.tsx', v3: 'me/GiftScreenV3.tsx' },
  { current: 'how-it-works.tsx', v3: 'me/HowItWorksScreenV3.tsx' },
  // Every link still drawn: the first in a group of its own, the rest `.map`ped under it.
  { current: 'legal.tsx', v3: 'settings/LegalScreenV3.tsx', except: ['LEGAL_LINKS.map'] },
]

describe('v3 profile and growth pages keep the current pages’ words and requests', () => {
  for (const { current, v3, except = [] } of PAIRS) {
    it(`${v3} uses everything ${current} does`, () => {
      const before = uses(path.join(APP, current))
      const after = uses(path.join(SCREENS, v3))
      const skip = new Set(except)
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys)
        if (!skip.has(key)) expect(after.keys, `key ${key}`).toContain(key)
      for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
      for (const call of before.calls) {
        if (!skip.has(call)) expect(after.calls, `call ${call}`).toContain(call)
      }
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })
  }
})
