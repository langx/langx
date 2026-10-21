import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { ProBadge } from '../ui/ProBadge'
import { ProgressRing } from '../ui/ProgressRing'

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

/** The streak, its next reward, and the way into the streak screen. */
export function HomeStreakRow({
  title,
  subtitle,
  onPress,
}: {
  title: string
  subtitle?: string | undefined
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={styles.row}
    >
      <View style={[styles.disc, { backgroundColor: v3.hues.tangerine }]}>
        <Feather name="zap" size={v3.icon.lg} color={v3.colors.ink} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Feather name="chevron-right" size={v3.icon.md} color={v3.colors.fg} />
    </PressableScale>
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
