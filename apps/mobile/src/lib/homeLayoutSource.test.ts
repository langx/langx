import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * What Home's components promise at their seams, read from the source: the
 * components draw with React Native, which vitest here cannot render, and
 * the arithmetic they lean on is tested where it lives (`columnInner`,
 * `buttonGlyphSize`, `v3TabLabelScale`). These hold the wiring to it.
 */
const MOBILE = path.resolve(__dirname, '../..')
const read = (file: string) => readFileSync(path.join(MOBILE, file), 'utf8')

/** One function's source, from its declaration to the next top-level one. */
function fn(source: string, name: string): string {
  const start = source.search(new RegExp(`^(export )?function ${name}\\b`, 'm'))
  expect(start, `no function ${name}`).toBeGreaterThanOrEqual(0)
  const rest = source.slice(start + 1)
  const next = rest.search(/^(export )?(function|const) /m)
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next)
}

/** Every JSX tag of `name` in `source`, from `<name` to its `/>`. */
function tags(source: string, name: string): string[] {
  return [...source.matchAll(new RegExp(`<${name}\\b[\\s\\S]*?/>`, 'g'))].map((m) => m[0])
}

describe('the guest’s greeting is read in full', () => {
  const home = read('app/(app)/(tabs)/home.tsx')

  it('asks for the whole title on the guest’s Home, and only there', () => {
    expect(tags(fn(home, 'GuestHome'), 'HomeHeader').every((tag) => /\bwhole\b/.test(tag))).toBe(
      true,
    )
    // A member's greeting keeps its two lines at the default size.
    const member = tags(fn(home, 'MemberHome'), 'HomeHeader')
    expect(member.length).toBeGreaterThan(0)
    expect(member.some((tag) => /\bwhole\b/.test(tag))).toBe(false)
  })

  it('cuts the title at two lines only when it is neither stacked nor whole', () => {
    const header = fn(home, 'HomeHeader')
    expect(header).toContain('const balanced = stacked || whole')
    expect(header).toMatch(/\.\.\.\(balanced\s*\?[\s\S]*?:\s*\{ numberOfLines: 2 \}\)/)
  })
})

describe('Today’s three', () => {
  const blocks = read('src/components/home/HomeBlocks.tsx')
  const today = fn(blocks, 'HomeToday')

  it('measures a third of its row against the goals’ words', () => {
    expect(today).toMatch(/columnInner\(\{\s*width,\s*columns: goals\.length,/)
    expect(today).toContain('homeCardsBeside({ stacked, inner: column, words: widths })')
  })

  it('never cuts a goal’s words short', () => {
    expect(today).not.toContain('numberOfLines')
  })
})

describe('the buttons inside Home’s cards grow their glyph with their words', () => {
  const blocks = read('src/components/home/HomeBlocks.tsx')
  for (const card of ['HomeProCard', 'HomeColourCard', 'HomeAccountCard']) {
    it(card, () => {
      const source = fn(blocks, card)
      expect(source).toContain('useGlyphScale()')
      const [button] = tags(source, 'Button')
      expect(button).toContain('glyphScale={glyph}')
      expect(button).toContain('maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}')
    })
  }

  it('Button caps the glyph at its words’ own multiplier', () => {
    expect(read('src/components/ui/Button.tsx')).toMatch(
      /buttonGlyphSize\([\s\S]*?glyphScale,\s*maxFontSizeMultiplier,\s*\)/,
    )
  })
})

describe('Venus’s ▶ shrinks with its card', () => {
  const products = read('src/components/home/HomeProducts.tsx')
  const card = fn(products, 'ProductCard')

  it('hands the card’s press value to the view the ▶ sits in', () => {
    const [face] = tags(card, 'PressableScale')
    expect(face).toContain('pressScale={press}')
    expect(card).toMatch(/<RNAnimated\.View[\s\S]*?transform: \[\{ scale: press \}\]/)
  })

  it('PressableScale runs its face on the value it is handed', () => {
    expect(read('src/components/ui/PressableScale.tsx')).toContain(
      'const scale = pressScale ?? own',
    )
  })
})
