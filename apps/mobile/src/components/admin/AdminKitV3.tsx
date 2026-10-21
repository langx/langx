import Feather from '@expo/vector-icons/Feather'
import type { Href } from 'expo-router'
import { Children, type ReactNode } from 'react'
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useLocale } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { SettingsHeaderV3 } from '../settings/v3/SettingsKitV3'
import { Screen } from '../ui/Screen'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The operator panel's pieces in the redesign's look (`V-Admin`).
 *
 * The panel is always drawn this way, flag or no flag. `flags.v3Home` keeps
 * half-finished screens away from the people the app is for; the panel is read
 * only by us, so there is nobody for the flag to protect, and a second copy of
 * fourteen screens kept alive behind it would be the price of protecting no
 * one. Words still come from `adminStrings.ts` and nowhere else: these pieces
 * take strings, they never write one.
 *
 * Built from the Settings kit's header and blocks where those fit, so a row in
 * the panel and a row in Settings are the same row; what is here is what an
 * operator screen needs that Settings does not — facts in two columns, a quiet
 * row with no glyph square, notes in four tones, figures, and a split for a
 * wide browser.
 */

/**
 * On the web the panel takes more of the window than the app's 720 column:
 * it is read at a desk, beside a mailbox, and its tables and two-column pages
 * want the room. A phone is unaffected.
 */
const WIDE_COLUMN = 1120

/** At or above this window width the split pages put their two halves side by side. */
const SPLIT_AT = 960

export function AdminScreenV3({
  title,
  back,
  onBack,
  scroll = true,
  onRefresh,
  refreshing,
  children,
}: {
  title: string
  /** Where back goes when there is no history to go back through. */
  back: Href
  onBack?: (() => void) | undefined
  /** False for a screen whose body is its own `FlatList`. */
  scroll?: boolean
  onRefresh?: (() => void) | undefined
  refreshing?: boolean | undefined
  children: ReactNode
}) {
  const { v3 } = useTheme()
  const styles = useStyles()
  return (
    <Screen
      scroll={scroll}
      fluid
      ground={v3.colors.bg}
      style={styles.column}
      {...(onRefresh ? { onRefresh, refreshing: refreshing ?? false } : {})}
    >
      <SettingsHeaderV3 title={title} onBack={onBack ?? (() => goBackTo(back))} />
      <View style={scroll ? styles.stack : styles.fill}>{children}</View>
    </Screen>
  )
}

/** True where the split pages draw their halves side by side. */
export function useAdminWide(): boolean {
  const { width } = useWindowDimensions()
  return width >= SPLIT_AT
}

/**
 * Two halves: side by side on a wide window, one above the other on a phone,
 * in the same order — the start half is what is true, the end half what can
 * be done about it.
 */
export function AdminSplitV3({
  start,
  end,
  startWidth,
  endWidth = 460,
}: {
  start: ReactNode
  end: ReactNode
  /** The start half's width when side by side, where the end half takes the rest. */
  startWidth?: number | undefined
  /** The end half's width when side by side; the start half takes the rest. */
  endWidth?: number | undefined
}) {
  const styles = useStyles()
  const wide = useAdminWide()
  if (!wide) {
    return (
      <View style={styles.stack}>
        {start}
        {end}
      </View>
    )
  }
  return (
    <View style={styles.split}>
      <View style={[styles.stack, startWidth ? { width: startWidth } : styles.splitFlex]}>
        {start}
      </View>
      <View style={[styles.stack, startWidth ? styles.splitFlex : { width: endWidth }]}>{end}</View>
    </View>
  )
}

/** A headline over a section, with the line that says what it holds. */
export function AdminHeadingV3({ title, hint }: { title: string; hint?: string | undefined }) {
  const styles = useStyles()
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.headingTitle}>
        {title}
      </Text>
      {hint ? <Text style={styles.caption}>{hint}</Text> : null}
    </View>
  )
}

/** A smaller title inside a section: a step of a decision, a chart's name. */
export function AdminSubheadingV3({ children }: { children: string }) {
  const styles = useStyles()
  return <Text style={styles.subheading}>{children}</Text>
}

/** A muted line on the ground. */
export function AdminCaptionV3({
  children,
  style,
}: {
  children: ReactNode
  style?: TextStyle | undefined
}) {
  const styles = useStyles()
  return <Text style={[styles.caption, styles.captionPad, style]}>{children}</Text>
}

