import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import type { Href } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useT } from '../../../i18n'
import { goBackTo } from '../../../lib/navigation'
import { DISPLAY_FONT, makeStyles, useTheme, type PartnerHue } from '../../../lib/theme'
import { IconButton } from '../../ui/IconButton'
import { Screen } from '../../ui/Screen'

export type Glyph = keyof typeof Feather.glyphMap

/**
 * The pieces every Settings page draws under `flags.v3Home` (`V-Settings`,
 * `V-Set*`): a back button over a big title, grey blocks of rows, each row a
 * glyph on its square, a line or two, and one thing at the end.
 *
 * The metrics are `MeRows`' (`components/me/MeBlocks.tsx`), so a row on the
 * Me tab and a row here are the same row. `MeRows` itself only draws rows
 * that open something; these also carry a switch, a value, a plan tag or the
 * glyph that says the row leaves the app, which is why they are not it.
 */
export function SettingsScreenV3({
  title,
  back,
  onBack,
  children,
}: {
  title: string
  /** Where back goes when there is no history to go back through. */
  back: Href
  /** In place of `goBackTo(back)`, for a page that also honours `?from=`. */
  onBack?: (() => void) | undefined
  children: ReactNode
}) {
  const { v3 } = useTheme()
  const styles = useStyles()
  return (
    <Screen scroll ground={v3.colors.bg}>
      <SettingsHeaderV3 title={title} onBack={onBack ?? (() => goBackTo(back))} />
      <View style={styles.stack}>{children}</View>
    </Screen>
  )
}

/**
 * The back button over the big title, on its own for the pages that are not
 * one scroll of blocks: a form whose button sits at the foot
 * (`SettingsFormScreenV3`).
 */
export function SettingsHeaderV3({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  return (
    <View style={styles.header}>
      <IconButton
        icon={isRtl ? 'chevron-right' : 'chevron-left'}
        accessibilityLabel={t('common.backPlain')}
        onPress={onBack}
      />
      <Text accessibilityRole="header" style={[styles.title, !blackLoaded && styles.titleFallback]}>
        {title}
      </Text>
    </View>
  )
}

/** A heading over a group, where a page has more than one kind of thing. */
export function SettingsHeadingV3({ title, body }: { title: string; body?: string | undefined }) {
  const styles = useStyles()
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.headingTitle}>
        {title}
      </Text>
      {body ? <Text style={styles.caption}>{body}</Text> : null}
    </View>
  )
}

/**
 * One grey block. Every row draws a hairline above itself, and the block
 * tucks the first one under its own top edge: a row that does not apply
 * right now renders nothing, so which row comes first is only known once
 * they have rendered, and this way no row has to know.
 */
export function SettingsGroupV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.group}>
      <View style={styles.groupInner}>{children}</View>
    </View>
  )
}

export interface SettingsItemV3Props {
  icon: Glyph
  /** A partner hue for the square; the neutral grey when left out. */
  hue?: PartnerHue | undefined
  title: string
  subtitle?: string | undefined
  /** A short readout before the chevron: the plan, the handle, a count. */
  value?: string | undefined
  /** A switch, in place of the chevron. */
  accessory?: ReactNode
  /** The plan that opens a gated row, beside its title. */
  tag?: string | null | undefined
  onPress?: (() => void) | undefined
  /** The row leaves the app: the share glyph where the chevron would be. */
  external?: boolean
  destructive?: boolean
  /** Greyed out and inert: a row under a switch that is off. */
  dimmed?: boolean
  accessibilityLabel?: string | undefined
}

export function SettingsItemV3({
  icon,
  hue,
  title,
  subtitle,
  value,
  accessory,
  tag,
  onPress,
  external = false,
  destructive = false,
  dimmed = false,
  accessibilityLabel,
}: SettingsItemV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const body = (
    <>
      <View style={[styles.square, { backgroundColor: hue ? v3.hues[hue] : v3.colors.line }]}>
        <Feather name={icon} size={v3.icon.lg} color={hue ? v3.colors.ink : v3.colors.fg} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.titleLine}>
          <Text style={[styles.rowTitle, destructive && styles.danger]}>{title}</Text>
          {tag ? <ProTagV3 label={tag} /> : null}
        </View>
        {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}
      </View>
      {value !== undefined ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
      {onPress && !accessory ? (
        <Feather
          name={external ? 'external-link' : isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.muted}
        />
      ) : null}
    </>
  )
  const rowStyle = [styles.row, dimmed && styles.dimmed]
  // A row with a switch is not itself a button: the switch is the control,
  // and a row that also toggled would be two targets for one thing.
  if (!onPress || accessory) {
    return <View style={rowStyle}>{body}</View>
  }
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel}
      disabled={dimmed}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

/** The plan name on a gated row: the ink pill the drawings put beside a title. */
export function ProTagV3({ label }: { label: string }) {
  const styles = useStyles()
  return <Text style={styles.tag}>{label}</Text>
}

const useStyles = makeStyles(({ v3 }) => ({
  header: { gap: v3.space[2], marginStart: -v3.space[10], paddingBottom: v3.space[6] },
  title: { ...v3.type.title, color: v3.colors.fg, paddingStart: v3.space[10] },
  // ExtraBold at Black's size until Black has loaded, so the title only
  // thickens when the face arrives instead of reflowing.
  titleFallback: { fontFamily: DISPLAY_FONT },
  stack: { gap: v3.space[10], paddingBottom: v3.space[16] },
  heading: { gap: v3.space[2], paddingHorizontal: v3.space[4], paddingTop: v3.space[10] },
  headingTitle: { ...v3.type.headline, color: v3.colors.fg },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  groupInner: { marginTop: -1 },
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  pressed: { backgroundColor: v3.colors.line },
  dimmed: { opacity: 0.5 },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  titleLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  rowTitle: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
  danger: { color: v3.colors.danger },
  caption: { ...v3.type.caption, color: v3.colors.muted },
  rowValue: {
    ...v3.type.callout,
    color: v3.colors.muted,
    flexShrink: 1,
    fontWeight: '600',
    maxWidth: '45%',
  },
  tag: {
    ...v3.type.label,
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    color: v3.colors.pillText,
    overflow: 'hidden',
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
}))
