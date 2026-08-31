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
 * The palette is **v3's** (`LangX Mobile v3.dc.html` and its dark twin): plain
 * lists on a white ground, hairline dividers instead of cards, one blue for
 * everything interactive, and yellow exactly once per screen — the committing
 * action. Consume these through `useTheme()` / `makeStyles()` in `lib/theme/`,
 * never by importing a palette directly — a palette read at module scope
 * freezes one scheme into the StyleSheet at import time, which is exactly what
 * stopped dark mode existing before.
 */
export type ColorScheme = 'light' | 'dark'

const lightColors = {
  /**
   * The screen behind everything. v3 has no card layer: the ground *is* the
   * surface, and structure comes from dividers and whitespace, not boxes.
   */
  bg: '#ffffff',
  /** v3 gives the feed the same white ground as every other screen. */
  feedBg: '#ffffff',
  /** Sheets, the tab bar, the compose bar — same plane as `bg` in v3. */
  surface: '#ffffff',
  /**
   * The one grey that is allowed to be a box: search fields, segmented-control
   * tracks, the other person's chat bubble, photo placeholders. Everything the
   * old palette drew as `surface`-on-`border` is either a plain row now or one
   * of these.
   */
  fill: '#f4f5f7',
  border: '#e8eaec',
  text: '#17191c',
  /** Secondary text, captions, meta. */
  textMuted: '#62676d',
  /** Placeholder, disabled, tertiary meta. */
  textFaint: '#9aa1a7',
  /**
   * Text on a saturated or ink fill — an avatar initial, a selected chip.
   * Near-white in both schemes because v3's fills stay dark enough to want it;
   * the exception is the ink chip, which uses `bg` for its label.
   */
  textInverse: '#fefefe',
  /**
   * The ink fill: v3's selected chip, the level pills, the dark send button on
   * a public profile. `text` used as a background, named so call sites say
   * what they mean. Its label colour is `bg`.
   */
  ink: '#17191c',
  /**
   * The unfilled half of a glyph drawn *on* `ink` — the empty level bars in a
   * selected pill. Neutral grey at 45% rather than a palette colour, and the
   * same value in both schemes: it has to read as "off" against a fill that is
   * near-black in light and near-white in dark, and only a mid grey does that
   * from both sides.
   */
  onInkMuted: 'rgba(128, 128, 128, 0.45)',

  /**
   * The committing action — Continue, Send correction, Apply.
   *
   * Deliberately identical in both schemes, and so is `primaryText`. The one
   * control that commits should not change colour when the theme does; a user
   * who has learned "the yellow one sends it" should not have to relearn that
   * after dark. v3 tightens the rule: yellow appears exactly once per screen.
   */
  primary: '#ffc409',
  primaryShade: '#e0ac08',
  primaryText: '#201900',
  /** Meta on top of `primary` — the balance card's caption. */
  primaryTextMuted: 'rgba(32, 25, 0, 0.55)',

  /**
   * v3 retires the orange: the second action — Reset, + Ask, "Change photo" —
   * is plain `accent` text. The token stays so call sites keep reading
   * "second action", but it now points at the same blue.
   */
  secondary: '#3b6cf6',
  /** Language pairs, level bars, active tab, toggles-on, links, progress. */
  accent: '#3b6cf6',
  /** The soft blue tint: your own bubble, the Copilot panel, info callouts. */
  accentBg: '#e9f0fe',
  streak: '#f79009',
  pro: '#7a5af8',
  /**
   * Deliberately the same hue family as `pro`, only deeper. Pro+ is a superset
   * of Pro, not a different product. v3 draws PRO chips as neutral outlines,
   * but the paywall and tier badge still need the brand colour.
   */
  proPlus: '#5b21b6',

  /**
   * The callout pairs, used semantically and not decoratively.
   *
   * Corrections and Copilot are the two voices in the core loop and must never
   * be mistaken for each other: a correction is always the green pair, a
   * Copilot suggestion always the blue one (`info` === `accent` in v3 — blue
   * carries everything interactive, including the machine's voice).
   */
  successBg: '#e2f6ee',
  success: '#009f70',
  infoBg: '#e9f0fe',
  info: '#3b6cf6',
  /** Streak milestones and level chips. */
  warningBg: '#fff6b6',
  warning: '#c87820',
  /** Empty states, unread counts, delete, negative ledger rows. */
  dangerBg: '#fdecec',
  danger: '#e5484d',

  /**
   * The toggle knob, which stays white in **both** schemes. A knob painted
   * `surface` sits on a `border`-coloured track in dark and has no contrast
   * left to read as a knob at all.
   */
  knob: '#ffffff',

  /**
   * Scrims are the same in both schemes and deliberately not derived from the
   * palette. A scrim's job is to put distance between a sheet and what is
   * behind it; tinting it with the ground would make it do less of that in
   * exactly the scheme where the sheet and the ground are already close.
   */
  scrim: 'rgba(0, 0, 0, 0.45)',
  /** The photo lightbox, which is a viewer rather than an overlay. */
  scrimStrong: 'rgba(0, 0, 0, 0.94)',
  /** Chrome drawn on a scrim — always white, because a scrim is always dark. */
  onScrim: '#ffffff',
} as const

