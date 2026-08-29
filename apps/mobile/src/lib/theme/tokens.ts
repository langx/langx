import type { ViewStyle } from 'react-native'

/**
 * Design tokens, not a styling library.
 *
 * The plan named NativeWind v4, but Faz 1's screens were built with
 * StyleSheet and its `Button`/`FormField` are in that idiom. Introducing
 * NativeWind now would mean rewriting working screens plus a babel/metro
 * change, to buy consistency with a decision the codebase had already
 * departed from. Consistency with what exists wins; these tokens give the
 * shared vocabulary that was the real point.
 *
 * The palette is the **website's**, not a second one invented for the app:
 * `website/src/lib/scss/_themes.scss` is upstream of both. A claim rendered in
 * the app and the same claim rendered on langx.io should not be two different
 * yellows. Consume these through `useTheme()` / `makeStyles()` in
 * `lib/theme/`, never by importing a palette directly — a palette read at
 * module scope freezes one scheme into the StyleSheet at import time, which is
 * exactly what stopped dark mode existing before.
 */
export type ColorScheme = 'light' | 'dark'

const lightColors = {
  /** The screen behind everything. `page-background`. */
  bg: '#f4f8fb',
  /**
   * The feed's own ground, a half-step cooler than `bg` (`post-page-background`).
   * The feed is a wall of cards and nothing else; giving it a distinct ground
   * is what stops it reading as one undifferentiated sheet.
   */
  feedBg: '#f3fbfc',
  /** Cards, sheets, the tab bar, the compose bar. */
  surface: '#ffffff',
  border: '#e3e3e6',
  text: '#000000',
  /** Secondary text, captions, meta. `text-shade`. */
  textMuted: '#5d5f65',
  /** Placeholder, disabled, tertiary meta. `text-inverse-shade`. */
  textFaint: '#9eb4b5',
  /**
   * Text on a saturated fill that is *not* `primary` — a filled chip, the
   * deletion banner. It flips with the scheme because the accents do: light
   * mode's are saturated and want white on them, dark mode's are pastel and
   * want black.
   */
  textInverse: '#ffffff',

  /**
   * The committing action — Continue, Send correction, Apply — plus your own
   * chat bubble, on-state toggles and the balance card.
   *
   * Deliberately identical in both schemes, and so is `primaryText`. The one
   * control that commits should not change colour when the theme does; a user
   * who has learned "the yellow one sends it" should not have to relearn that
   * after dark. Everything else moves to its dark counterpart.
   */
  primary: '#ffc409',
  primaryShade: '#e0ac08',
  primaryText: '#000000',
  /**
   * Meta on top of `primary` — timestamps and read ticks, which only ever
   * appear on your own bubble. Black at half strength rather than a lifted
   * blue: v1's `read` had to clear a near-black bubble, and the bubble is
   * yellow now, so the contrast problem it solved no longer exists.
   */
  primaryTextMuted: 'rgba(0, 0, 0, 0.5)',

  /** The second action — Reset, Ask — and the text caret. */
  secondary: '#ff571a',
  /** Language pairs, the active tab, voice notes, the messages series. */
  accent: '#3b6cf6',
  streak: '#f79009',
  pro: '#7a5af8',
  /**
   * Deliberately the same hue family as `pro`, only deeper. Pro+ is a superset
   * of Pro, not a different product, and giving it an unrelated colour would
   * read as two separate things to choose between rather than one being more
   * than the other. Deep enough to stay legible as text on `bg`, which the
   * lighter `pro` only just manages.
   */
  proPlus: '#5b21b6',

  /**
   * The four callout pairs, used semantically and not decoratively.
   *
   * Corrections and Copilot are the two voices in the core loop and must never
   * be mistaken for each other, so each owns one pair outright: a correction is
   * always `success`, a Copilot suggestion is always `info`, and neither colour
   * appears in the other's role anywhere in the app.
   */
  successBg: '#dcf7ec',
  success: '#009f70',
  infoBg: '#dfeffd',
  info: '#2883f4',
  /** Streak milestones and level chips. */
  warningBg: '#fff6b6',
  warning: '#c87820',
  /** Empty states, unread counts, delete, negative ledger rows. */
  dangerBg: '#ffe8e8',
  danger: '#f95256',

  /**
   * The toggle knob, which stays white in **both** schemes. A knob painted
   * `surface` sits on a `border`-coloured track in dark and has no contrast
   * left to read as a knob at all.
   */
  knob: '#ffffff',
} as const

export type ThemeColors = { readonly [K in keyof typeof lightColors]: string }

const darkColors: ThemeColors = {
  bg: '#1c1e26',
  feedBg: '#141519',
  surface: '#32343e',
  border: '#43454f',
  text: '#ffffff',
  textMuted: '#9eb4b5',
  textFaint: '#5d5f65',
  textInverse: '#000000',

  primary: '#ffc409',
  primaryShade: '#e0ac08',
  primaryText: '#000000',
  primaryTextMuted: 'rgba(0, 0, 0, 0.5)',

  secondary: '#ff723f',
  accent: '#7ba0ff',
  streak: '#ffa93d',
  pro: '#9b83ff',
  /**
   * Lighter than `pro` here, where light mode's is darker. The rule is not
   * "deeper" literally, it is "further from the ground than Pro" — which
   * inverts with the ground. `#5b21b6` on `#1c1e26` is barely a colour.
   */
  proPlus: '#c9b8ff',

  successBg: '#004737',
  success: '#00c48f',
  infoBg: '#1d3874',
  info: '#6ca9f7',
  warningBg: '#724413',
  warning: '#ffca39',
  dangerBg: '#7c1d20',
  danger: '#ff8082',

  knob: '#ffffff',
}

/**
 * Same geometry in both schemes; only the opacity moves. A 10% black shadow is
 * invisible on a `#1c1e26` ground, so dark carries the same shape at half
 * strength instead of dropping elevation altogether.
 */
const lightShadow: ViewStyle = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 3,
}

const darkShadow: ViewStyle = { ...lightShadow, shadowOpacity: 0.5, elevation: 6 }

export const palettes: Record<ColorScheme, { colors: ThemeColors; cardShadow: ViewStyle }> = {
  light: { colors: lightColors, cardShadow: lightShadow },
  dark: { colors: darkColors, cardShadow: darkShadow },
}

/**
 * The palette's scale is `3xs 4 · 2xs 8 · xs 12 · sm 16 · md 24 · lg 32 · xl 48`.
 * These are the same numbers under the names the app already uses — renaming
 * every step across ~46 files to land on identical values would be churn with
 * no output. Only `xxxl` (the palette's `xl`) is new.
 */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const

/**
 * Comfortaa is **display only** — titles, buttons, and the big numerals in stat
 * tiles. That is the palette's own instruction and it is a legibility call, not
 * a stylistic one: Comfortaa's round, wide letterforms are lovely at 27px and
 * tiring at 13px, and body text here is often someone's second language.
 * Everything below `heading` deliberately keeps the platform stack.
 */
export const DISPLAY_FONT = 'Comfortaa_700Bold'

export const font = {
  title: { fontSize: 28, fontWeight: '700', fontFamily: DISPLAY_FONT },
  heading: { fontSize: 20, fontWeight: '700', fontFamily: DISPLAY_FONT },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const

/**
 * The app is one codebase across phone and browser. `maxWidth` keeps a wide
 * desktop window from stretching a chat bubble across 2000px, which is the
 * single biggest thing that makes an Expo web build look like a phone app
 * someone forgot to finish.
 */
export const layout = { maxWidth: 720, avatar: 48, avatarLarge: 96 } as const
