import Feather from '@expo/vector-icons/Feather'
import { useFocusEffect } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Animated, FlatList, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import type { BoostedProfile, BoostedProfilesPage } from '../../api/types'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { openProfile } from '../../lib/navigation'
import { openPaywall } from '../../lib/paywall'
import { makeStyles, useTheme } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION, PRESS_SCALE_CARD } from '../../lib/theme/motionValues'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { Avatar } from '../ui/Avatar'
import { dedupeGrounds } from '../../lib/avatarViewport'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'

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
 *
 * The query is `PeopleV3`'s, which asks for it alongside the list so the
 * cards are not pushed down when it answers (`lib/stripHold.ts`).
 */
export function BoostedStripV3({
  page,
  late,
}: {
  page: BoostedProfilesPage | undefined
  /** Whether the list was already showing; see `StripArrival`. */
  late: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const items = useMemo(() => dedupeGrounds(page?.items ?? []), [page])

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
    <StripArrival late={late} style={styles.strip}>
      <View style={styles.head}>
        <View style={styles.heading}>
          <Feather name="zap" size={v3.icon.md} color={v3.colors.fg} />
          <Text style={styles.title} accessibilityRole="header">
            {t('discover.boosted')}
          </Text>
        </View>
        <PressableScale
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
          style={styles.what}
        >
          <Text style={styles.whatLabel}>{t('discover.boostedWhat')}</Text>
        </PressableScale>
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
    </StripArrival>
  )
}

/**
 * A strip's block, which fades in when it arrives after the list was already
 * on screen — past the skeleton's hold, or on a sort it was not on — instead
 * of appearing in one frame over the cards it pushes down. One that arrives
 * with the list is simply there. Decided once, when the strip first has
 * someone to show: this mounts then, and `late` is read only on mount.
 *
 * In the list's header, not a row, so rule 13 has nothing to say; and only
 * opacity, on the native driver.
 */
export function StripArrival({
  late,
  style,
  children,
}: {
  late: boolean
  style: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reduceMotion = useReduceMotion()
  const fadeIn = useRef(late).current
  const opacity = useRef(new Animated.Value(fadeIn ? 0 : 1)).current
  useEffect(() => {
    if (!fadeIn) return
    if (reduceMotion) {
      opacity.setValue(1)
      return
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION.enter,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [fadeIn, reduceMotion, opacity])
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>
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
    <PressableScale
      accessibilityRole="button"
      accessibilityHint={t('chat.viewProfile')}
      onPress={() => onOpen(person, index)}
      scaleTo={PRESS_SCALE_CARD}
      style={[styles.tile, { backgroundColor: hue }]}
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
    </PressableScale>
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
