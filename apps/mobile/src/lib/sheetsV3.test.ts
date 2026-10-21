import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * The shared sheets each have a second drawing under `flags.v3Home`, and the
 * promise is the screens' one: only the drawing differs. Their logic — what
 * is sent, tracked, confirmed and refetched — stays in the current file, so
 * what has to be held is the drawing's side of it: every word the current
 * look draws is drawn by the v3 look too, the current file switches on the
 * flag, and the v3 drawing reads nothing but `theme.v3`.
 *
 * `drawn` lists the keys the current look puts on screen. The rest of the
 * file's keys are its logic's — a refusal's sentence, a toast — and reach
 * the v3 drawing as text the current file has already looked up.
 */
const SRC = path.resolve(__dirname, '..')

const VIEWS: readonly { current: string; v3: string; component: string; drawn: string[] }[] = [
  {
    current: 'components/ShareCardSheet.tsx',
    v3: 'components/ShareCardSheetV3.tsx',
    component: 'ShareCardChoicesV3',
    drawn: ['share.cardTitle', 'share.cardBody', 'share.justTheLink', 'common.cancel'],
  },
  {
    current: 'components/testimonials/TestimonialSheet.tsx',
    v3: 'components/testimonials/TestimonialSheetV3.tsx',
    component: 'TestimonialFormV3',
    drawn: [
      'testimonials.sheetTitle',
      'testimonials.sheetBody',
      'testimonials.placeholder',
      'testimonials.minHint',
      'testimonials.guidelines',
      'testimonials.publish',
      'testimonials.delete',
      'common.cancel',
      'common.save',
    ],
  },
  {
    current: 'components/GiftCodeEntry.tsx',
    v3: 'components/GiftCodeEntryV3.tsx',
    component: 'GiftCodeSheetV3',
    drawn: [
      'giftCode.link',
      'giftCode.title',
      'giftCode.body',
      'giftCode.pending',
      'giftCode.label',
      'giftCode.redeem',
      'giftCode.close',
    ],
  },
]

/** The two that swap a second style sheet in place, the way `CallMenu` does. */
const INLINE = ['components/AlertHost.tsx', 'components/testimonials/ThreadTestimonialCard.tsx']

function read(file: string): string {
  return readFileSync(path.join(SRC, file), 'utf8')
}

/** The body of `const <name> = makeStyles(…)`, up to the closing `}))`. */
function styleBlock(source: string, name: string): string {
  const start = source.indexOf(`const ${name} = makeStyles(`)
  expect(start, `no ${name}`).toBeGreaterThanOrEqual(0)
  return source.slice(start, source.indexOf('\n}))', start))
}

describe('shared sheets: the v3 drawing says what the current one says', () => {
  for (const view of VIEWS) {
    describe(path.basename(view.current), () => {
      it('switches on the flag to the v3 drawing', () => {
        const source = read(view.current)
        expect(source).toContain('useV3Home()')
        expect(source).toContain(`<${view.component}`)
      })

      it('keeps every word the current look draws', () => {
        const current = uses(path.join(SRC, view.current)).keys
        const v3 = uses(path.join(SRC, view.v3)).keys
        for (const key of view.drawn) {
          expect(current.has(key), `${key} is not in the current file`).toBe(true)
          expect(v3.has(key), `${key} is missing from the v3 drawing`).toBe(true)
        }
      })

      it('reads only the v3 tokens', () => {
        const source = read(view.v3)
        expect(source).toContain('makeStyles(({ v3 })')
        expect(source).not.toMatch(/\bcolors\.(text|accent|textMuted|textFaint|border)\b/)
        expect(source).not.toMatch(/\bfont\.(heading|body|caption)\b/)
      })
    })
  }

  for (const file of INLINE) {
    it(`${path.basename(file)}: a v3 style sheet behind the flag, on the ramp`, () => {
      const source = read(file)
      expect(source).toContain('useV3Home()')
      const block = styleBlock(source, 'useStylesV3')
      expect(block).toContain('makeStyles(({ v3 })')
      // The current sheet keeps its literal sizes (it is on the lint
      // allowlist); the v3 one takes every size from the ramp.
      expect(block).not.toMatch(/fontSize:\s*\d/)
      expect(block).not.toMatch(/(?<!v3\.)\bcolors\./)
    })
  }

  it('AlertHost: the v3 sheet has every style the host draws with', () => {
    const source = read('components/AlertHost.tsx')
    const keysOf = (block: string): string[] =>
      [...block.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1] ?? '')
    const current = keysOf(styleBlock(source, 'useStyles'))
    const v3 = new Set(keysOf(styleBlock(source, 'useStylesV3')))
    for (const key of current) expect(v3.has(key), key).toBe(true)
  })
})
