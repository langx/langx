import { LANGUAGE_LEVELS, levelRank, type LanguageLevel } from '@langx/shared'
import { View } from 'react-native'
import { useV3Home } from '../../hooks/useV3Home'
import { makeStyles, useTheme } from '../../lib/theme'

interface LevelBarsProps {
  level: LanguageLevel
  /**
   * Fifth bar for a native language: the four learning levels top out at four
   * bars, and "teaches" on a profile draws one more to say this is home turf.
   */
  native?: boolean
  /** Bar colour for the filled steps; defaults to `accent` (v3: `fg`). */
  color?: string
  /** Colour for the unfilled steps; defaults to `border` (v3: `track`). */
  restColor?: string
  size?: number
}

/**
 * v3's level glyph: ascending 4px bars, filled up to the level. It replaces
 * the level *words* in rows and chips — the bars say "how well" at a glance in
 * any locale, and the words stay available where there is room for them.
 */
export function LevelBars({ level, native = false, color, restColor, size = 14 }: LevelBarsProps) {
  const { colors, v3 } = useTheme()
  const styles = useStyles()
  const v3Look = useV3Home()

  const bars = native ? 5 : 4
  const filled = native ? 5 : levelRank(level)
  // The redesign draws the bars in ink on a quiet track (V-EditProfile):
  // blue is held to one use a screen there, and a row of level
  // glyphs would spend it on decoration. Callers that pass a colour keep it.
  const on = color ?? (v3Look ? v3.colors.fg : colors.accent)
  const off = restColor ?? (v3Look ? v3.colors.track : colors.border)

  // Heights ascend 5→size in even steps, matching the design's 5/8/11/14(/17).
  const step = (size - 5) / (bars - 1)

  return (
    <View style={[styles.row, { height: size }]} accessibilityElementsHidden>
      {Array.from({ length: bars }, (_, i) => (
        <View
          key={i}
          style={[styles.bar, { backgroundColor: i < filled ? on : off, height: 5 + step * i }]}
        />
      ))}
    </View>
  )
}

/** Levels in rank order, for controls that iterate the scale. */
export const LEVEL_SCALE = LANGUAGE_LEVELS

const useStyles = makeStyles(() => ({
  row: { alignItems: 'flex-end', flexDirection: 'row', gap: 2 },
  bar: { borderRadius: 2, width: 4 },
}))