/** The grey block, padded, for anything that is not a list of rows. */
export function AdminBlockV3({
  children,
  style,
}: {
  children: ReactNode
  style?: ViewStyle | undefined
}) {
  const styles = useStyles()
  return <View style={[styles.block, style]}>{children}</View>
}

/** Somebody's words, as they wrote them, in the reading size. */
export function AdminQuoteV3({ children, muted = false }: { children: string; muted?: boolean }) {
  const styles = useStyles()
  return <Text style={muted ? styles.quoteMuted : styles.quote}>{children}</Text>
}

/** A grey block of rows; every row draws the hairline above itself. */
export function AdminRowsV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.rows}>
      <View style={styles.rowsInner}>{children}</View>
    </View>
  )
}

/**
 * One row's slice of the grey block, for a `FlatList`, which cannot be
 * wrapped in one: rounded at the top on the first row, at the bottom on the
 * last, with the first row's hairline tucked under the top edge.
 */
export function AdminSliceV3({
  index,
  count,
  children,
}: {
  index: number
  count: number
  children: ReactNode
}) {
  const styles = useStyles()
  return (
    <View
      style={[
        styles.slice,
        index === 0 && styles.sliceFirst,
        index === count - 1 && styles.sliceLast,
      ]}
    >
      <View style={index === 0 ? styles.rowsInner : undefined}>{children}</View>
    </View>
  )
}

/**
 * A row in a list of people or things — a report, a member, a code.
 *
 * `mark` puts the person's initials on their partner hue at the start, the
 * same colour they carry everywhere else in the app, so a name met twice in
 * one sitting is recognised before it is read.
 */
export function AdminRowV3({
  title,
  subtitle,
  value,
  mark,
  onPress,
  selected = false,
}: {
  title: string
  subtitle?: string | undefined
  /** A short readout before the chevron: a status, a tag, a store. */
  value?: string | undefined
  mark?: { id: string; label: string } | undefined
  onPress?: (() => void) | undefined
  selected?: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const chevron = useChevron()
  const body = (
    <>
      {mark ? (
        <View style={[styles.mark, { backgroundColor: v3.hues[partnerHueFor(mark.id)] }]}>
          <Text style={styles.markText}>{initials(mark.label)}</Text>
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Feather name={chevron} size={v3.icon.md} color={v3.colors.muted} /> : null}
    </>
  )
  if (!onPress) return <View style={[styles.row, selected && styles.selected]}>{body}</View>
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, (pressed || selected) && styles.selected]}
    >
      {body}
    </Pressable>
  )
}

/**
 * The trailing chevron, mirrored where the app is read right to left. The
 * words here are English, but the app around them may be in Arabic.
 */
function useChevron(): Glyph {
  return useLocale().isRtl ? 'chevron-left' : 'chevron-right'
}

/** "@dmitri_v" → "DV"; "Marina @marina.k" → "MA". Two letters, upper case. */
function initials(label: string): string {
  const words = label
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
  const first = words[0] ?? '?'
  const letters = words.length > 1 ? `${first[0]}${words[1]?.[0] ?? ''}` : first.slice(0, 2)
  return letters.toUpperCase()
}

/**
 * A row that opens one of the panel's pages, with the glyph square the
 * Settings rows have. `count` is the queue beside it, drawn in ink only when
 * there is something in it — a zero is the normal state of these queues, and
 * a queue that always looks urgent is one nobody reads.
 */
