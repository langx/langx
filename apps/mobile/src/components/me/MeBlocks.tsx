import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { ProMark } from '../ProMark'
import { Avatar } from '../ui/Avatar'
import { FrameSweep } from '../ui/FrameSweep'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { PressableScale } from '../ui/PressableScale'
import { ProgressRing } from '../ui/ProgressRing'
import { Skeleton } from '../ui/Skeleton'
import { TitleBadge } from '../ui/TitleBadge'
import { FlameGlyph } from '../ui/StreakFlame'

type Glyph = keyof typeof Feather.glyphMap

/*
 * The blocks of the redesign's Me tab, drawn from `V-Me` and `V-MeNew`. Each
 * is dumb, as Home's are: `MeScreenV3` decides whether a block has anything
 * to show and hands it its words already chosen, so nothing here reads a
 * query or picks a string.
 */

/** "›", pointing the way the line reads — mirrored for Arabic. */
function Chevron({ color }: { color: string }) {
  const { isRtl } = useLocale()
  const { v3 } = useTheme()
  return <Feather name={isRtl ? 'chevron-left' : 'chevron-right'} size={v3.icon.md} color={color} />
}

export interface MeHeroView {
  /** The person's own partner hue, already resolved for the scheme. */
  ground: string
  name: string
  /** "@sofia · Valencia" */
  handleLine: string
  /** "Spanish · learning English" */
  languagesLine?: string | undefined
  pronouns?: string | undefined
  pro: boolean
  /** The worn title's id, drawn as its badge. */
  titleId?: string | undefined
  /** "Hide my city" is on: the mark under the name, and the setting behind it. */
  hidden?: { label: string; onPress: () => void } | undefined
  avatar: {
    url?: string | undefined
    name: string
    seed: string
    /** Names the drawn face while there is no photo; see `Avatar`. */
    defaultAvatarRev?: string | undefined
    /** A tone, or one this build does not know (drawn as an ink ring). */
    frame?: string | undefined
  }
  /** Opens the photo full screen. Only when there is a photo to open. */
  onOpenAvatar?: (() => void) | undefined
  openAvatarLabel: string
  /** The camera on the avatar's shoulder: the way to change it, in plain sight. */
  camera?: { label: string; busy: boolean; onPress: () => void } | undefined
  /** The streak's ink pill, or a new account's "New here". */
  pill?: { label: string; a11y: string; flame: boolean; onPress?: () => void } | undefined
  bell?: { label: string; count?: string | undefined; onPress: () => void } | undefined
  settings: { label: string; onPress: () => void }
  /** Whether Nunito Black has arrived; until then the name is ExtraBold. */
  black: boolean
}

/**
 * The person, on their own colour: the face with the camera that changes it,
 * the name, the streak, and the two corner controls.
 *
 * The hue is the one everybody else sees them in (`partnerHueFor` on their
 * own id), so the colour of a person's profile is the colour of that person
 * everywhere. Everything on it is ink, in both schemes, because the hues are
 * light in both.
 */
