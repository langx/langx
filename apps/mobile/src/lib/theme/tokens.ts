import type { TextStyle, ViewStyle } from 'react-native'

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
  /**
   * The tick beside an official account's name. A warmer yellow than `streak`
   * so the two do not read as the same badge on a profile that shows both —
   * and not `accent`, because a blue tick is another product's mark.
   */
  official: '#f5b400',
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
  /** Under the one red button, the way `primaryShade` sits under the yellow one. */
  dangerShade: '#b83236',

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
  /**
   * The ground of the call screen: opaque, and the same near-black in both
   * schemes. A scrim lets the thread show through behind a face, which on a
   * call reads as a screen that did not finish opening.
   */
  stage: '#0d0f12',
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
  official: '#ffc933',
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
  // The same in both schemes: a shadow is under the button, and dark mode's
  // lifted red would read as a second, lighter face rather than as depth.
  dangerShade: '#b83236',

  knob: '#ffffff',

  scrim: 'rgba(0, 0, 0, 0.45)',
  scrimStrong: 'rgba(0, 0, 0, 0.94)',
  onScrim: '#ffffff',
  stage: '#0d0f12',
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
/** `xxl` is the sheet's top corners; nothing smaller than a sheet is that round. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, xxl: 28, pill: 999 } as const

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

export const layout = {
  maxWidth: 720,
  avatar: 48,
  avatarLarge: 96,
} as const

/*
 * ---------------------------------------------------------------------------
 * v3 — the redesign's tokens (ships with app 3.0)
 * ---------------------------------------------------------------------------
 *
 * Everything above is the current look and stays exactly as it is until the
 * screen that reads it is migrated: a screen changes look only in the PR that
 * moves it, so the two sets live side by side and nothing here renames,
 * re-values or removes a current token. Read these as `theme.v3.*`.
 *
 * Not the "v3" the comments above mean. Those name the drawing the current
 * look came from; since 16 October 2026 "v3" names the redesign, and the
 * look above is "the current look".
 *
 * Phase 1 chose flat colour blocks, a colour per partner, big Nunito type and
 * flat pill buttons with no shadows (see _The redesign is v3: A's structure,
 * B's look_ in `docs/decisions.md`). The values are the design canvas's own,
 * so a migrating PR can match a drawing by eye without a conversion table.
 *
 * The app's palette may now leave the website's (_Client — the app's palette
 * may leave the website's, and yellow still does not move_). Two anchors do
 * not move:
 * `yellow` and its text are identical in both schemes and appear once per
 * screen, on the committing action — and v3 holds `blue` to the same rule, so
 * the main action that does not commit is the same blue after dark too.
 */

const v3LightColors = {
  bg: '#ffffff',
  fg: '#14161b',
  muted: '#5a5f69',
  /** The grey block: a row group, a search field, an unselected tab pill. */
  surface: '#f2f2ee',
  line: '#e4e4df',
  /** The selected tab's pill. */
  tabOn: '#e8e7e1',
  /** Echo's tab and Echo's own surfaces: set apart by tint, never by size. */
  echoTint: '#e3ebfe',
  echoText: '#2a54d0',
  /** The ink pill — Correct, a selected chip. Inverts with the ground. */
  pill: '#14161b',
  pillText: '#ffffff',
  /**
   * Text on a partner hue, and the ground of a hue-lettered chip. Constant in
   * both schemes, unlike the current look's `ink`: the hues are light in both
   * schemes, so what reads on them does not change when the ground does.
   */
  ink: '#14161b',
  /**
   * A fill, not a text colour. As text it clears 4.5:1 only on the white
   * ground — on the dark ground it falls under, which is the price of keeping
   * it the same in both schemes, and on `surface` or `echoTint` it fails in
   * light too. Text that should read as blue is `echoText`.
   */
  blue: '#3b6cf6',
  onBlue: '#ffffff',
  yellow: '#ffc409',
  onYellow: '#14161b',
  /** A correction's green, as text on the ground. */
  correction: '#0b7a3e',
  /**
   * The destructive action's red — Delete account, Sign out everywhere —
   * drawn as the outline and the label on the ground, never as a fill: a red
   * block would be the loudest thing on the screen, and the action that
   * cannot be undone should not be the one the eye lands on. Darker than the
   * current look's `danger`, which as text falls under 4.5:1 on white.
   */
  danger: '#c0281b',
  /**
   * The one elevation v3 keeps. Tinted with the ground in light, where pure
   * black over white reads as a hole; deeper in dark, where a light scrim
   * would do nothing over a ground that is already near-black.
   */
  scrim: 'rgba(12, 13, 16, 0.55)',
} as const

