import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles } from '../../lib/theme'
import { IconButton } from '../ui/IconButton'

/**
 * The top of every Echo page under `flags.v3Home` (`V-EchoCards`, `V-EchoCard`,
 * `V-EchoEdit` and the rest): the back chevron with the page's own controls
 * at the far end of its row, the big title under them, and a quiet line after
 * the title where the drawing has one — "214 cards", "Who has answered the
 * most cards".
 *
 * Settings' header (`SettingsHeaderV3`) is the same back-over-title, but it
 * has no place for a control beside the chevron, and these pages do: New card,
 * Select, Edit, Export.
 */
export function EchoHeaderV3({
  title,
  onBack,
  trailing,
  meta,
  below,
}: {
  title: string
  onBack: () => void
  /** The page's controls, at the end of the chevron's row. */
  trailing?: ReactNode
  /** Beside the title on its baseline: a count. */
  meta?: string | undefined
  /** Under the title, on its own line. */
  below?: string | undefined
}) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  return (
    <View style={styles.header}>
      <View style={styles.bar}>
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          onPress={onBack}
        />
        <View style={styles.trailing}>{trailing}</View>
      </View>
      <View style={styles.titleRow}>
        <Text
          accessibilityRole="header"
          style={[styles.title, !blackLoaded && styles.titleFallback]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {below ? <Text style={styles.below}>{below}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // Pulled into the gutter so the chevron's ink, not its target, lines up
  // with the title under it — as Settings' header does.
  header: { gap: v3.space[2], marginStart: -v3.space[10], paddingBottom: v3.space[6] },
  bar: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  trailing: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[6],
    justifyContent: 'flex-end',
  },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: v3.space[10],
    paddingStart: v3.space[10],
  },
  title: { ...v3.type.title, color: v3.colors.fg, flexShrink: 1 },
  // ExtraBold at Black's size until Black has loaded, so the title only
  // thickens when the face arrives instead of reflowing.
  titleFallback: { fontFamily: DISPLAY_FONT },
  meta: { ...v3.type.callout, color: v3.colors.muted },
  below: { ...v3.type.callout, color: v3.colors.muted, paddingStart: v3.space[10] },
}))
