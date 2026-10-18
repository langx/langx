import { describe, expect, it } from 'vitest'
import {
  PARTNER_HUES,
  palettes,
  v3,
  type ColorScheme,
  type PartnerHue,
  type V3Colors,
} from './tokens'

/**
 * Every text colour v3 puts on a ground, measured, in both schemes.
 *
 * WCAG 2's contrast ratio: 4.5:1 for text, 3:1 for large text (24pt, or 19pt
 * bold). Measured here rather than by eye because the two failures that
 * matter look fine on a designer's screen — a pale hue under white text, and
 * a dark-scheme value lifted one step too far.
 *
 * **Add a pair when a screen puts a v3 text token on a ground it was not on
 * before.** The list is the drawings' own pairs; a pair that is not here has
 * not been checked.
 */

type Token = keyof V3Colors | PartnerHue

interface Pair {
  text: Token
  on: Token
  /** Only for text at 24pt, or 19pt bold, and up. */
  large?: true
}

const SCHEMES: ColorScheme[] = ['light', 'dark']

const PAIRS: Pair[] = [
  { text: 'fg', on: 'bg' },
  { text: 'fg', on: 'surface' },
  { text: 'fg', on: 'tabOn' },
  // An initial on a hairline-grey circle; body text in an Echo-tinted card.
  { text: 'fg', on: 'line' },
  { text: 'fg', on: 'echoTint' },
  { text: 'muted', on: 'bg' },
  { text: 'muted', on: 'surface' },
  { text: 'muted', on: 'tabOn' },
  { text: 'echoText', on: 'echoTint' },
  { text: 'echoText', on: 'bg' },
  // A translation, and Home's "cards ready", on the grey block.
  { text: 'echoText', on: 'surface' },
  { text: 'pillText', on: 'pill' },
  { text: 'onYellow', on: 'yellow' },
  // The closest call on the list, at 4.50:1: white on the blue clears the bar
  // by a few hundredths. Any lighter blue, or a lighter label, fails it.
  { text: 'onBlue', on: 'blue' },
  { text: 'correction', on: 'bg' },
  { text: 'correction', on: 'surface' },
  // The paywall's free promise, and the ground on the Pro column's tick.
  { text: 'correction', on: 'correctionTint' },
  { text: 'bg', on: 'correction' },
  // The paywall's cross in the Free column, on a hairline-grey disc.
  { text: 'muted', on: 'line' },
  // The destructive button: a red label in a red outline, on the ground or
  // on the grey block a settings group sits in.
  { text: 'danger', on: 'bg' },
  { text: 'danger', on: 'surface' },
  // A partner's tile carries ink; an ink chip carries the partner's hue.
  ...PARTNER_HUES.flatMap((hue): Pair[] => [
    { text: 'ink', on: hue },
    { text: hue, on: 'ink' },
  ]),
]

function resolve(scheme: ColorScheme, token: Token): string {
  const { colors, hues } = v3[scheme]
  return token in hues ? hues[token as PartnerHue] : colors[token as keyof V3Colors]
}

/** Relative luminance of an sRGB `#rrggbb`. */
function luminance(hex: string): number {
  expect(hex, 'a text pair must be an opaque #rrggbb').toMatch(/^#[0-9a-f]{6}$/i)
  const channel = (at: number): number => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe('v3 text contrast', () => {
  it('measures what it says it measures', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  for (const scheme of SCHEMES) {
    for (const pair of PAIRS) {
      const floor = pair.large ? 3 : 4.5
      it(`${scheme}: ${pair.text} on ${pair.on} reaches ${floor}:1`, () => {
        const ratio = contrast(resolve(scheme, pair.text), resolve(scheme, pair.on))
        expect(ratio).toBeGreaterThanOrEqual(floor)
      })
    }
  }
})

describe('the anchors that do not move with the theme', () => {
  // D3 (b) and (c): the committing yellow and its text are the same colour
  // after dark, in the current look and in v3 — and v3 holds its blue to the
  // same rule.
  it('keeps the current primary and its text identical in both schemes', () => {
    expect(palettes.dark.colors.primary).toBe(palettes.light.colors.primary)
    expect(palettes.dark.colors.primaryText).toBe(palettes.light.colors.primaryText)
  })

  it('keeps v3 yellow, blue and their text identical in both schemes', () => {
    for (const token of ['yellow', 'onYellow', 'blue', 'onBlue'] as const) {
      expect(v3.dark.colors[token], token).toBe(v3.light.colors[token])
    }
  })

  it('puts the same ink on every hue in both schemes', () => {
    expect(v3.dark.colors.ink).toBe(v3.light.colors.ink)
  })
})
