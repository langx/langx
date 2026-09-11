import { TIER_BADGES } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useBoostedProfiles } from '../api/queries'
import type { BoostedProfile } from '../api/types'
import { useDisplayNames, useT } from '../i18n'
import { confirmAlert } from '../lib/alert'
import { track } from '../lib/analytics'
import { openProfile } from '../lib/navigation'
import { openPaywall } from '../lib/paywall'
import { makeStyles, useTheme } from '../lib/theme'
import { Avatar } from './ui/Avatar'

const FROM = '/(app)/(tabs)/discover'

/**
 * The paying members above the discovery list — Polyglot first, then Fluent.
 *
 * A component rather than JSX in the screen because of one rule: when nobody
 * qualifies there is no strip, no title and no gap where one was. The server
 * answers `{ items: [] }` for that, and every non-answer here — loading,
 * failed — renders nothing too. An empty strip is a valid state of the
 * product, so it must not look like a broken one, and a skeleton would
 * promise content that may never arrive.
 *
 * `params` is the filters only. Sort and radius are deliberately not passed:
 * the strip has one order of its own, and including them would give it a
 * fresh cache entry per sort for a response that never changes.
 */
export function BoostedProfiles({ params }: { params: Record<string, string> }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const query = useBoostedProfiles(params)

  const items = query.data?.items ?? []

  /*
   * The dependency is the count, and that is the load-bearing part.
   * `useFocusEffect` re-runs when its callback's identity changes while the
   * screen is focused: on a cold first visit focus happens while the query is
   * still pending and the count is 0, so an empty list would mean the event
   * never fired at all. `items` itself must stay out — a fresh array every
   * render would fire on every render.
   *
   * Above the early return because hooks cannot sit below one.
   */
  const count = items.length
  useFocusEffect(
    useCallback(() => {
      if (count > 0) track({ name: 'boosted_strip_shown', properties: { count } })
    }, [count]),
  )

  if (items.length === 0) return null

  /** One row of the pair, in the reader's language: what they speak → what they are learning. */
  const pairOf = (item: BoostedProfile) => {
    const speaks = item.nativeLanguages[0]
    const learns = item.learning[0]
    if (!speaks || !learns) return ''
    return `${names.language(speaks.code)} → ${names.language(learns.code)}`
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Feather name="zap" size={15} color={colors.pro} />
          <Text style={styles.headingText}>{t('discover.boosted')}</Text>
        </View>
        {/*
          The strip is the one thing on this screen that is there because
          somebody paid, and saying so is better than letting it read as an
          algorithm nobody can see.
        */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void confirmAlert({
              title: t('discover.boostedExplainTitle'),
              message: t('discover.boostedExplainBody'),
              confirmLabel: t('discover.boostedSeePlans'),
            }).then((yes) => {
              if (yes) openPaywall('boostedProfile', FROM)
            })
          }}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.explain}>{t('discover.boostedWhat')}</Text>
        </Pressable>
      </View>

      {/*
        A `ScrollView`, like `PhotoGallery` and for the same reason the
        `IntroCarousel` gives: these strips are a handful of items with no
        windowing to win, and a horizontal `FlatList` inside a vertical one
        costs a nested virtualisation warning for nothing.

        Full-bleed — the negative margin cancels `Screen`'s gutter and the
        content padding puts it back — so a card can sit half off the edge
        and say there is more to the right.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {items.map((item, index) => (
          <Pressable
            key={item._id}
            onPress={() => {
              track({
                name: 'boosted_strip_tapped',
                properties: { slot: index, tier: item.tier },
              })
              openProfile(item.handle, FROM)
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            {/* The ring is what marks the card as boosted at a glance; the
                inner gap is the card's own fill showing through. */}
            <View style={styles.ring}>
              <Avatar
                url={item.avatarUrl}
                name={item.displayName}
                seed={item._id}
                size={64}
                online={item.isOnline}
              />
            </View>
            <View style={styles.cardText}>
              {/* The first name only: two words do not fit 132pt, and an
                  ellipsis through somebody's surname reads worse than
                  leaving it for the profile. */}
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName.trim().split(/\s+/)[0]}
              </Text>
              <Text style={styles.pair} numberOfLines={1}>
                {pairOf(item)}
              </Text>
            </View>
            {/* A brand mark, so it is `TIER_BADGES` rather than a translated
                string — the same word in every locale, as on `me`. */}
            <Text style={styles.plan} numberOfLines={1}>
              {TIER_BADGES[item.tier]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

/** `Screen`'s own gutter, cancelled so the strip can run to both edges. */
const GUTTER = 20

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  section: { gap: 14, marginHorizontal: -GUTTER, marginTop: 24, paddingBottom: spacing.sm },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
  },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  headingText: { ...font.heading, color: colors.text, fontSize: 17 },
  explain: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  strip: { gap: spacing.md, paddingBottom: 4, paddingHorizontal: GUTTER },
  card: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.xl,
    gap: 10,
    paddingBottom: 14,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    width: 132,
  },
  ring: {
    borderColor: colors.pro,
    borderRadius: radius.pill,
    borderWidth: 3,
    padding: 3,
  },
  cardText: { gap: 3, width: '100%' },
  name: { ...font.heading, color: colors.text, fontSize: 15, textAlign: 'center' },
  pair: { color: colors.accent, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  plan: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    color: colors.pro,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.7 },
}))
