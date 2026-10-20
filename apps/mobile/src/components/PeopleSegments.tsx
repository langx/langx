import { Pressable, Text, View } from 'react-native'
import { useT } from '../i18n'
import { makeStyles } from '../lib/theme'

export type PeopleSegment = 'people' | 'posts'

const SEGMENTS: readonly PeopleSegment[] = ['people', 'posts']

/**
 * People | Posts, at the top of the redesign's People tab.
 *
 * Two segments of one tab rather than two tabs: Discover and the Feed are
 * both "the people here", one as profiles and one as what they wrote, and the
 * bar had one slot for them once Home took the first. The drawing's control —
 * a grey track with the chosen half in ink — rather than `SegmentedControl`,
 * which is the current look's and stays on the screens that have not moved.
 *
 * Tabs to a screen reader, not buttons: choosing one replaces everything
 * under it, which is what a tab list announces.
 */
export function PeopleSegments({
  value,
  onChange,
}: {
  value: PeopleSegment
  onChange: (next: PeopleSegment) => void
}) {
  const styles = useStyles()
  const t = useT()
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {SEGMENTS.map((segment) => {
        const selected = segment === value
        return (
          <Pressable
            key={segment}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(segment)
            }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.selected,
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {segment === 'people' ? t('tabs.people') : t('tabs.posts')}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  /*
   * v3's `surface`, now that both segments are drawn on v3's ground. It was
   * the current look's `fill` while they still sat on the current look's,
   * where v3's surface in dark is all but the ground's own colour.
   */
  track: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    padding: v3.space[4],
  },
  // 44 inside the track's 4 + 4, so the whole control is the drawing's 52
  // and each half is a full touch target.
  segment: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: v3.space[12],
  },
  selected: { backgroundColor: v3.colors.pill },
  pressed: { backgroundColor: v3.colors.line },
  label: { ...v3.type.button, color: v3.colors.fg },
  labelSelected: { color: v3.colors.pillText },
}))
