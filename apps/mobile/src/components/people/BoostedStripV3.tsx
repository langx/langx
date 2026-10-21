import Feather from '@expo/vector-icons/Feather'
import { useFocusEffect } from 'expo-router'
import { memo, useCallback, useMemo } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useBoostedProfiles } from '../../api/queries'
import type { BoostedProfile } from '../../api/types'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { openProfile } from '../../lib/navigation'
import { openPaywall } from '../../lib/paywall'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { Avatar } from '../ui/Avatar'
import { dedupeGrounds } from '../../lib/avatarViewport'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'

const FROM = '/(app)/(tabs)/discover'

/**
 * The paying members above People, in the v3 look — the strip
 * `BoostedProfiles` draws in the current one, with the same query, the same
 * order and the same events, so the hourly rotation the server seeds per
 * viewer is exactly what it was. Only the drawing changed: a tile in each
 * person's partner hue with their face and frame, like "New on LangX" beside
 * it, in place of a grey card with a purple ring.
 *
 * No age beside the name. The v3 People board draws none on its cards or its
 * strip, and the v3 card leaves it off too (rule 20: nothing reads as
 * dating). The heading says the strip is paid for, so the ring that used to
 * say it on every face is not needed.
 *
 * Nothing at all when nobody qualifies — no heading and no gap — for the
 * reason `BoostedProfiles` gives.
 */
export function BoostedStripV3({ params }: { params: Record<string, string> }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const query = useBoostedProfiles(params)
  const items = useMemo(() => dedupeGrounds(query.data?.items ?? []), [query.data])

  // The count, not the items, for the reason `BoostedProfiles` gives.
  const count = items.length
  useFocusEffect(
    useCallback(() => {
      if (count > 0) track({ name: 'boosted_strip_shown', properties: { count } })
    }, [count]),
  )

  const onOpen = useCallback((item: BoostedProfile, index: number) => {
    track({ name: 'boosted_strip_tapped', properties: { slot: index } })
    openProfile(item.handle, FROM)
  }, [])

  if (items.length === 0) return null

  return (
    <View style={styles.strip}>
      <View style={styles.head}>
        <View style={styles.heading}>
          <Feather name="zap" size={v3.icon.md} color={v3.colors.fg} />
          <Text style={styles.title} accessibilityRole="header">
            {t('discover.boosted')}
          </Text>
        </View>
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
          style={({ pressed }) => [styles.what, pressed && styles.pressed]}
        >
          <Text style={styles.whatLabel}>{t('discover.boostedWhat')}</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={keyOf}
        renderItem={({ item, index }) => (
          <BoostedTile person={item} index={index} onOpen={onOpen} />
        )}
        ItemSeparatorComponent={Gap}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: TILE_WIDTH + GAP,
          offset: (TILE_WIDTH + GAP) * index,
          index,
        })}
      />
    </View>
  )
}

const BoostedTile = memo(function BoostedTile({
  person,
  index,
  onOpen,
}: {
  person: BoostedProfile
  index: number
  onOpen: (person: BoostedProfile, index: number) => void
}) {
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { isRtl } = useLocale()
  const hue = v3.hues[partnerHueFor(person._id)]
  const speaks = person.nativeLanguages[0]
  const learns = person.learning[0]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('chat.viewProfile')}
      onPress={() => onOpen(person, index)}
      style={({ pressed }) => [styles.tile, { backgroundColor: hue }, pressed && styles.pressed]}
    >
      {/* A framed face is the smaller cut inside the bare face's slot, its
          frame spilling into the tile's padding, so every tile is as tall. */}
      <View style={styles.face}>
        <Avatar
          url={person.avatarUrl}
          name={person.displayName}
          seed={person._id}
          defaultAvatarRev={person.defaultAvatarRev}
          size={person.frame ? FRAMED_AVATAR : AVATAR}
          frame={person.frame}
          frameOverflow="all"
        />
        {/* Ringed in the tile's hue rather than the ground's: it sits on the tile. */}
        {person.isOnline ? (
          <View style={[styles.dot, { backgroundColor: colors.success, borderColor: hue }]} />
        ) : null}
      </View>
      {/* The first name only, as the current strip has it: two words do not
          fit the tile, and an ellipsis through a surname reads worse. */}
      <Text style={styles.name} numberOfLines={1}>
        {person.displayName.trim().split(/\s+/)[0] ?? ''}
      </Text>
      {speaks && learns ? (
        <View style={styles.pair}>
          <Text style={styles.lang} numberOfLines={1}>
            {names.language(speaks.code)}
          </Text>
          <Feather
            name={isRtl ? 'arrow-left' : 'arrow-right'}
            size={v3.icon.xs}
            color={v3.colors.ink}
          />
          <Text style={styles.lang} numberOfLines={1}>
            {names.language(learns.code)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
})

function keyOf(person: BoostedProfile): string {
  return person._id
}

function Gap() {
  const styles = useStyles()
  return <View style={styles.gap} />
}

/**
 * The tile: wide enough for "Turkish → Russian" on one line — the current
 * strip's 132 cut both names to a few letters — and the rest scroll.
 */
const TILE_WIDTH = 160
const GAP = 10
const AVATAR = 64
const FRAMED_AVATAR = 54

const useStyles = makeStyles(({ v3 }) => ({
  strip: { gap: v3.space[8] },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingStart: v3.space[6],
  },
  heading: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6], flexShrink: 1 },
  title: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  // A pill a finger can find, not a line of small grey text.
  what: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[14],
  },
  whatLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
  pressed: { opacity: 0.8 },
  gap: { width: GAP },
  tile: {
    alignItems: 'center',
    borderRadius: v3.radius.tile,
    gap: v3.space[6],
    paddingBottom: v3.space[12],
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[14],
    width: TILE_WIDTH,
  },
  face: { alignItems: 'center', height: AVATAR, justifyContent: 'center', width: AVATAR },
  dot: {
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    bottom: 0,
    end: 0,
    height: 18,
    position: 'absolute',
    width: 18,
  },
  name: { ...v3.type.buttonSmall, color: v3.colors.ink, maxWidth: '100%' },
  pair: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[4],
    justifyContent: 'center',
    maxWidth: '100%',
  },
  lang: { ...v3.type.label, color: v3.colors.ink, flexShrink: 1 },
}))