export type ThemeColors = { readonly [K in keyof typeof lightColors]: string }

const darkColors: ThemeColors = {
  bg: '#1c1f24',
  feedBg: '#1c1f24',
  surface: '#1c1f24',
  fill: '#23272d',
  border: '#2c3036',
  text: '#f2f3f5',
  textMuted: '#9aa1a9',
  textFaint: '#70767e',
  textInverse: '#fefefe',
  /** Ink inverts with the ground: a near-white fill with `bg`-coloured label. */
  ink: '#f2f3f5',
  onInkMuted: 'rgba(128, 128, 128, 0.45)',

  primary: '#ffc409',
  primaryShade: '#e0ac08',
  primaryText: '#201900',
  primaryTextMuted: 'rgba(32, 25, 0, 0.55)',

  secondary: '#7c9cf9',
  accent: '#7c9cf9',
  accentBg: '#202b45',
  streak: '#ffa93d',
  pro: '#9b83ff',
  /**
   * Lighter than `pro` here, where light mode's is darker. The rule is not
   * "deeper" literally, it is "further from the ground than Pro" — which
   * inverts with the ground.
   */
  proPlus: '#c9b8ff',

  successBg: '#16332a',
  success: '#34c796',
  infoBg: '#202b45',
  info: '#7c9cf9',
  warningBg: '#724413',
  warning: '#ffca39',
  dangerBg: '#3a2023',
  danger: '#ef6b6f',

  knob: '#ffffff',

  scrim: 'rgba(0, 0, 0, 0.45)',
  scrimStrong: 'rgba(0, 0, 0, 0.94)',
  onScrim: '#ffffff',
}

/**
 * v3's shadow is much quieter than v2's — 6% black — because almost nothing
 * floats any more; only sheets, the segmented thumb and the committing button
 * carry one. Same geometry in dark at higher opacity, since a 6% black shadow
 * is invisible on a `#1c1f24` ground.
 */
const lightShadow: ViewStyle = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
}

const darkShadow: ViewStyle = { ...lightShadow, shadowOpacity: 0.4, elevation: 4 }

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
 * Nunito replaced Comfortaa in v3. Same rule, friendlier face: the display
 * weight carries titles, buttons, names and the big numerals; body text keeps
 * the platform stack, because body text here is often someone's second
 * language and a display face at 13px is a legibility tax.
 */
export const DISPLAY_FONT = 'Nunito_800ExtraBold'
/** The in-between weight — row titles that lead, chart annotations. */
export const DISPLAY_FONT_BOLD = 'Nunito_700Bold'

export const font = {
  /** Screen titles. v3 runs these big — 30 on onboarding, 34 on tab roots. */
  title: { fontSize: 30, fontWeight: '800', fontFamily: DISPLAY_FONT },
  heading: { fontSize: 20, fontWeight: '800', fontFamily: DISPLAY_FONT },
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
/**
 * A frame's ring colour, per tone, per scheme.
 *
 * The only place a cosmetic hex lives. `packages/shared` names the tone and
 * cannot know the scheme — the same frame has to read on white and on near
 * black, and a metallic especially does not survive being used unchanged on
 * both. Dark values are lifted rather than inverted: a frame is jewellery, and
 * it should stay the colour it was sold as.
 */
export const frameColors = {
  light: {
    slate: '#8a9199',
    bronze: '#a9713e',
    silver: '#9aa3ab',
    gold: '#d4a017',
    sky: '#3b8ef6',
    mint: '#12a37a',
    ember: '#e2662c',
    violet: '#7a5af8',
    midnight: '#2b3350',
    aurora: '#12b5a8',
  },
  dark: {
    slate: '#9aa1a9',
    bronze: '#c98c53',
    silver: '#c2c9d0',
    gold: '#f0bd3a',
    sky: '#7cb0f9',
    mint: '#34c796',
    ember: '#ff8a52',
    violet: '#9b83ff',
    midnight: '#7d8ac4',
    aurora: '#42d8c8',
  },
} as const

export const layout = { maxWidth: 720, avatar: 48, avatarLarge: 96 } as const