export function MeHero({ view }: { view: MeHeroView }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { pill } = view

  const pillBody = (
    <>
      {pill?.flame ? <FlameGlyph size={v3.icon.md} color={v3.colors.onBlue} /> : null}
      <Text style={styles.pillLabel}>{pill?.label}</Text>
    </>
  )

  return (
    <View style={[styles.hero, { backgroundColor: view.ground }]}>
      <View style={styles.heroTop}>
        {pill?.onPress ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={pill.a11y}
            onPress={pill.onPress}
            style={styles.pill}
          >
            {pillBody}
          </PressableScale>
        ) : pill ? (
          <View accessible accessibilityLabel={pill.a11y} style={styles.pill}>
            {pillBody}
          </View>
        ) : null}
        <View style={styles.spacer} />
        {view.bell ? (
          <IconButton
            look="hue"
            icon="bell"
            iconSize={v3.icon.lg}
            accessibilityLabel={view.bell.label}
            onPress={view.bell.onPress}
          >
            {view.bell.count ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellCount}>{view.bell.count}</Text>
              </View>
            ) : null}
          </IconButton>
        ) : null}
        <IconButton
          look="hue"
          icon="settings"
          iconSize={v3.icon.lg}
          accessibilityLabel={view.settings.label}
          onPress={view.settings.onPress}
        />
      </View>

      <View style={styles.heroBody}>
        <View style={styles.avatarWrap}>
          <Pressable
            accessibilityRole={view.onOpenAvatar ? 'button' : 'image'}
            accessibilityLabel={view.onOpenAvatar ? view.openAvatarLabel : view.name}
            onPress={view.onOpenAvatar ?? null}
            disabled={!view.onOpenAvatar}
          >
            <Avatar
              url={view.avatar.url}
              name={view.avatar.name}
              seed={view.avatar.seed}
              defaultAvatarRev={view.avatar.defaultAvatarRev}
              size={AVATAR}
              frame={view.avatar.frame}
              // Your own profile: one of the two places Aurora Glass moves.
              sweep={FrameSweep}
            />
          </Pressable>
          {view.camera ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={view.camera.label}
              accessibilityState={{ busy: view.camera.busy }}
              onPress={view.camera.onPress}
              style={({ pressed }) => [
                styles.camera,
                { borderColor: view.ground },
                (pressed || view.camera?.busy) && styles.pressed,
              ]}
            >
              <Feather name="camera" size={v3.icon.md} color={v3.colors.ink} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.heroText}>
          <Text
            style={[styles.name, !view.black && styles.nameFallback]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {view.name}
          </Text>
          <Text style={styles.handle} numberOfLines={2}>
            {view.handleLine}
          </Text>
          {view.languagesLine ? (
            <Text style={styles.languages} numberOfLines={2}>
              {view.languagesLine}
            </Text>
          ) : null}
          {view.pronouns ? (
            <Text style={styles.languages} numberOfLines={1}>
              {view.pronouns}
            </Text>
          ) : null}
          {/* On a line of their own, so a long handle and city keep theirs. */}
          {view.pro || view.titleId ? (
            <View style={styles.chips}>
              {view.pro ? <ProMark /> : null}
              {view.titleId ? <TitleBadge id={view.titleId} /> : null}
            </View>
          ) : null}
          {view.hidden ? (
            <Pressable
              accessibilityRole="button"
              onPress={view.hidden.onPress}
              // A caption's 20pt line, padded out to the 44pt minimum.
              hitSlop={HIDDEN_SLOP}
              style={({ pressed }) => [styles.hidden, pressed && styles.pressed]}
            >
              <Feather name="eye-off" size={v3.icon.xs} color={v3.colors.ink} />
              <Text style={styles.hiddenLabel}>{view.hidden.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export interface MeStat {
  key: string
  /** The number, already formatted for the locale, or the dash for none. */
  value: string
  label: string
  /** A partner hue, resolved for the scheme. */
  hue: string
  loading: boolean
  /** "Corrections given: 31" — read as one. */
  a11y: string
  onPress: () => void
}

/** Three numbers, each on its own colour, each the way into its list. */
export function MeStats({ stats, black }: { stats: readonly MeStat[]; black: boolean }) {
  const styles = useStyles()
  return (
    <View style={styles.stats}>
      {stats.map((stat) => (
        <PressableScale
          key={stat.key}
          accessibilityRole="button"
          accessibilityLabel={stat.loading ? stat.label : stat.a11y}
          accessibilityState={stat.loading ? { busy: true } : {}}
          onPress={stat.onPress}
          touchStyle={styles.statTouch}
          style={[styles.stat, { backgroundColor: stat.hue }]}
        >
          {stat.loading ? (
            // The numeral's own line, so the block is the height it will be.
            <View style={styles.statSlot}>
              <Skeleton width={44} height={26} />
            </View>
          ) : (
            <Text
              style={[styles.statValue, !black && styles.nameFallback]}
              // A figure in a fixed block: at the largest text sizes a long
              // number would leave it. The label under it scales in full.
              maxFontSizeMultiplier={1.4}
              numberOfLines={1}
            >
              {stat.value}
            </Text>
          )}
          <Text style={styles.statLabel}>{stat.label}</Text>
        </PressableScale>
      ))}
    </View>
  )
}

/** The streak's own row: the run, the longest and the freezes, and the way into the streak screen. */
export function MeStreakCard({
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
      style={styles.streak}
    >
      <View style={[styles.disc, styles.discLarge, { backgroundColor: v3.hues.tangerine }]}>
        <FlameGlyph size={v3.icon.xxl} color={v3.colors.ink} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.streakTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      <Chevron color={v3.colors.fg} />
    </PressableScale>
  )
}

/**
 * The Pro block, for a free account only — the screen decides. Its title is
 * the way to the paywall, and the viewers line under it the way to the
 * locked list: two targets side by side, never one inside the other.
 */
export function MeProBlock({
  title,
  onPress,
  line,
}: {
  title: string
  onPress: () => void
  line?: { label: string; onPress: () => void } | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.pro}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        style={({ pressed }) => [styles.proHead, pressed && styles.pressed]}
      >
        <ProMark />
        <Text style={styles.proTitle}>{title}</Text>
        <Chevron color={v3.colors.fg} />
      </Pressable>
      {line ? (
        <Pressable
          accessibilityRole="link"
          onPress={line.onPress}
          style={({ pressed }) => [styles.proLine, pressed && styles.pressed]}
        >
          <Text style={styles.muted}>{line.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** A section's title, a count beside it, and the way into the whole list. */
export function MeSectionHead({
  title,
  count,
  onPress,
}: {
  title: string
  count?: string | undefined
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${title}, ${count}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
    >
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
      <Chevron color={v3.colors.muted} />
    </Pressable>
  )
}

/**
 * The nearest badge not yet earned, as the big card: its picture, how far,
 * what it pays, and — when a press can bring it closer — the button that does.
 */
export function MeNextBadge({
  hue,
  art,
  kicker,
  title,
  progress,
  fraction,
  action,
}: {
  hue: string
  /** The badge's own picture. */
  art: ReactNode
  kicker: string
  title: string
  /** "9 of 10 · Pays 50 tokens" */
  progress: string
  /** 0 to 1, for the bar. */
  fraction: number
  action?: { label: string; icon: Glyph; onPress: () => void } | undefined
}) {
  const styles = useStyles()
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100)
  return (
    <View style={[styles.badge, { backgroundColor: hue }]}>
      <View style={styles.badgeHead}>
        <View style={styles.badgeArt}>{art}</View>
        <View style={styles.rowText}>
          <Text style={styles.onHueKicker}>{kicker}</Text>
          <Text style={styles.onHueTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.onHueBody}>{progress}</Text>
        </View>
      </View>
      {/* The words above already say how far; the bar is the picture of it. */}
      <View
        style={styles.bar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[StyleSheet.absoluteFill, styles.barTrack]} />
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant="ink"
          size="small"
          onPress={action.onPress}
          style={styles.badgeAction}
        />
      ) : null}
    </View>
  )
}

export interface MeRow {
  key: string
  icon: Glyph
  /** A partner hue for the leading square; the neutral grey when left out. */
  hue?: string | undefined
  title: string
  subtitle?: string | undefined
  /** A short value before the chevron — the wallet's balance. */
  value?: string | undefined
  /** A block holds the value's or the subtitle's place while it loads. */
  loading?: boolean | undefined
  onPress: () => void
}

/** Rows on one grey block, each a glyph on its colour, a line or two, and a chevron. */
export function MeRows({ rows }: { rows: readonly MeRow[] }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  if (rows.length === 0) return null
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Pressable
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={[row.title, row.value, row.subtitle].filter(Boolean).join(', ')}
          accessibilityState={row.loading ? { busy: true } : {}}
          onPress={row.onPress}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.rowDivided,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={[styles.square, { backgroundColor: row.hue ?? v3.colors.line }]}>
            <Feather
              name={row.icon}
              size={v3.icon.lg}
              color={row.hue ? v3.colors.ink : v3.colors.fg}
            />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            {row.loading && row.value === undefined ? (
              <View style={styles.subtitleSlot}>
                <Skeleton width={120} height={12} />
              </View>
            ) : row.subtitle ? (
              <Text style={styles.muted}>{row.subtitle}</Text>
            ) : null}
          </View>
          {row.value !== undefined ? (
            row.loading ? (
              <Skeleton width={44} height={14} />
            ) : (
              <Text style={styles.rowValue}>{row.value}</Text>
            )
          ) : null}
          <Chevron color={v3.colors.muted} />
        </Pressable>
      ))}
    </View>
  )
}

/**
 * Invite and Share as the two big buttons, and the quiet guide under them.
 * No invite in the first week, whose checklist already has it as a step, and
 * neither button for a guest, who has nobody to invite and no profile to
 * share — only the guide, which today's Me gives everybody.
 */
export function MeActions({
  invite,
  share,
  guide,
}: {
  invite?: { label: string; onPress: () => void } | undefined
  share?: { label: string; onPress: () => void } | undefined
  guide: { label: string; onPress: () => void }
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.actions}>
      {/* Blue, not yellow: inviting is the main thing here that does not commit. */}
      {invite ? (
        <Button label={invite.label} icon="user-plus" variant="blue" onPress={invite.onPress} />
      ) : null}
      {share ? (
        <Button label={share.label} icon="share" variant="secondary" onPress={share.onPress} />
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={guide.onPress}
        style={({ pressed }) => [styles.guide, pressed && styles.pressed]}
      >
        <Feather name="help-circle" size={v3.icon.md} color={v3.colors.muted} />
        <Text style={styles.guideLabel}>{guide.label}</Text>
      </Pressable>
    </View>
  )
}

export interface MeFirstWeekStepView {
  key: string
  icon: Glyph
  /** The step's colour while it is still to do. */
  hue: string
  title: string
  subtitle: string
  done: boolean
  onPress: () => void
}

/**
 * A new account's Me: the first week's four steps under a ring, in place of
 * numbers it does not have yet. A step still to do is a block of colour with
 * the way to do it; a done one goes quiet, an outline with a tick.
 */
export function MeFirstWeek({
  ring,
  title,
  body,
  steps,
  foot,
}: {
  ring: { color: string; progress: number; text: string; a11y: string }
  title: string
  body: string
  steps: readonly MeFirstWeekStepView[]
  foot: string
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.firstWeek}>
      <View style={styles.firstWeekHead}>
        <ProgressRing
          size="lg"
          progress={ring.progress}
          color={ring.color}
          accessibilityLabel={ring.a11y}
        >
          <Text style={styles.ringText}>{ring.text}</Text>
        </ProgressRing>
        <View style={styles.rowText}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.bodyMuted}>{body}</Text>
        </View>
      </View>

      {steps.map((step) => (
        <PressableScale
          key={step.key}
          accessibilityRole="button"
          accessibilityLabel={`${step.title}. ${step.subtitle}`}
          accessibilityState={{ checked: step.done }}
          onPress={step.onPress}
          style={[styles.step, step.done ? styles.stepDone : { backgroundColor: step.hue }]}
        >
          <View
            style={[
              styles.disc,
              { backgroundColor: step.done ? v3.colors.correction : v3.colors.ink },
            ]}
          >
            <Feather
              name={step.done ? 'check' : step.icon}
              size={v3.icon.lg}
              color={step.done ? v3.colors.bg : step.hue}
            />
          </View>
          <View style={styles.rowText}>
            <Text style={step.done ? styles.rowTitle : styles.onHueRowTitle}>{step.title}</Text>
            <Text style={step.done ? styles.muted : styles.onHueCaption}>{step.subtitle}</Text>
          </View>
          {step.done ? null : <Chevron color={v3.colors.ink} />}
        </PressableScale>
      ))}

      <Text style={styles.foot}>{foot}</Text>
    </View>
  )
}

