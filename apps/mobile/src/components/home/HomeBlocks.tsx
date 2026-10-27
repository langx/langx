import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { Pressable, Text, View, type ViewStyle } from 'react-native'
import venusHead from '../../../assets/venus/head.png'
import { useLocale } from '../../i18n'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD, PRESS_SCALE_GLYPH } from '../../lib/theme/motionValues'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { BALANCED, useGlyphScale, useStacked } from '../product/ProductGroup'
import { ProBadge } from '../ui/ProBadge'
import { ProgressRing } from '../ui/ProgressRing'
import { FlameGlyph } from '../ui/StreakFlame'
import { CARD_INSET, HomeCardRows, type CardText } from './HomeCards'

/*
 * The blocks under Home's hero, drawn from `V-Home`. Each is dumb: the screen
 * decides whether a block has anything to do and hides it when it has not,
 * and hands each one its words already chosen.
 */

export interface HomeGoal {
  key: string
  label: string
  /** "Done", "Not yet", or what is waiting — "12 cards ready". */
  status: string
  done: boolean
  /** Echo's goal wears Echo's tint, as its tab does. */
  echo?: boolean
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
}

/**
 * "Today's three": three goals that are real practice, each a ring.
 *
 * A goal is done or not, so each ring is full or empty. The ring is hidden
 * from screen readers — the goal's own label already says "Done" or not.
 */
