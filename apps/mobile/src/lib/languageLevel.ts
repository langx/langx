import type { LanguageLevel } from '@langx/shared'

/**
 * The icon that stands in for a level on a profile, so the level is shown
 * rather than spelled out.
 *
 * These are v1's icons, level for level: it drew `battery-dead`, `-half`,
 * `-full` and `rocket` for its numeric 0–3, and `V1_LEVEL_TO_LANGUAGE_LEVEL`
 * maps those same four numbers onto these four levels. A returning user sees
 * the metaphor they already learned.
 *
 * Ionicons names, but typed as strings on purpose — this file is under
 * `src/lib` so that vitest can load it, and vitest cannot resolve
 * `react-native`, which `@expo/vector-icons` imports.
 */
export const LEVEL_ICON = {
  absoluteBeginner: 'battery-dead-outline',
  beginner: 'battery-half-outline',
  intermediate: 'battery-full-outline',
  fluent: 'rocket-outline',
} as const satisfies Record<LanguageLevel, string>