/** The figure's size: the drawing's 88pt avatar. */
const AVATAR = 88

/** The camera's disc, a touch target in its own right. */
const CAMERA = 44

/** Around the "Hidden from others" mark: its caption line is 20pt tall. */
const HIDDEN_SLOP = { top: 12, bottom: 12, left: 8, right: 8 }

const useStyles = makeStyles(({ v3 }) => ({
  pressed: { opacity: 0.7 },
  spacer: { flex: 1 },
  rowText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  muted: { ...v3.type.caption, color: v3.colors.muted },
  bodyMuted: { ...v3.type.callout, color: v3.colors.muted },

  hero: {
    borderRadius: v3.radius.hero,
    gap: v3.space[12],
    paddingBottom: v3.space[20],
    paddingEnd: v3.space[12],
    paddingStart: v3.space[16],
    paddingTop: v3.space[12],
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  pill: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 44,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
  },
  // The palette's one white that stays white after dark: the pill is ink in both.
  pillLabel: { ...v3.type.button, color: v3.colors.onBlue },
  bellBadge: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    end: 2,
    minWidth: 20,
    paddingHorizontal: v3.space[4],
    position: 'absolute',
    top: 2,
  },
  bellCount: { ...v3.type.label, color: v3.colors.onBlue },
  heroBody: { alignItems: 'center', flexDirection: 'row', gap: v3.space[16] },
  avatarWrap: { flexShrink: 0 },
  camera: {
    alignItems: 'center',
    backgroundColor: v3.colors.onBlue,
    borderRadius: v3.radius.pill,
    borderWidth: 4,
    bottom: -6,
    end: -8,
    height: CAMERA,
    justifyContent: 'center',
    position: 'absolute',
    width: CAMERA,
  },
  heroText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  name: { ...v3.type.title, color: v3.colors.ink },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  nameFallback: { fontFamily: DISPLAY_FONT },
  handle: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '700' },
  languages: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '500' },
  chips: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[6],
    marginTop: v3.space[4],
  },
  hidden: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: v3.space[4],
    marginTop: v3.space[4],
  },
  hiddenLabel: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },

  stats: { flexDirection: 'row', gap: v3.space[8] },
  statTouch: { flex: 1 },
  stat: {
    borderRadius: v3.radius.tile,
    gap: v3.space[2],
    minHeight: 96,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  statSlot: { height: v3.type.title.lineHeight, justifyContent: 'center' },
  statValue: { ...v3.type.title, color: v3.colors.ink },
  statLabel: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700' },

  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  discLarge: { height: 48, width: 48 },
  streak: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 72,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  streakTitle: { ...v3.type.headline, color: v3.colors.fg },

  pro: {
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    gap: v3.space[2],
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[8],
  },
  proHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8], minHeight: 44 },
  proTitle: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  // The platform's minimum, as every target here is: the line is a way in.
  proLine: { justifyContent: 'center', minHeight: 44 },

  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
    paddingHorizontal: v3.space[6],
  },
  sectionTitle: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  sectionCount: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '700' },

  badge: {
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    padding: v3.space[16],
  },
  badgeHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  badgeArt: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  onHueKicker: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '700' },
  onHueTitle: { ...v3.type.headline, color: v3.colors.ink },
  onHueBody: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '600' },
  onHueRowTitle: { ...v3.type.button, color: v3.colors.ink },
  onHueCaption: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },
  bar: {
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
  },
  // Ink at a fifth, as the drawing has it: a track that reads on every hue.
  barTrack: { backgroundColor: v3.colors.ink, opacity: 0.18 },
  barFill: { backgroundColor: v3.colors.ink, borderRadius: v3.radius.pill },
  badgeAction: { alignSelf: 'flex-start', width: 'auto' },

  group: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  rowDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  rowPressed: { backgroundColor: v3.colors.line },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  rowValue: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '600' },
  subtitleSlot: { height: v3.type.caption.lineHeight, justifyContent: 'center' },

  actions: { gap: v3.space[10], paddingTop: v3.space[6] },
  guide: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  guideLabel: { ...v3.type.buttonSmall, color: v3.colors.muted },

  firstWeek: { gap: v3.space[10] },
  firstWeekHead: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    flexDirection: 'row',
    gap: v3.space[16],
    padding: v3.space[16],
  },
  ringText: { ...v3.type.headline, color: v3.colors.fg },
  step: {
    alignItems: 'center',
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 76,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  stepDone: { borderColor: v3.colors.line, borderWidth: 2 },
  foot: {
    ...v3.type.callout,
    color: v3.colors.muted,
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[4],
  },
}))