export function HomeToday({
  title,
  count,
  goals,
}: {
  title: string
  count: string
  goals: readonly HomeGoal[]
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.today}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.todayCount}>{count}</Text>
      </View>
      <View style={styles.goals}>
        {goals.map((goal) => (
          <Pressable
            key={goal.key}
            accessibilityRole="button"
            accessibilityLabel={`${goal.label}. ${goal.status}`}
            accessibilityState={{ checked: goal.done }}
            onPress={goal.onPress}
            style={({ pressed }) => [styles.goal, pressed && styles.pressed]}
          >
            <ProgressRing
              progress={goal.done ? 1 : 0}
              color={v3.colors.correction}
              {...(goal.echo ? { trackColor: v3.colors.echoTint } : {})}
            >
              <Feather
                name={goal.done ? 'check' : goal.icon}
                size={v3.icon.lg}
                color={
                  goal.done ? v3.colors.correction : goal.echo ? v3.colors.echoText : v3.colors.fg
                }
              />
            </ProgressRing>
            <Text style={styles.goalLabel} numberOfLines={2}>
              {goal.label}
            </Text>
            <Text
              style={[
                styles.goalStatus,
                goal.done && { color: v3.colors.correction },
                !goal.done && goal.echo && { color: v3.colors.echoText },
              ]}
              numberOfLines={1}
            >
              {goal.status}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

/**
 * The streak and Venus, as two equal cards (plan #2067, §4): the streak's
 * flame on its tangerine, opening the streak page, and Venus's face on her
 * sky, opening her page. They were one row once, whose middle looked like
 * Venus and went to the streak; now each card is one target, named for what
 * it opens.
 *
 * Today's video keeps its ▶ in the Venus card's corner, playing it straight
 * away. It is a sibling laid over the card rather than a button inside it: a
 * screen reader cannot reach a button nested in another one on iOS, and this
 * way it finds three — the streak, Venus, and play. With no video the card
 * has no ▶ and still opens her page.
 *
 * Side by side while their words fit, one above the other when they do not
 * (`HomeCardRows`). One above the other, each card is a row again — the
 * picture, the words, and the chevron or ▶ at its end — except at the larger
 * text sizes, where each stays a tile, its picture over its words, so a long
 * word in the title has the card's whole width.
 */
export function HomeStreakPair({
  streak,
  venus,
}: {
  streak: { title: string; line?: string | undefined; onPress: () => void }
  venus: {
    name: string
    line: string
    /** Today's video not yet watched to its end (`streakRowVenus`'s `ready`). */
    dot: boolean
    /** Today's video, when there is one: what its ▶ says and does. */
    play?: { label: string; onPress: () => void } | undefined
    onPress: () => void
  }
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const stacked = useStacked()
  const glyph = useGlyphScale()
  const size = pairSizes(glyph, v3.space[CARD_INSET], v3.space[12])
  const chevron = (
    <Feather
      name={isRtl ? 'chevron-left' : 'chevron-right'}
      size={Math.round(v3.icon.md * glyph)}
      color={v3.colors.fg}
    />
  )
  const title = { style: styles.cardTitle, maxScale: PRODUCT_TEXT_SCALE.heading }
  const line = { style: styles.cardLine, maxScale: PRODUCT_TEXT_SCALE.text }
  const texts: CardText[] = [
    { text: streak.title, ...title },
    { text: streak.line ?? '', ...line },
    { text: venus.name, ...title },
    { text: venus.line, ...line },
  ]

  return (
    <HomeCardRows
      texts={texts}
      render={({ beside, cell }) => {
        const tile = beside || stacked
        return (
          <>
            <View style={cell}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={streak.line ? `${streak.title}. ${streak.line}` : streak.title}
                onPress={streak.onPress}
                scaleTo={PRESS_SCALE_CARD}
                touchStyle={styles.grow}
                style={[styles.card, tile ? styles.cardTile : styles.cardRow]}
              >
                <View style={[styles.pictureBox, size.box]}>
                  <View style={[styles.disc, size.disc, { backgroundColor: v3.hues.tangerine }]}>
                    <FlameGlyph size={Math.round(v3.icon.lg * glyph)} color={v3.colors.ink} />
                  </View>
                </View>
                <CardWords title={streak.title} line={streak.line} row={!tile} />
                {tile ? null : chevron}
              </PressableScale>
            </View>
            <View style={cell}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${venus.name}. ${venus.line}`}
                onPress={venus.onPress}
                scaleTo={PRESS_SCALE_CARD}
                touchStyle={styles.grow}
                style={[styles.card, tile ? styles.cardTile : styles.cardRow]}
              >
                <VenusFace dot={venus.dot} size={size} />
                <CardWords
                  title={venus.name}
                  line={venus.line}
                  row={!tile}
                  {...(!tile && venus.play ? { style: size.beforePlay } : {})}
                />
                {tile || venus.play ? null : chevron}
              </PressableScale>
              {venus.play ? (
                <View
                  style={[
                    styles.playSpot,
                    tile ? [styles.playCorner, size.playCorner] : styles.playEnd,
                  ]}
                >
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={venus.play.label}
                    onPress={venus.play.onPress}
                    scaleTo={PRESS_SCALE_GLYPH}
                    // 40 drawn, 48 to the touch.
                    hitSlop={4}
                  >
                    <View style={[styles.venusPlay, size.play]}>
                      {/* Nudged a point forward: a triangle's weight sits behind its middle. */}
                      <Feather
                        name="play"
                        size={Math.round(v3.icon.md * glyph)}
                        color={v3.colors.pillText}
                        style={styles.venusPlayGlyph}
                      />
                    </View>
                  </PressableScale>
                </View>
              ) : null}
            </View>
          </>
        )
      }}
    />
  )
}

/** A card's name and its one line under it; as a row, taking the room between its ends. */
function CardWords({
  title,
  line,
  row,
  style,
}: {
  title: string
  line?: string | undefined
  row: boolean
  style?: ViewStyle
}) {
  const styles = useStyles()
  const { isRtl } = useLocale()
  // The paragraph's direction is the layout's: "Venus" has no Arabic letters,
  // so the web build's `dir="auto"` read it left to right and pinned it to
  // the left in Arabic.
  const direction = isRtl ? styles.rtl : styles.ltr
  return (
    <View style={[styles.cardWords, row && styles.cardWordsRow, style]}>
      {/* Headline-sized, so capped as a heading is: the order of sizes holds at every setting. */}
      <Text
        style={[styles.cardTitle, direction]}
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}
      >
        {title}
      </Text>
      {line ? (
        // Balanced, as a product row's line is: in half a row, "30-day" broke at
        // its hyphen with one word left on the last line.
        <Text
          style={[styles.cardLine, direction, BALANCED]}
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
          textBreakStrategy="balanced"
          lineBreakStrategyIOS="push-out"
        >
          {line}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * Venus's face on her sky, with the unwatched dot when today's video waits.
 *
 * Her ears rise out of the disc. The picture has the disc's lower half cut
 * into it already (`assets/venus/head.png`, drawn from the 2D rig), so only
 * the ears and the crown stand over it; the disc under it is drawn here. The
 * dot sits where a badge sits on an avatar, edged in the card's own ground so
 * it reads as laid over the disc, in the streak's tangerine — the colour the
 * streak page's strip rings today's unwatched video in.
 */
function VenusFace({ dot, size }: { dot: boolean; size: PairSizes }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={[styles.pictureBox, size.box]}>
      <View style={size.venus}>
        <View style={[styles.venusDisc, size.venusDisc, { backgroundColor: v3.hues.sky }]} />
        <Image
          source={venusHead}
          style={[styles.venusFace, size.venus]}
          contentFit="contain"
          accessible={false}
        />
        {dot ? (
          <View style={[styles.venusDot, size.venusDot, { backgroundColor: v3.hues.tangerine }]} />
        ) : null}
      </View>
    </View>
  )
}

/** A one-line row: the ready gift. */
export function HomeLinkRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.linkRow}>
      <Feather name={icon} size={v3.icon.lg} color={v3.colors.fg} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Feather name="chevron-right" size={v3.icon.md} color={v3.colors.fg} />
    </PressableScale>
  )
}

export interface HomePerson {
  id: string
  name: string
  avatarUrl?: string | undefined
  /** Their languages, already worded. */
  line: string
  /** The partner hue, already resolved for the scheme. */
  hue: string
  helloLabel: string
  helloA11y: string
  openA11y: string
  onOpen: () => void
  onHello: () => void
}

/** "Today's people": a tile each, in their hue, with a big Say hello. */
export function HomePeople({
  title,
  seeAll,
  onSeeAll,
  people,
}: {
  title: string
  seeAll: string
  onSeeAll: () => void
  people: readonly HomePerson[]
}) {
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={onSeeAll}
          hitSlop={8}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
        >
          <Text style={styles.seeAllLabel}>{seeAll}</Text>
        </Pressable>
      </View>
      <View style={styles.tiles}>
        {people.map((person) => (
          <View key={person.id} style={[styles.tile, { backgroundColor: person.hue }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={person.openA11y}
              onPress={person.onOpen}
              style={({ pressed }) => [styles.tileHead, pressed && styles.pressed]}
            >
              <Avatar url={person.avatarUrl} name={person.name} seed={person.id} size={48} />
              <Text style={styles.tileName} numberOfLines={1}>
                {person.name}
              </Text>
              <Text style={styles.tileLine} numberOfLines={1}>
                {person.line}
              </Text>
            </Pressable>
            <Button
              label={person.helloLabel}
              accessibilityLabel={person.helloA11y}
              variant="hue"
              size="small"
              onPress={person.onHello}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * The Pro card, for a free account only. Its button is the screen's yellow
 * when no next step owns it, and an outline when one does (D6a).
 */
export function HomeProCard({
  title,
  body,
  button,
  yellow,
  onPress,
}: {
  title: string
  body: string
  button: string
  yellow: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.pro}>
      <View style={styles.proHead}>
        <ProBadge fontSize={v3.type.headline.fontSize} />
        <Text style={styles.proTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Button
        label={button}
        icon="star"
        variant={yellow ? 'primary' : 'secondary'}
        size="medium"
        onPress={onPress}
      />
    </View>
  )
}

/** A colour block with a title, a line and one ink button: the invite. */
export function HomeColourCard({
  ground,
  title,
  body,
  button,
  icon,
  onPress,
}: {
  ground: string
  title: string
  body: string
  button: string
  icon: keyof typeof Feather.glyphMap
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <View style={[styles.colour, { backgroundColor: ground }]}>
      <Text style={styles.colourTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.colourBody}>{body}</Text>
      <Button label={button} icon={icon} variant="hue" size="medium" onPress={onPress} />
    </View>
  )
}

/** A guest's next step: the account, on the screen's one yellow. */
export function HomeAccountCard({
  title,
  body,
  button,
  onPress,
}: {
  title: string
  body: string
  button: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <View style={styles.account}>
      <Text style={styles.accountTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      <Button label={button} icon="user-plus" onPress={onPress} />
    </View>
  )
}

/** Venus's face with her ears, and the box both pictures of the pair stand in. */
const FACE = 56
/** The disc under the flame and under her face. */
const DISC = 44
/** Today's video's ▶: 40 drawn, 48 to the touch. */
const PLAY = 40
/** The unwatched dot, edge and all. */
const DOT = 16

/**
 * The pair's pictures at the reader's text size (`useGlyphScale`): they grow
 * with the words as a product row's square does, so at the largest size the
 * flame and Venus are not specks over a 44pt title — and every offset that
 * places the face, the dot and the ▶ grows with them. `inset` is the card's
 * own (`CARD_INSET`), `gap` a row's between its words and its end.
 */
function pairSizes(glyph: number, inset: number, gap: number) {
  const face = FACE * glyph
  const disc = DISC * glyph
  const play = PLAY * glyph
  const dot = DOT * glyph
  return {
    box: { height: face },
    disc: { height: disc, width: disc },
    venus: { height: face, width: face },
    venusDisc: { height: disc, start: (face - disc) / 2, width: disc },
    venusDot: { end: (face - disc) / 2 - 2, height: dot, width: dot },
    play: { height: play, width: play },
    // The ▶ as a tile: in the top corner, centred on the disc beside it.
    playCorner: { top: inset + face - disc + (disc - play) / 2 },
    // Room at a row's end for the ▶ laid over it, and the row's own gap before it.
    beforePlay: { paddingEnd: play + gap },
  }
}
type PairSizes = ReturnType<typeof pairSizes>

const useStyles = makeStyles(({ v3 }) => ({
  pressed: { opacity: 0.7 },
  today: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    padding: v3.space[14],
  },
  todayCount: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  goals: { flexDirection: 'row', gap: v3.space[6] },
  goal: {
    alignItems: 'center',
    borderRadius: v3.radius.card,
    flex: 1,
    gap: v3.space[6],
    minWidth: 0,
    paddingHorizontal: v3.space[2],
    paddingVertical: v3.space[6],
  },
  goalLabel: { ...v3.type.buttonSmall, color: v3.colors.fg, textAlign: 'center' },
  goalStatus: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
  /*
   * A card of the streak pair: the surface, inset by `CARD_INSET` — the
   * number `HomeCardRows` measures the room inside against. As a tile its
   * picture stands over its words; as a row, beside them.
   */
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    padding: v3.space[CARD_INSET],
  },
  cardTile: { flexGrow: 1, gap: v3.space[10] },
  cardRow: { alignItems: 'center', flexDirection: 'row', flexGrow: 1, gap: v3.space[12] },
  // The touch area fills its cell, so a pair's shorter card is as tall as its neighbour.
  grow: { flexGrow: 1 },
  cardWords: { gap: v3.space[2], minWidth: 0 },
  cardWordsRow: { flex: 1 },
  cardTitle: { ...v3.type.headline, color: v3.colors.fg },
  cardLine: { ...v3.type.caption, color: v3.colors.muted },
  rtl: { writingDirection: 'rtl' },
  ltr: { writingDirection: 'ltr' },
  /*
   * The picture's box, as tall as Venus's face with her ears, so the streak's
   * disc and hers stand on one line and the words under them start level.
   */
  pictureBox: { justifyContent: 'flex-end' },
  disc: { alignItems: 'center', borderRadius: v3.radius.pill, justifyContent: 'center' },
  /*
   * The face (56) over the disc (44), the face's bottom edge on the disc's
   * and its ears standing clear above it.
   */
  venusDisc: { borderRadius: v3.radius.pill, bottom: 0, position: 'absolute' },
  venusFace: { position: 'absolute', start: 0, top: 0 },
  venusDot: {
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    bottom: 0,
    position: 'absolute',
  },
  // Over the card, never inside it: it takes touches only on the ▶ itself.
  playSpot: { pointerEvents: 'box-none', position: 'absolute' },
  // As a tile, in the top corner (`pairSizes` sets how far down).
  playCorner: { end: v3.space[CARD_INSET] },
  // As a row, at its end where the chevron would be, centred top to bottom.
  playEnd: { bottom: 0, end: v3.space[CARD_INSET], justifyContent: 'center', top: 0 },
  venusPlay: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
  },
  venusPlayGlyph: { transform: [{ translateX: 1 }] },
  linkRow: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  linkLabel: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  section: { gap: v3.space[8] },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[6],
  },
  sectionTitle: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  seeAll: { justifyContent: 'center', minHeight: 44, paddingHorizontal: v3.space[4] },
  seeAllLabel: {
    ...v3.type.buttonSmall,
    color: v3.colors.fg,
    textDecorationLine: 'underline',
  },
  tiles: { flexDirection: 'row', gap: v3.space[8] },
  tile: {
    borderRadius: v3.radius.tile,
    flex: 1,
    gap: v3.space[8],
    minWidth: 0,
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[8],
    paddingTop: v3.space[12],
  },
  tileHead: { alignItems: 'center', gap: v3.space[2] },
  tileName: { ...v3.type.headline, color: v3.colors.ink, marginTop: v3.space[4] },
  tileLine: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },
  pro: {
    borderColor: v3.colors.line,
    borderRadius: v3.radius.badge,
    borderWidth: 2,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[14],
  },
  proHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  proTitle: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  body: { ...v3.type.callout, color: v3.colors.muted },
  colour: {
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[16],
  },
  colourTitle: { ...v3.type.headline, color: v3.colors.ink },
  colourBody: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '600' },
  account: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    padding: v3.space[16],
  },
  accountTitle: { ...v3.type.headline, color: v3.colors.fg },
}))
