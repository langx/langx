import Feather from '@expo/vector-icons/Feather'
import { countryFlag, formatDistance } from '@langx/shared'
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { DiscoveryItem } from '../../api/types'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { Avatar } from '../ui/Avatar'
import { frameArtBox } from '../ui/FrameArt'
import { Button } from '../ui/Button'

/**
 * One person on People, in the v3 look: their face first, in their partner
 * colour, with the pair of languages and one big Say hello (`V-People`).
 *
 * Memoised, with handlers that take the person rather than closing over them,
 * so a row the list re-renders for somebody else's change — another row
 * selected, the next page arriving — compares equal and is skipped.
 *
 * Nothing on it reads as dating (rule 20): no swipe, no heart, no age in the
 * headline. The one action is a hello, and a hello is the start of an
 * exchange of languages, which is what the pair under the name says.
 */
export const PersonCard = memo(function PersonCard({
  person,
  index,
  selected,
  black,
  onOpen,
  onHello,
}: {
  person: DiscoveryItem
  index: number
  /** The person whose profile is in the wide window's side panel. */
  selected: boolean
  /** Whether Nunito Black has arrived; until then the name is ExtraBold at its size. */
  black: boolean
  onOpen: (person: DiscoveryItem, index: number) => void
  onHello: (person: DiscoveryItem) => void
}) {
  const styles = useStyles()
  const { v3, colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { isRtl } = useLocale()
  const hue = v3.hues[partnerHueFor(person._id)]

  const speaks = person.nativeLanguages.map((l) => names.language(l.code)).join(', ')
  const learns = person.learning.map((l) => names.language(l.code)).join(', ')
  /*
   * Where they are and whether they are here, in one line. The country, not a
   * city — a discovery row carries no city — and the distance only on Nearby,
   * worded as the bound the server sends rather than a measurement.
   */
  const place = [
    person.country ? `${countryFlag(person.country)} ${names.country(person.country)}` : null,
    person.distanceKm !== undefined ? formatDistance(person.distanceKm) : null,
    person.isOnline ? t('presence.online') : null,
  ]
    .filter(Boolean)
    .join(' · ')
  /*
   * What the card shows, for a screen reader: the open target wraps it all,
   * so a label of the name alone left the pair, the place and the bio out of
   * reach — the very things a hello is decided on.
   */
  const openLabel = [
    person.displayName,
    place,
    learns ? t('me.languagesLine', { speaks, learns }) : speaks,
    person.bio,
    person.repliesWithinDay ? t('discover.repliesWithinDay') : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <View style={[styles.card, { backgroundColor: hue }, selected && styles.selected]}>
      {/*
        The open target wraps the face, the words and nothing else, so the web
        build never puts a button inside a button.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={openLabel}
        onPress={() => onOpen(person, index)}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <View style={styles.head}>
          {/*
            The frame spills past the face above and below, so the card is as
            tall framed as not; beside the face it keeps its room from the
            name. The inner view stays the face's size, which is what keeps
            the dot on the face's edge rather than the frame's.
          */}
          <View style={person.frame ? { paddingHorizontal: CARD_FRAME_SPILL } : null}>
            <View>
              <Avatar
                url={person.avatarUrl}
                name={person.displayName}
                seed={person._id}
                size={person.frame ? CARD_FRAMED_AVATAR : CARD_AVATAR}
                frame={person.frame}
                frameOverflow="all"
              />
              {/* Ringed in the card's hue rather than the ground's: it sits on the card. */}
              {person.isOnline ? (
                <View style={[styles.dot, { backgroundColor: colors.success, borderColor: hue }]} />
              ) : null}
            </View>
          </View>
          <View style={styles.headText}>
            <Text style={[styles.name, !black && styles.nameFallback]} numberOfLines={1}>
              {person.displayName}
            </Text>
            {place ? (
              <Text style={styles.place} numberOfLines={1}>
                {place}
              </Text>
            ) : null}
            <View style={styles.pair}>
              <Text style={styles.speaks} numberOfLines={1}>
                {speaks}
              </Text>
              <Feather
                name={isRtl ? 'arrow-left' : 'arrow-right'}
                size={v3.icon.xs}
                color={v3.colors.ink}
              />
              {learns ? (
                <Text style={styles.learns} numberOfLines={1}>
                  {learns}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        {person.bio ? (
          <Text style={styles.bio} numberOfLines={3}>
            {person.bio}
          </Text>
        ) : null}
        {/* S2's coarse line, only where the server sent it — never a number. */}
        {person.repliesWithinDay ? (
          <View style={styles.meta}>
            <Feather name="clock" size={v3.icon.xs} color={v3.colors.ink} />
            <Text style={styles.metaLabel}>{t('discover.repliesWithinDay')}</Text>
          </View>
        ) : null}
      </Pressable>
      <Button
        label={t('onboarding.sayHelloTo', { name: person.displayName })}
        icon="message-circle"
        variant="hue"
        onPress={() => onHello(person)}
      />
    </View>
  )
})

/**
 * A newcomer on the "New on LangX" strip: a small tile in their hue, which
 * says hello — the strip exists so that somebody new is written to.
 */
export const NewcomerTile = memo(function NewcomerTile({
  person,
  onHello,
}: {
  person: DiscoveryItem
  onHello: (person: DiscoveryItem) => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const speaks = person.nativeLanguages[0]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('discover.helloNewcomer', { name: person.displayName })}
      onPress={() => onHello(person)}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: v3.hues[partnerHueFor(person._id)] },
        pressed && styles.pressed,
      ]}
    >
      <Avatar
        url={person.avatarUrl}
        name={person.displayName}
        seed={person._id}
        size={44}
        frame={person.frame}
      />
      <Text style={styles.tileName} numberOfLines={1}>
        {person.displayName}
      </Text>
      {speaks ? (
        <Text style={styles.tileLine} numberOfLines={1}>
          {names.language(speaks.code)}
        </Text>
      ) : null}
    </Pressable>
  )
})

