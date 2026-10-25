import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import venusHead from '../../../assets/venus/head.png'
import { makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_GLYPH } from '../../lib/theme/motionValues'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { ProBadge } from '../ui/ProBadge'
import { ProgressRing } from '../ui/ProgressRing'
import { FlameGlyph } from '../ui/StreakFlame'

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
 * The streak, its next reward, and the way into the streak screen.
 *
 * With today's Venus video (`flags.venusStories`) the same row carries it:
 * her face in a story's ring of the streak's tangerine, with the flame as a
 * badge on it so the row still reads as the streak, and a play button at the
 * end where the chevron was. The face and the button play the video; the
 * words between them still open the streak screen. One row, so the day is
 * said once rather than by two rows stacked one above the other.
 *
 * Three siblings rather than buttons inside a button: a screen reader cannot
 * reach a button nested in another one on iOS, and this way it finds two —
 * the streak, and play. The face is left out of that, being a second way to
 * the same video for a thumb that goes for the picture.
 */
export function HomeStreakRow({
  title,
  subtitle,
  onPress,
  venus,
}: {
  title: string
  subtitle?: string | undefined
  onPress: () => void
  /** Today's video, when there is one: what its button says and does. */
  venus?: { label: string; onPress: () => void } | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const label = subtitle ? `${title}. ${subtitle}` : title
  const words = (
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
    </View>
  )
  if (!venus) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.row}
      >
        <View style={[styles.disc, { backgroundColor: v3.hues.tangerine }]}>
          <FlameGlyph size={v3.icon.lg} color={v3.colors.ink} />
        </View>
        {words}
        <Feather name="chevron-right" size={v3.icon.md} color={v3.colors.fg} />
      </PressableScale>
    )
  }
  return (
    <View style={styles.row}>
      <PressableScale
        onPress={venus.onPress}
        scaleTo={PRESS_SCALE_GLYPH}
        // Out of the screen reader's and the keyboard's way: play, at the
        // row's end, is the same button with a name.
        accessible={false}
        aria-hidden
        tabIndex={-1}
      >
        <VenusFace />
      </PressableScale>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.streakWords, pressed && styles.pressed]}
      >
        {words}
      </Pressable>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={venus.label}
        onPress={venus.onPress}
        scaleTo={PRESS_SCALE_GLYPH}
        // 40 drawn, 48 to the touch.
        hitSlop={4}
      >
        <View style={styles.venusPlay}>
          {/* Nudged a point forward: a triangle's weight sits behind its middle. */}
          <Feather
            name="play"
            size={v3.icon.md}
            color={v3.colors.pillText}
            style={styles.venusPlayGlyph}
          />
        </View>
      </PressableScale>
    </View>
  )
}

/**
 * Venus's face in the streak's ring, with the flame on it as a badge.
 *
 * Her ears rise out of the disc. The picture has the disc's lower half cut
 * into it already (`assets/venus/head.png`, drawn from the 2D rig), so only
 * the ears and the crown stand over the ring; the disc under it is drawn here,
 * in the scheme's sky.
 */
function VenusFace() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.venus}>
      <View style={[styles.venusRing, { borderColor: v3.hues.tangerine }]} />
      <View style={[styles.venusDisc, { backgroundColor: v3.hues.sky }]} />
      <Image source={venusHead} style={styles.venusFace} contentFit="contain" accessible={false} />
      <View style={[styles.venusFlame, { backgroundColor: v3.hues.tangerine }]}>
        <FlameGlyph size={14} color={v3.colors.ink} />
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
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  /*
   * The face's box: 56 wide, and 4 taller than the face so the ring's lower
   * edge has room. The disc (44) sits in the ring (52) with a 2pt gap of the
   * row's own ground between them, and the face's bottom edge on the disc's.
   */
  venus: { height: 60, width: 56 },
  venusRing: {
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    bottom: 0,
    height: 52,
    start: 2,
    position: 'absolute',
    width: 52,
  },
  venusDisc: {
    borderRadius: v3.radius.pill,
    bottom: 4,
    height: 44,
    start: 6,
    position: 'absolute',
    width: 44,
  },
  venusFace: { height: 56, position: 'absolute', start: 0, top: 0, width: 56 },
  /*
   * The flame on her ring's lower corner, edged in the row's own ground so it
   * reads as a badge laid over the ring rather than a dent in it.
   */
  venusFlame: {
    alignItems: 'center',
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    bottom: 0,
    end: 0,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    width: 24,
  },
  /*
   * The streak's own button between the face and play: as tall as the row,
   * its padding taken back, so a tap above or below the words still lands.
   */
  streakWords: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    marginVertical: -v3.space[12],
    minWidth: 0,
    paddingVertical: v3.space[12],
  },
  venusPlay: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  venusPlayGlyph: { transform: [{ translateX: 1 }] },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...v3.type.headline, color: v3.colors.fg },
  rowSub: { ...v3.type.caption, color: v3.colors.muted },
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
