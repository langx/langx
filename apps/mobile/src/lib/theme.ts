/**
 * Design tokens, not a styling library.
 *
 * The plan named NativeWind v4, but Faz 1's screens were built with
 * StyleSheet and its `Button`/`FormField` are in that idiom. Introducing
 * NativeWind now would mean rewriting working screens plus a babel/metro
 * change, to buy consistency with a decision the codebase had already
 * departed from. Consistency with what exists wins; these tokens give the
 * shared vocabulary that was the real point.
 */
export const colors = {
  bg: '#ffffff',
  surface: '#f6f6f7',
  border: '#e3e3e6',
  text: '#111113',
  textMuted: '#6b6b73',
  primary: '#111113',
  primaryText: '#ffffff',
  accent: '#3b6cf6',
  danger: '#d92d20',
  success: '#12864b',
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
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const

export const font = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
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
