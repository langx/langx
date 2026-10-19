import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Platform, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { PressableScale } from './PressableScale'

type Look = 'plain' | 'surface' | 'ink' | 'hue'

interface IconButtonProps {
  icon: keyof typeof Feather.glyphMap
  /**
   * Required: a glyph has no words of its own, and a button a screen reader
   * can only call "button" is a button nobody using one can find.
   */
  accessibilityLabel: string
  onPress: () => void
  /**
   * `plain` is the bare glyph on the ground — back, close, the corner
   * controls. `surface` sits it in the grey disc, `ink` in the dark one, for
   * a glyph that has to read as a control on a busy block. `hue` is the dark
   * disc on a partner's colour — ink in both schemes, as everything on a hue
   * is, where `ink` inverts with the ground and would go pale after dark.
   */
  look?: Look
  /** The glyph. Header chrome's 26 unless the drawing says otherwise. */
  iconSize?: number
  /** The glyph's colour on `plain`. The two discs set their own. */
  color?: string
  disabled?: boolean
  hitSlop?: PressableProps['hitSlop']
  /** For an action whose result is not obvious from the glyph. */
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  /** Drawn over the glyph — a count on the bell. */
  children?: ReactNode
}

/**
 * The target, not the glyph: 44pt on iOS and 48dp on Android, the minimum
 * each platform asks for. The glyph sits in the middle of it.
 */
export const ICON_BUTTON_TARGET = Platform.select({ android: 48, default: 44 })

/**
 * A glyph is small enough that a button's 3% shrink would not show on it, so
 * a glyph shrinks further.
 */
const GLYPH_PRESS_SCALE = 0.88

/**
 * A control that is only a glyph: back, close, the bell, the ≡. Its target is
 * the platform minimum however small the glyph, and it always has a name for
 * a screen reader — the type will not let it be drawn without one.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  look = 'plain',
  iconSize,
  color,
  disabled = false,
  hitSlop,
  accessibilityHint,
  style,
  children,
}: IconButtonProps) {
  const { v3 } = useTheme()
  const styles = useStyles()
  const glyphColor =
    look === 'ink'
      ? v3.colors.pillText
      : look === 'hue'
        ? // The palette's one white that stays white after dark.
          v3.colors.onBlue
        : look === 'surface'
          ? v3.colors.fg
          : (color ?? v3.colors.fg)

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      {...(hitSlop !== undefined ? { hitSlop } : {})}
      scaleTo={GLYPH_PRESS_SCALE}
      touchStyle={style}
      style={[
        styles.target,
        look === 'surface' && styles.surface,
        look === 'ink' && styles.ink,
        look === 'hue' && styles.hue,
        disabled && styles.disabled,
      ]}
    >
      <Feather name={icon} size={iconSize ?? v3.icon.xxl} color={glyphColor} />
      {children}
    </PressableScale>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  target: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  surface: { backgroundColor: v3.colors.surface },
  ink: { backgroundColor: v3.colors.pill },
  hue: { backgroundColor: v3.colors.ink },
  disabled: { opacity: 0.4 },
}))
