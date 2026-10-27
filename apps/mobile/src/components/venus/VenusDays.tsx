import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import type { VenusArchiveView } from '../../hooks/useVenusArchive'
import { useLocale, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import {
  requestVenusClip,
  requestVenusReplay,
  VENUS_ASPECT,
  VENUS_SHELF,
  venusShelf,
  venusStrip,
  type VenusArchiveDay,
} from '../../lib/venusStory'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { GUTTER } from '../ui/Screen'

/*
 * Venus's days as covers: the strip on the streak page and the grid on the
 * Venus page. Both draw the same tile and order the days by the same rules
 * (`venusStrip`, `venusShelf` in `lib/venusStory.ts`); only the layout
 * differs. Every cover already prints its day large, in the video's own
 * language, so a tile adds words only where the picture cannot say it. A
 * tile is one of three things:
 *
 * - **today** — today's video, tagged "Today", with the streak's tangerine
 *   ring round it until it has been watched to its end, as Home's Venus card
 *   wears its tangerine dot until then. Plays through `requestVenusReplay`, so it is today's
 *   video in every way: watching it through marks it watched.
 * - **open** — a day up to the longest streak (`venusUnlockedDays`), the
 *   cover alone. Plays through `requestVenusClip`, which records nothing
 *   against today.
 * - **locked** — a day not reached yet: its cover blurred under a lock, and
 *   not a button. The blur takes the printed number with it, so the day is
 *   written under the lock, to read as what is coming.
 */

/** The strip's cover width; its height is the videos' own 9:16. */
const STRIP_TILE = 88

/** How many covers a row of the grid holds on a phone. */
const GRID_COLUMNS = 4

/** How far a locked cover is blurred: past recognising, still her colours. */
const LOCKED_BLUR = 16

/** The ring round today's cover until it is watched. */
const RING = 3

/**
 * The words on a cover sit in a box a quarter of a phone wide, so they stop
 * growing with the reader's text size where "Day 100" still fits on one line
 * inside the tile. The screen reader hears every tile in full words
 * regardless.
 */
const TAG_SCALE = 1.3

type TileState = 'today' | 'open' | 'locked'

interface DayTile {
  key: string
  day: number
  coverUrl: string | null
  state: TileState
  unwatched: boolean
  onPress?: () => void
}

function openTile(day: VenusArchiveDay): DayTile {
  return {
    key: `day${day.day}`,
    day: day.day,
    coverUrl: day.clip.coverUrl,
    state: day.open ? 'open' : 'locked',
    unwatched: false,
    ...(day.open ? { onPress: () => requestVenusClip(day.clip) } : {}),
  }
}

function todayTile(archive: VenusArchiveView): DayTile | null {
  const today = archive.today
  if (!today) return null
  return {
    key: 'today',
    day: today.day,
    coverUrl: today.coverUrl,
    state: 'today',
    unwatched: archive.todayUnwatched,
    onPress: requestVenusReplay,
  }
}

/**
 * The strip of covers on the streak page, between the hero and the ladder:
 * today's first, then the newest open days and the next few locked
 * (`venusStrip`). Its header opens the Venus page, where the whole archive is.
 */
export function VenusStrip({
  archive,
  title,
  onOpenPage,
}: {
  archive: VenusArchiveView
  title: string
  onOpenPage: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const today = todayTile(archive)
  const tiles = [
    ...(today ? [today] : []),
    ...venusStrip(archive.days, archive.today?.day ?? null).map(openTile),
  ]

  return (
    <View style={styles.strip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${t('venus.strip.seeAll')}`}
        onPress={onOpenPage}
        style={({ pressed }) => [styles.stripHead, pressed && styles.pressed]}
      >
        <Text style={styles.stripTitle}>{title}</Text>
        <Text style={styles.seeAll}>{t('venus.strip.seeAll')}</Text>
        {/* Points onward, so it turns with the reading direction. */}
        <Feather
          name={isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.muted}
        />
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.bleedContent}
      >
        {tiles.map((tile) => (
          <DayCover key={tile.key} tile={tile} width={STRIP_TILE} />
        ))}
      </ScrollView>
    </View>
  )
}

/**
 * The archive on the Venus page: the strip's days as a grid, today's in its
 * place among them. A dozen at first (`VENUS_SHELF`), then every open day on
 * request — each cover is a full-size still, and a hundred of them is a
 * download nobody asked for by opening the page.
 */
export function VenusArchiveGrid({ archive }: { archive: VenusArchiveView }) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [width, setWidth] = useState(0)
  const [all, setAll] = useState(false)
  const shelf = venusShelf(archive.days)
  const full = venusShelf(archive.days, { size: Infinity, locked: VENUS_SHELF.locked })
  const shown = all ? full : shelf
  const today = todayTile(archive)
  const tiles = shown.map((day) => (today && day.day === today.day ? today : openTile(day)))

  const gap = v3.space[10]
  const tileWidth = width > 0 ? (width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 0

  return (
    <View style={styles.gridBlock}>
      <View
        style={[styles.grid, { gap }]}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      >
        {tileWidth > 0
          ? tiles.map((tile) => <DayCover key={tile.key} tile={tile} width={tileWidth} />)
          : null}
      </View>
      {full.length > shelf.length ? (
        <Button
          variant="secondary"
          size="medium"
          label={all ? t('venus.page.showFewer') : t('venus.page.showAll', { count: full.length })}
          onPress={() => setAll((current) => !current)}
        />
      ) : null}
    </View>
  )
}

function DayCover({ tile, width }: { tile: DayTile; width: number }) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { fontScale } = useWindowDimensions()
  const height = width / VENUS_ASPECT
  const locked = tile.state === 'locked'
  const label =
    tile.state === 'today'
      ? tile.unwatched
        ? t('venus.strip.todayNew', { day: tile.day })
        : t('venus.strip.todayA11y', { day: tile.day })
      : locked
        ? t('venus.strip.lockedA11y', { day: tile.day })
        : t('venus.strip.watchDay', { day: tile.day })

  const face = (
    <View style={[styles.cover, { height, width }]}>
      {tile.coverUrl ? (
        <Image
          source={tile.coverUrl}
          style={styles.fill}
          contentFit="cover"
          accessible={false}
          {...(locked ? { blurRadius: LOCKED_BLUR } : {})}
        />
      ) : null}
      {locked ? (
        <View style={styles.lockedShade}>
          <View style={styles.lockDisc}>
            <Feather name="lock" size={v3.icon.sm} color={v3.colors.onSignal} />
          </View>
          <Text
            style={styles.lockedDay}
            numberOfLines={1}
            maxFontSizeMultiplier={TAG_SCALE}
            // Shrinks rather than cut "Day 100" off at the largest sizes.
            adjustsFontSizeToFit={fontScale > 1}
            minimumFontScale={0.7}
          >
            {t('venus.strip.day', { day: tile.day })}
          </Text>
        </View>
      ) : null}
      {tile.state === 'today' ? (
        <View style={styles.todayTag}>
          <Text style={styles.todayText} numberOfLines={1} maxFontSizeMultiplier={TAG_SCALE}>
            {t('venus.strip.today')}
          </Text>
        </View>
      ) : null}
      {tile.unwatched ? <View style={styles.ring} pointerEvents="none" /> : null}
    </View>
  )

  if (!tile.onPress) {
    return (
      <View accessible accessibilityLabel={label}>
        {face}
      </View>
    )
  }
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={tile.onPress}>
      {face}
    </PressableScale>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  strip: { gap: v3.space[8] },
  stripHead: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 44,
    paddingHorizontal: v3.space[6],
  },
  pressed: { opacity: 0.6 },
  // The ladder's heading, so the strip reads as a section of the same page.
  stripTitle: { ...v3.type.headline, color: v3.colors.fg, flex: 1, minWidth: 0 },
  seeAll: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '600' },
  // Out to the screen's edge, so a cover sliding off it says "there is more
  // this way".
  bleed: { marginHorizontal: -GUTTER },
  bleedContent: { gap: v3.space[10], paddingHorizontal: GUTTER },
  gridBlock: { gap: v3.space[12] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cover: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.icon,
    overflow: 'hidden',
  },
  fill: { height: '100%', position: 'absolute', start: 0, top: 0, width: '100%' },
  // Dims the blurred picture so the lock reads on any cover, light or dark.
  lockedShade: {
    alignItems: 'center',
    backgroundColor: v3.colors.scrim,
    bottom: 0,
    end: 0,
    gap: v3.space[6],
    justifyContent: 'center',
    paddingHorizontal: v3.space[4],
    position: 'absolute',
    start: 0,
    top: 0,
  },
  lockedDay: { ...v3.type.label, color: v3.colors.onSignal, textAlign: 'center' },
  lockDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.stageScrim,
    borderRadius: v3.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  // A caption laid over a picture, as a call's chips are, at the foot: the
  // cover's printed number is at its head.
  todayTag: {
    backgroundColor: v3.hues.tangerine,
    borderRadius: v3.radius.pill,
    bottom: v3.space[6],
    maxWidth: '86%',
    paddingHorizontal: v3.space[6],
    paddingVertical: v3.space[2],
    position: 'absolute',
    start: v3.space[6],
  },
  todayText: { ...v3.type.label, color: v3.colors.ink },
  ring: {
    borderColor: v3.hues.tangerine,
    borderRadius: v3.radius.icon,
    borderWidth: RING,
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
}))