export function AdminNavRowV3({
  icon,
  hue,
  title,
  count,
  onPress,
}: {
  icon: Glyph
  /** The square's hue while the queue is open; the neutral grey otherwise. */
  hue?: PartnerHue | undefined
  title: string
  count?: number | undefined
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const chevron = useChevron()
  const open = count !== undefined && count > 0
  const tinted = hue && (count === undefined || open)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? title : `${title}, ${count}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.navRow, pressed && styles.selected]}
    >
      <View style={[styles.square, { backgroundColor: tinted ? v3.hues[hue] : v3.colors.line }]}>
        <Feather name={icon} size={v3.icon.lg} color={tinted ? v3.colors.ink : v3.colors.fg} />
      </View>
      <Text style={[styles.rowTitle, styles.rowText]}>{title}</Text>
      {count !== undefined ? (
        <Text style={[styles.count, open && styles.countOpen]}>{count}</Text>
      ) : null}
      <Feather name={chevron} size={v3.icon.md} color={v3.colors.muted} />
    </Pressable>
  )
}

/**
 * Label and value in two columns, in one grey block: the facts about an
 * account, a job's last run, the config. `tone: 'danger'` is a fact that is
 * wrong right now — a failed job, maintenance on.
 */
export function AdminFactsV3({
  rows,
}: {
  rows: readonly {
    key: string
    label: string
    value: string
    tone?: 'danger' | undefined
    mono?: boolean | undefined
  }[]
}) {
  const styles = useStyles()
  return (
    <AdminRowsV3>
      {rows.map((row) => (
        <View key={row.key} style={styles.fact} accessible>
          <Text style={styles.factLabel}>{row.label}</Text>
          <Text
            style={[
              styles.factValue,
              row.mono && styles.mono,
              row.tone === 'danger' && styles.factDanger,
            ]}
            selectable
          >
            {row.value}
          </Text>
        </View>
      ))}
    </AdminRowsV3>
  )
}

export type AdminTone = 'info' | 'warning' | 'success' | 'danger'

const TONE_LOOK: Record<Exclude<AdminTone, 'danger'>, { hue: PartnerHue; icon: Glyph }> = {
  info: { hue: 'sky', icon: 'info' },
  warning: { hue: 'tangerine', icon: 'alert-triangle' },
  success: { hue: 'mint', icon: 'check' },
}

/**
 * A sentence the operator should read before acting, in one of four tones.
 * v3 has no tinted warning block, so the tone is carried by the square's hue
 * — and `danger`, a state that is already wrong (suspended, suppressed), is
 * the red outline the destructive buttons wear.
 */
export function AdminNoteV3({
  tone,
  icon,
  children,
}: {
  tone: AdminTone
  icon?: Glyph | undefined
  children: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  if (tone === 'danger') {
    return (
      <View style={[styles.note, styles.noteDanger]}>
        <Feather name={icon ?? 'slash'} size={v3.icon.lg} color={v3.colors.danger} />
        <Text style={[styles.noteText, styles.noteTextDanger]}>{children}</Text>
      </View>
    )
  }
  const look = TONE_LOOK[tone]
  return (
    <View style={styles.note}>
      <View style={[styles.noteSquare, { backgroundColor: v3.hues[look.hue] }]}>
        <Feather name={icon ?? look.icon} size={v3.icon.sm} color={v3.colors.ink} />
      </View>
      <View style={styles.noteBody}>
        {typeof children === 'string' ? <Text style={styles.noteText}>{children}</Text> : children}
      </View>
    </View>
  )
}

/** The text inside a note that carries more than one line of its own. */
export function AdminNoteTextV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <Text style={styles.noteText}>{children}</Text>
}

/** Tiles of figures that wrap: four across on a desk, two on a phone. */
export function AdminStatsV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <View style={styles.stats}>{children}</View>
}

export function AdminStatV3({
  value,
  label,
  onPress,
}: {
  value: string
  label: string
  onPress?: (() => void) | undefined
}) {
  const styles = useStyles()
  const body = (
    <>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.caption}>{label}</Text>
    </>
  )
  if (!onPress) {
    return (
      <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
        {body}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && styles.statPressed]}
    >
      {body}
    </Pressable>
  )
}

/**
 * A text field on the grey, with its label above and an optional line under
 * it. Everything typed into the panel is English and exact — handles, codes,
 * versions — so nothing here autocorrects unless a screen says so.
 */
export function AdminFieldV3({
  label,
  hint,
  multiline,
  inBlock = false,
  style,
  ...input
}: TextInputProps & {
  label?: string | undefined
  hint?: string | undefined
  /** Inside a grey block, where the field takes the ground's colour instead. */
  inBlock?: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={v3.colors.muted}
        accessibilityLabel={input.accessibilityLabel ?? label}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...input}
        style={[
          styles.input,
          inBlock && styles.inputInBlock,
          multiline ? styles.inputMultiline : styles.inputSingle,
          style,
        ]}
      />
      {hint ? <Text style={[styles.caption, styles.captionPad]}>{hint}</Text> : null}
    </View>
  )
}

/**
 * A small label on a row — how two accounts are linked, a plan. The panel's
 * own rather than `Chip`, whose toned chips keep the current look: three
 * chips side by side in two looks was the mixed row this replaces. A hue for
 * a kind, the grey for the plain one, and the red outline for a state that is
 * already wrong.
 */
export function AdminTagV3({
  label,
  hue,
  danger = false,
}: {
  label: string
  hue?: PartnerHue | undefined
  danger?: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Text
      style={[
        styles.tag,
        hue ? { backgroundColor: v3.hues[hue], color: v3.colors.ink } : null,
        danger && styles.tagDanger,
      ]}
    >
      {label}
    </Text>
  )
}

/** Buttons side by side on a wide window, stacked full width on a phone. */
export function AdminActionsV3({ children }: { children: ReactNode }) {
  const styles = useStyles()
  const wide = useAdminWide()
  return (
    <View style={wide ? styles.actionsWide : styles.actions}>
      {Children.map(children, (child) =>
        child ? <View style={wide ? styles.actionWide : undefined}>{child}</View> : null,
      )}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  column: Platform.OS === 'web' ? { maxWidth: WIDE_COLUMN } : {},
  stack: { gap: v3.space[10], paddingBottom: v3.space[16] },
  fill: { flex: 1, gap: v3.space[10] },
  split: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[24] },
  splitFlex: { flex: 1, minWidth: 0 },

  heading: { gap: v3.space[2], paddingHorizontal: v3.space[4], paddingTop: v3.space[14] },
  headingTitle: { ...v3.type.headline, color: v3.colors.fg },
  subheading: { ...v3.type.button, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  caption: { ...v3.type.caption, color: v3.colors.muted },
  captionPad: { paddingHorizontal: v3.space[4] },

  block: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[10],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  quote: { ...v3.type.body, color: v3.colors.fg },
  quoteMuted: { ...v3.type.body, color: v3.colors.muted },

  rows: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  rowsInner: { marginTop: -1 },
  slice: { backgroundColor: v3.colors.surface, overflow: 'hidden' },
  sliceFirst: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  sliceLast: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  navRow: { paddingHorizontal: v3.space[12] },
  selected: { backgroundColor: v3.colors.tabOn },
  rowText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  rowValue: {
    ...v3.type.caption,
    color: v3.colors.muted,
    flexShrink: 1,
    fontWeight: '600',
    maxWidth: '40%',
  },
  mark: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  markText: { ...v3.type.label, color: v3.colors.ink },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  count: {
    ...v3.type.label,
    color: v3.colors.muted,
    fontVariant: ['tabular-nums'],
    minWidth: 28,
    textAlign: 'center',
  },
  countOpen: {
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    color: v3.colors.pillText,
    overflow: 'hidden',
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[6],
  },

  fact: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    columnGap: v3.space[16],
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[12],
    rowGap: v3.space[2],
  },
  factLabel: { ...v3.type.caption, color: v3.colors.muted, width: 150 },
  factValue: {
    ...v3.type.callout,
    color: v3.colors.fg,
    flexBasis: 200,
    flexGrow: 1,
    fontVariant: ['tabular-nums'],
  },
  factDanger: { color: v3.colors.danger, fontWeight: '700' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },

  note: {
    alignItems: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  noteDanger: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: v3.colors.danger,
    borderWidth: 2,
  },
  noteSquare: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  noteBody: { flex: 1, gap: v3.space[4], justifyContent: 'center', minHeight: 32 },
  noteText: { ...v3.type.callout, color: v3.colors.fg },
  noteTextDanger: { color: v3.colors.danger, flex: 1, fontWeight: '700' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  stat: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexBasis: 140,
    flexGrow: 1,
    gap: v3.space[2],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  statPressed: { backgroundColor: v3.colors.tabOn },
  statValue: { ...v3.type.headline, color: v3.colors.fg, fontVariant: ['tabular-nums'] },

  field: { gap: v3.space[6], width: '100%' },
  fieldLabel: { ...v3.type.label, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  input: {
    ...v3.type.body,
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    color: v3.colors.fg,
    paddingHorizontal: v3.space[16],
  },
  inputInBlock: { backgroundColor: v3.colors.bg },
  inputSingle: { height: 52 },
  inputMultiline: { minHeight: 112, paddingVertical: v3.space[14] },

  tag: {
    ...v3.type.label,
    backgroundColor: v3.colors.line,
    borderColor: 'transparent',
    borderRadius: v3.radius.pill,
    borderWidth: 1.5,
    color: v3.colors.fg,
    overflow: 'hidden',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  tagDanger: {
    backgroundColor: 'transparent',
    borderColor: v3.colors.danger,
    color: v3.colors.danger,
  },
  actions: { gap: v3.space[10] },
  actionsWide: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  actionWide: { flexBasis: 220, flexGrow: 1 },
}))
