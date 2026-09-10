import { TIER_BADGES } from '@langx/shared'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useBoostedProfiles } from '../api/queries'
import { useT } from '../i18n'
import { openProfile } from '../lib/navigation'
import { makeStyles } from '../lib/theme'
import { Avatar } from './ui/Avatar'
import { Chip } from './ui/Chip'

/**
 * The paying members above the discovery list — Polyglot first, then Fluent.
 *
 * A component rather than JSX inside the screen because of one rule: when
 * nobody qualifies there is no strip, no title and no gap where one was. The
 * server answers `{ items: [] }` for that, and every non-answer here —
 * loading, failed — renders nothing too. An empty strip is a valid state of
 * the product, so it must not look like a broken one, and a skeleton would
 * promise content that may never arrive.
 *
 * `params` is the filters only. Sort and radius are deliberately not passed:
 * the strip has one order of its own, and including them would give it a
 * fresh cache entry per sort for a response that never changes.
 */
export function BoostedProfiles({ params }: { params: Record<string, string> }) {
  const styles = useStyles()
  const t = useT()
  const query = useBoostedProfiles(params)

  const items = query.data?.items ?? []
  if (items.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('discover.boosted')}</Text>
      {/*
        A `ScrollView`, like `PhotoGallery` and for the same reason the
        `IntroCarousel` gives: these strips are a handful of items with no
        windowing to win, and a horizontal `FlatList` inside a vertical one
        costs a nested virtualisation warning for nothing.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {items.map((item) => (
          <Pressable
            key={item._id}
            onPress={() => openProfile(item.handle, '/(app)/(tabs)/discover')}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Avatar
              url={item.avatarUrl}
              name={item.displayName}
              seed={item._id}
              size={56}
              online={item.isOnline}
            />
            <Text style={styles.name} numberOfLines={1}>
              {item.displayName}
            </Text>
            {/* A brand mark, so it is `TIER_BADGES` rather than a translated
                string — the same word in every locale, as on `me`. */}
            <Chip
              label={TIER_BADGES[item.tier] ?? ''}
              tone={item.tier === 'pro_plus' ? 'proPlus' : 'pro'}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  section: { gap: spacing.sm, paddingBottom: spacing.lg },
  title: { ...font.heading, color: colors.text, fontSize: 17 },
  strip: { gap: spacing.md, paddingVertical: spacing.xs },
  /**
   * A fixed width, not a hugging one. The name is `numberOfLines={1}` and the
   * chip is one of two words, so letting each card size itself would give a
   * row of cards that step in width by whoever happens to be in it.
   */
  card: { alignItems: 'center', gap: spacing.sm, width: 92 },
  pressed: { opacity: 0.7 },
  name: { ...font.label, color: colors.text, textAlign: 'center' },
}))
