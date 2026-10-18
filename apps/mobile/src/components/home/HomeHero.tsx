import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'

type Glyph = keyof typeof Feather.glyphMap

/** What the hero draws, worked out by the screen from `planHome`'s answer. */
export interface HomeHeroView {
  /**
   * The block's colour. A person's hue for anything about a person, Echo's
   * tint for Echo, the streak's tangerine for the streak — the colour says
   * what kind of next step it is before the words do.
   */
  ground: string
  /**
   * Whether the ground is one of the partner hues, which are light in both
   * schemes and always carry ink; Echo's tint flips with the scheme and
   * carries the ordinary text colour.
   */
  onHue: boolean
  /** A face for a person; a glyph in a disc for everything else. */
  avatar?: { url?: string | undefined; name: string; seed: string }
  glyph?: Glyph
  title: string
  meta?: string
  /** A short ink chip at the row's end — "Your turn". */
  chip?: string
  /** Their last words, quoted, when there are any to quote. */
  quote?: string
  action: { label: string; icon: Glyph; onPress: () => void }
}

/**
 * The next step: one block, one yellow button — the screen's only yellow.
 *
 * Drawn from `V-Home`'s first card. Everything above the button is read, not
 * pressed; the button is the one way in, so there is never a question of
 * which part of the block is the target.
 */
export function HomeHero({ view }: { view: HomeHeroView }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const ink = view.onHue ? v3.colors.ink : v3.colors.fg

  return (
    <View style={[styles.block, { backgroundColor: view.ground }]}>
      <View style={styles.head}>
        {view.avatar ? (
          <Avatar url={view.avatar.url} name={view.avatar.name} seed={view.avatar.seed} size={48} />
        ) : view.glyph ? (
          <View
            style={[styles.disc, { backgroundColor: view.onHue ? v3.colors.ink : v3.colors.bg }]}
          >
            <Feather
              name={view.glyph}
              size={v3.icon.lg}
              color={view.onHue ? view.ground : v3.colors.echoText}
            />
          </View>
        ) : null}
        <View style={styles.headText}>
          <Text style={[styles.title, { color: ink }]} accessibilityRole="header">
            {view.title}
          </Text>
          {view.meta ? <Text style={[styles.meta, { color: ink }]}>{view.meta}</Text> : null}
        </View>
        {view.chip ? (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>{view.chip}</Text>
          </View>
        ) : null}
      </View>
      {view.quote ? (
        <Text style={[styles.quote, { color: ink }]} numberOfLines={3}>
          “{view.quote}”
        </Text>
      ) : null}
      <Button
        label={view.action.label}
        icon={view.action.icon}
        onPress={view.action.onPress}
        haptic="press"
      />
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  block: {
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[16],
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { ...v3.type.headline },
  meta: { ...v3.type.caption, fontWeight: '600' },
  // Ink on the hue in both schemes, as the drawing has it: the hues do not
  // flip, so neither does what sits on them. The label is `onBlue` because it
  // is the palette's one white that stays white after dark.
  chip: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexShrink: 0,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[6],
  },
  chipLabel: { ...v3.type.label, color: v3.colors.onBlue },
  quote: { ...v3.type.body, fontWeight: '500' },
}))
