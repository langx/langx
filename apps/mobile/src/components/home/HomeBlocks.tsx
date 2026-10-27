import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { useLocale } from '../../i18n'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { BALANCED, useGlyphScale, useStacked } from '../product/ProductGroup'
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
 *
 * Three columns, each a ring over its words — until the larger text sizes
 * (`useStacked`), where a third of the block is too narrow for one word
 * ("Write", "someone" and "sentence" all broke in the middle, under an
 * ellipsis). There each goal is a row of its own, the ring at its start and
 * its words beside it, and the count goes under the heading instead of
 * beside it.
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
  const stacked = useStacked()
  return (
    <View style={styles.today}>
      <View style={[styles.sectionHead, stacked && styles.sectionHeadStacked]}>
        {/* Headline-sized, so capped as a heading is: the order of sizes holds at every setting. */}
        <Text
          style={styles.sectionTitle}
          accessibilityRole="header"
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}
        >
          {title}
        </Text>
        <Text style={styles.todayCount} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
          {count}
        </Text>
      </View>
      <View style={stacked ? styles.goalsStacked : styles.goals}>
        {goals.map((goal) => {
          const label = (
            <Text
              style={stacked ? styles.goalLabelRow : styles.goalLabel}
              maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
              // A row has the block's width, so nothing is cut short there.
              {...(stacked ? {} : { numberOfLines: 2 })}
            >
              {goal.label}
            </Text>
          )
          const status = (
            <Text
              style={[
                styles.goalStatus,
                goal.done && { color: v3.colors.correction },
                !goal.done && goal.echo && { color: v3.colors.echoText },
              ]}
              maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
              {...(stacked ? {} : { numberOfLines: 1 })}
            >
              {goal.status}
            </Text>
          )
          return (
            <Pressable
              key={goal.key}
              accessibilityRole="button"
              accessibilityLabel={`${goal.label}. ${goal.status}`}
              accessibilityState={{ checked: goal.done }}
              onPress={goal.onPress}
              style={({ pressed }) => [
                stacked ? styles.goalRow : styles.goal,
                pressed && styles.pressed,
              ]}
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
              {stacked ? (
                <View style={styles.goalWords}>
                  {label}
                  {status}
                </View>
              ) : (
                <>
                  {label}
                  {status}
                </>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/**
 * The streak, its next reward, and the way into the streak screen: one card
 * and one target, the flame on its tangerine at its start and a chevron at
 * its end.
 *
 * Venus is not on it. She had a card beside it for a while, with today's
 * video on it; now her card among the product cards carries the video
 * (`HomeProducts`), so this card is only the streak and says the day once.
 *
 * At the larger text sizes (`useStacked`) the flame and the chevron share a
 * line over the words, so the title has the card's whole width: beside a
 * flame and a chevron grown with the text, "12-day" was left a column too
 * narrow for it.
 */
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
  const { isRtl } = useLocale()
  const stacked = useStacked()
  // The flame and the chevron grow with the words, as a product row's square does.
  const glyph = useGlyphScale()
  const disc = DISC * glyph
  const flame = (
    <View style={[styles.disc, { backgroundColor: v3.hues.tangerine, height: disc, width: disc }]}>
      <FlameGlyph size={Math.round(v3.icon.lg * glyph)} color={v3.colors.ink} />
    </View>
  )
  const chevron = (
    <Feather
      name={isRtl ? 'chevron-left' : 'chevron-right'}
      size={Math.round(v3.icon.md * glyph)}
      color={v3.colors.fg}
    />
  )
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={[styles.row, stacked && styles.rowStacked]}
    >
      {stacked ? (
        <View style={styles.rowHead}>
          {flame}
          {chevron}
        </View>
      ) : (
        flame
      )}
      <View style={stacked ? styles.rowTextStacked : styles.rowText}>
        {/* Headline-sized, so capped as a heading is: the order of sizes holds at every setting. */}
        <Text style={styles.rowTitle} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}>
          {title}
        </Text>
        {subtitle ? (
          // Balanced, as a product card's line is: under a large title, "reward" was left alone.
          <Text
            style={[styles.rowSub, BALANCED]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {stacked ? null : chevron}
    </PressableScale>
  )
}

/**
 * A one-line row: the ready gift. Its words are capped as a sentence is on a
 * product page, and its glyphs grow with them: at the largest size
 * "Stündliches" ran out of the row beside a gift and a chevron left small.
 */
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
  const { isRtl } = useLocale()
  const glyph = useGlyphScale()
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={styles.linkRow}>
      <Feather name={icon} size={Math.round(v3.icon.lg * glyph)} color={v3.colors.fg} />
      <Text style={styles.linkLabel} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
        {label}
      </Text>
      {/* Onward is the reading direction: in Arabic the row ends on the left, pointing left. */}
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={Math.round(v3.icon.md * glyph)}
        color={v3.colors.fg}
      />
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
 *
 * At the larger text sizes (`useStacked`) the badge stands over the title
 * rather than beside it, and grows with it: beside the badge, "further" ran
 * out of the card at the largest size.
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
  const stacked = useStacked()
  const glyph = useGlyphScale()
  return (
    <View style={styles.pro}>
      <View style={[styles.proHead, stacked && styles.proHeadStacked]}>
        <ProBadge fontSize={v3.type.headline.fontSize * glyph} />
        <Text
          style={styles.proTitle}
          accessibilityRole="header"
          maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}
        >
          {title}
        </Text>
      </View>
      <Text style={styles.body} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
        {body}
      </Text>
      <Button
        label={button}
        icon="star"
        variant={yellow ? 'primary' : 'secondary'}
        size="medium"
        onPress={onPress}
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
      />
    </View>
  )
}

/**
 * A colour block with a title, a line and one ink button: the invite.
 *
 * Its words are capped as a product page's are — the title as a heading, the
 * line as a sentence — so at the largest text size "conversation" fits the
 * block's width instead of breaking before its last letter.
 */
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
      <Text
        style={styles.colourTitle}
        accessibilityRole="header"
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}
      >
        {title}
      </Text>
      <Text style={styles.colourBody} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
        {body}
      </Text>
      <Button
        label={button}
        icon={icon}
        variant="hue"
        size="medium"
        onPress={onPress}
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
      />
    </View>
  )
}

/**
 * A guest's next step: the account, on the screen's one yellow. Capped as
 * the invite is, so at the largest text size "öğrendiklerini" stays whole.
 */
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
      <Text
        style={styles.accountTitle}
        accessibilityRole="header"
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.heading}
      >
        {title}
      </Text>
      <Text style={styles.body} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
        {body}
      </Text>
      <Button
        label={button}
        icon="user-plus"
        onPress={onPress}
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
      />
    </View>
  )
}

/** The disc under the streak's flame, as tall as a row's square is wide. */
const DISC = 44

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
  // The larger text sizes: one goal to a row, the ring at its start.
  goalsStacked: { gap: v3.space[6] },
  goalRow: {
    alignItems: 'center',
    borderRadius: v3.radius.card,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[2],
    paddingVertical: v3.space[6],
  },
  goalWords: { flex: 1, gap: v3.space[2], minWidth: 0 },
  goalLabelRow: { ...v3.type.buttonSmall, color: v3.colors.fg },
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  // The larger text sizes: the flame and the chevron on one line, the words under them.
  rowStacked: { alignItems: 'stretch', flexDirection: 'column', gap: v3.space[10] },
  rowHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  disc: { alignItems: 'center', borderRadius: v3.radius.pill, justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTextStacked: { minWidth: 0 },
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
  // The larger text sizes: the count under the heading, where it has the width to stay whole.
  sectionHeadStacked: { alignItems: 'flex-start', flexDirection: 'column', gap: v3.space[2] },
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
  proHeadStacked: { alignItems: 'flex-start', flexDirection: 'column' },
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