export type V3Colors = { readonly [K in keyof typeof v3LightColors]: string }

const v3DarkColors: V3Colors = {
  bg: '#0c0d10',
  fg: '#f2f3f5',
  muted: '#a3a8b3',
  surface: '#1a1c21',
  line: '#2a2d33',
  tabOn: '#2a2d33',
  echoTint: '#1c2748',
  echoText: '#8aa6ff',
  pill: '#f2f3f5',
  pillText: '#14161b',
  ink: '#14161b',
  blue: '#3b6cf6',
  onBlue: '#ffffff',
  yellow: '#ffc409',
  onYellow: '#14161b',
  correction: '#5ee39a',
  danger: '#ff8a80',
  scrim: 'rgba(0, 0, 0, 0.7)',
}

/**
 * The six partner hues, in the order `partnerHueFor` indexes them.
 *
 * **The order and the length are part of every partner's identity.** A hue
 * is picked from an id by its position here, so reordering the list, or
 * adding a seventh, re-colours every partner someone already knows by colour.
 * Change it only with a decision that says so.
 */
export const PARTNER_HUES = ['lilac', 'aqua', 'mint', 'lime', 'sky', 'tangerine'] as const
export type PartnerHue = (typeof PARTNER_HUES)[number]

/** Always `ink` on top, in both schemes: the dark set is a step deeper, not inverted. */
const v3Hues: Record<ColorScheme, Readonly<Record<PartnerHue, string>>> = {
  light: {
    lilac: '#bba4ff',
    aqua: '#48d3d0',
    mint: '#5fdc98',
    lime: '#b8e15c',
    sky: '#74b9ff',
    tangerine: '#ff9f52',
  },
  dark: {
    lilac: '#a68cf5',
    aqua: '#2fbfbc',
    mint: '#45c883',
    lime: '#a2cf45',
    sky: '#5aa5f5',
    tangerine: '#f08a3c',
  },
}

/**
 * The heaviest Nunito, for v3's Display and Title.
 *
 * **Not loaded at the root yet.** The root layout's `useFonts` holds the
 * splash until every font in it arrives, and no shipped screen uses this one,
 * so loading it there would make every cold web start wait for a font nobody
 * sees. The design gallery loads it for itself. The first screen that moves
 * onto Display or Title adds `Nunito_900Black` to the root `useFonts` in
 * `app/_layout.tsx` in the same PR — a family named but not loaded falls back
 * to the platform face without a word, so a migrated screen would look
 * finished and be in the wrong font.
 */
export const DISPLAY_FONT_BLACK = 'Nunito_900Black'

/**
 * The v3 type ramp. Nunito carries display, title, headline and label; body,
 * callout and caption keep the platform face, for the reason `DISPLAY_FONT`
 * gives — reading text here is often in someone's second language.
 *
 * Body is 17 and nothing a person reads is under 12, so the floor holds at
 * the default text size before Dynamic Type adds anything. Every step names
 * its line height: a ramp without them leaves each screen to guess, and at
 * 200% text a guessed line height is what clips the descenders.
 *
 * The Nunito steps carry no `fontWeight`. The family name already is the
 * weight, and the web build registers each family as one normal-weight face,
 * so a weight on top asks the browser to embolden a face that is already
 * black.
 */
