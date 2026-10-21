import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * Our Kitchen, the sticker keyboard and a post's comment threads each have a
 * second drawing under `flags.v3Home`, in its own file, and the promise is
 * the one `settingsScreensV3.test.ts` holds the Settings pages to: only the
 * drawing differs. Every message key, API path, call that does something and
 * accessibility role but `button` the current file uses must also be used by
 * its v3 twin — so a licence credit, a refusal's wording or a link's role
 * cannot quietly go missing from one look.
 */
const SRC = path.resolve(__dirname, '..')
const APP = path.resolve(__dirname, '../../app/(app)')

const PAIRS: readonly { current: string; v3: string }[] = [
  {
    current: path.join(APP, 'kitchen.tsx'),
    v3: path.join(SRC, 'screens/settings/KitchenScreenV3.tsx'),
  },
  {
    current: path.join(APP, 'stickers.tsx'),
    v3: path.join(SRC, 'screens/chat/StickersScreenV3.tsx'),
  },
  {
    current: path.join(SRC, 'components/CommentThread.tsx'),
    v3: path.join(SRC, 'components/CommentThreadV3.tsx'),
  },
]

describe('v3 pages keep the current pages’ words and requests', () => {
  for (const { current, v3 } of PAIRS) {
    const name = path.basename(v3)
    it(`${name} uses everything ${path.basename(current)} does`, () => {
      const before = uses(current)
      const after = uses(v3)
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
      for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
      for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })
  }
})

/**
 * `MediaBubble` and `AttachmentBar` keep one component and pick a second
 * sheet by the flag, so there is no twin to compare. What can drift is the
 * sheet: a name the current one has and the v3 one lacks would leave a part
 * unstyled under the flag. The types refuse that where a name is read; this
 * catches a name that is only spread or passed along.
 */
function sheetNames(file: string, hook: string): string[] {
  const text = readFileSync(file, 'utf8')
  const start = text.indexOf(`const ${hook} = makeStyles(`)
  expect(start, `${hook} in ${file}`).toBeGreaterThan(-1)
  const end = text.indexOf('\n}))', start)
  // Top-level keys only: two spaces in, a name, a colon.
  return [...text.slice(start, end).matchAll(/^ {2}([a-zA-Z]+): /gm)].map((match) => match[1] ?? '')
}

describe('v3 sheets name everything the current sheets do', () => {
  const SHEETS = [
    {
      current: 'components/MediaBubble.tsx',
      v3: 'components/MediaBubbleV3.styles.ts',
      hook: 'useMediaStylesV3',
    },
    {
      current: 'components/AttachmentBar.tsx',
      v3: 'components/AttachmentBarV3.styles.ts',
      hook: 'useAttachmentStylesV3',
    },
  ]
  for (const { current, v3, hook } of SHEETS) {
    it(`${path.basename(v3)} covers ${path.basename(current)}`, () => {
      const before = sheetNames(path.join(SRC, current), 'useCurrentStyles')
      const after = new Set(sheetNames(path.join(SRC, v3), hook))
      expect(before.length).toBeGreaterThan(5)
      for (const name of before) expect(after, `style ${name}`).toContain(name)
    })
  }
})
