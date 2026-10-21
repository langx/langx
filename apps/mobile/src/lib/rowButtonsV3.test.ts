import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The kit's `Button` spans its parent (`width: '100%'`), which is right at the
 * foot of a form and wrong beside other children: in a row it takes the whole
 * line and leaves the sibling text no room. Sign-in methods shipped that way —
 * the provider's name was squeezed out and the pill ran off the card. These
 * are the buttons that sit in a row; each must carry a `style` that undoes it.
 */
const ROW_BUTTONS: readonly { file: string; label: string; widthKey: string }[] = [
  {
    file: '../screens/settings/SignInMethodsScreenV3.tsx',
    label: 'settings.signInDisconnect',
    widthKey: 'action',
  },
  {
    file: '../screens/settings/SignInMethodsScreenV3.tsx',
    label: 'settings.signInConnect',
    widthKey: 'action',
  },
  { file: '../components/MessageBubble.tsx', label: 'calls.callNow', widthKey: 'meetingCallNow' },
  {
    file: '../components/thread/ThreadCelebrationV3.tsx',
    label: 'share.action',
    widthKey: 'share',
  },
]

describe('buttons in a row do not take the whole row', () => {
  for (const { file, label, widthKey } of ROW_BUTTONS) {
    it(`${path.basename(file)}: ${label}`, () => {
      const source = readFileSync(path.resolve(__dirname, file), 'utf8')
      const tags = [...source.matchAll(/<Button\b[\s\S]*?\/>/g)].map((m) => m[0])
      const tag = tags.find((t) => t.includes(`'${label}'`))
      expect(tag, `no <Button> labelled ${label}`).toBeDefined()
      expect(tag).toContain(`style={styles.${widthKey}}`)
      expect(source).toMatch(new RegExp(`${widthKey}: \\{[^}]*width: 'auto'`))
    })
  }
})