/** The card's face. */
const CARD_AVATAR = 76
/**
 * A framed card's face: smaller, so face and frame together take about the
 * width a bare face does and the name keeps its room. Still the full cut.
 */
const CARD_FRAMED_AVATAR = 64
/** How far a frame's art reaches past the framed face on each side. */
const CARD_FRAME_SPILL = (frameArtBox(CARD_FRAMED_AVATAR) - CARD_FRAMED_AVATAR) / 2

/** The strip's tile: four fit across a 390pt phone, and the rest scroll. */
export const NEWCOMER_TILE_WIDTH = 84

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[16],
  },
  // The wide window's open profile: an ink ring, since the card is already a colour.
  selected: { borderColor: v3.colors.fg, borderWidth: 3 },
  open: { gap: v3.space[10] },
  pressed: { opacity: 0.8 },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  dot: {
    borderRadius: v3.radius.pill,
    borderWidth: 4,
    bottom: 0,
    end: 0,
    height: 22,
    position: 'absolute',
    width: 22,
  },
  headText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  name: { ...v3.type.title, color: v3.colors.ink },
  nameFallback: { fontFamily: DISPLAY_FONT },
  place: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700' },
  // Wrapping rather than truncating: two long language names ("русский,
  // украинский → английский") move the second chip down a line instead of
  // cutting both to a few letters.
  pair: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[6],
    marginTop: v3.space[2],
  },
  // What they speak, filled; what they learn, outlined — the drawing's pair.
  speaks: {
    ...v3.type.label,
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    color: v3.colors.onBlue,
    flexShrink: 1,
    overflow: 'hidden',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  learns: {
    ...v3.type.label,
    borderColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    color: v3.colors.ink,
    flexShrink: 1,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  bio: { ...v3.type.body, color: v3.colors.ink, fontWeight: '500' },
  meta: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  metaLabel: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700' },
  tile: {
    alignItems: 'center',
    borderRadius: v3.radius.tile,
    gap: v3.space[4],
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[4],
    paddingTop: v3.space[10],
    width: NEWCOMER_TILE_WIDTH,
  },
  tileName: { ...v3.type.buttonSmall, color: v3.colors.ink, maxWidth: '100%' },
  tileLine: { ...v3.type.label, color: v3.colors.ink, maxWidth: '100%' },
}))