export const v3Type = {
  display: { fontFamily: DISPLAY_FONT_BLACK, fontSize: 44, lineHeight: 46, letterSpacing: -0.5 },
  title: { fontFamily: DISPLAY_FONT_BLACK, fontSize: 32, lineHeight: 36 },
  headline: { fontFamily: DISPLAY_FONT, fontSize: 22, lineHeight: 28 },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontFamily: DISPLAY_FONT, fontSize: 13, lineHeight: 16 },
  /**
   * A button's label, in sentence case. A point under the drawings' 18, so a
   * German or Russian label still fits a half-width pill on a 390pt phone
   * before it has to wrap; and ExtraBold rather than their Black, because the
   * button is on the launch path and Black is not loaded there (see
   * `DISPLAY_FONT_BLACK`).
   */
  button: { fontFamily: DISPLAY_FONT, fontSize: 17, lineHeight: 22 },
  /** The small pill's label: a row-end action, a price in the token store. */
  buttonSmall: { fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 20 },
} as const satisfies Record<string, TextStyle>

export type V3TypeStep = keyof typeof v3Type

/**
 * Keyed by the value, deliberately. The drawings are measured in points, and
 * a key that says the number is one a migrating PR can match against a
 * drawing without a lookup table; the type still refuses a value that is not
 * on the scale. The half steps (6, 10, 14) are here because the drawings use
 * them more than some of the whole ones — 10 is their commonest gap.
 */
export const v3Space = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  /** The screen's side gutter. */
  16: 16,
  20: 20,
  24: 24,
  32: 32,
} as const

/**
 * The drawings pick a corner by how tall the block is, so the middle steps
 * are named for the size of thing that carries them.
 */
export const v3Radius = {
  /** The 40pt leading square in a row. */
  icon: 12,
  /** A block 56–68pt tall standing on its own — a field, a single row. */
  row: 18,
  /** A tile about 100pt tall. */
  card: 20,
  /** A tile — a partner card, a stat. */
  tile: 22,
  /** An 80pt badge square, and cards 80–120pt tall. */
  badge: 24,
  /** A full-width block — the next-step card, a sheet's top corners. */
  block: 28,
  /** The one big hero block on a screen. */
  hero: 32,
  pill: 999,
} as const

/** Glyph sizes. The touch target around a glyph is a separate, larger number. */
export const v3Icon = {
  /** Inside a chip, or beside a number. */
  xs: 16,
  /** Inside a 30pt circle. */
  sm: 18,
  /** A secondary pill's glyph, a row's trailing mark. */
  md: 20,
  /** A primary button's glyph, a row's leading glyph. */
  lg: 22,
  /** The tab bar's glyphs. */
  xl: 24,
  /** Header chrome — back, close. */
  xxl: 26,
} as const

/**
 * v3 is flat: depth comes from colour, not shadow. These are the only two
 * levels it draws — a plane with nothing under it, and the scrim that puts a
 * sheet or a dialog in front of the screen.
 */
export interface V3Elevation {
  none: ViewStyle
  overlay: ViewStyle
}

function v3Elevation(colors: V3Colors): V3Elevation {
  return {
    none: { elevation: 0, shadowOpacity: 0 },
    overlay: { backgroundColor: colors.scrim },
  }
}

export interface V3Tokens {
  colors: V3Colors
  hues: Readonly<Record<PartnerHue, string>>
  type: typeof v3Type
  space: typeof v3Space
  radius: typeof v3Radius
  icon: typeof v3Icon
  elevation: V3Elevation
}

const v3Shared = { type: v3Type, space: v3Space, radius: v3Radius, icon: v3Icon } as const

export const v3: Record<ColorScheme, V3Tokens> = {
  light: {
    ...v3Shared,
    colors: v3LightColors,
    hues: v3Hues.light,
    elevation: v3Elevation(v3LightColors),
  },
  dark: {
    ...v3Shared,
    colors: v3DarkColors,
    hues: v3Hues.dark,
    elevation: v3Elevation(v3DarkColors),
  },
}
