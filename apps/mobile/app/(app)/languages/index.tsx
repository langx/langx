import { LANGUAGE_LEVELS, type LanguageLevel } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams } from 'expo-router'
import { useLayoutEffect, type ReactNode } from 'react'
import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useMe } from '../../../src/api/queries'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { Button } from '../../../src/components/ui/Button'
import { Chip } from '../../../src/components/ui/Chip'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useLanguageEditor } from '../../../src/hooks/useLanguageEditor'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { levelShortLabel, useDisplayNames, useT } from '../../../src/i18n'
import { confirmAlert } from '../../../src/lib/alert'
import { LIFT_AFTER_MS, dropIndex, makeRoom, slotOffset } from '../../../src/lib/dragReorder'
import { impact } from '../../../src/lib/haptics'
import { queryFailed } from '../../../src/lib/listState'
import { goBackTo, openLanguagePicker } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * Your languages, on their own screen, saving on every tap.
 *
 * It was a block inside Edit profile: two lists, one "Edit" link, a sheet
 * asking which list, and a 320pt picker pane that opened underneath with a
 * debounced autosave behind it. Three things were wrong with that, and only
 * the third was a bug.
 *
 * The first is that a free account could not change the one language it is
 * allowed. At the cap the picker dimmed every unpicked chip, so the only path
 * was to deselect the language you had — which the autosave refused to save,
 * because a profile with no native language is not a profile — and then find
 * the new one. Leaving in between showed an empty list that had never been
 * stored. Here a language is a row, and tapping it *replaces* it: one request,
 * the same length, no moment in between where the profile is invalid.
 *
 * The second is that the debounce was the only thing serialising the writes,
 * and it cost every edit made in the last 600 ms before leaving the screen.
 * `useEditLanguages` keeps the serialisation and drops the wait.
 *
 * The third is that this screen holds no state of its own. `useMe` is the
 * list; the optimistic cache moves it under the finger and puts it back if the
 * server refuses. Nothing is lost by leaving, whichever way you leave.
 *
 * Save, at the bottom, is that way out rather than the thing that writes —
 * every tap has already been written by the time it is pressed. It is there
 * because a screen of controls with no button at the end reads as unfinished,
 * and because the way back to a profile should not be only the arrow in the
 * corner. It goes exactly where that arrow goes.
 */
export default function LanguagesScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { from } = useLocalSearchParams<{ from?: string }>()
  const me = useMe()
  const { profile, allows, apply, canAddTo } = useLanguageEditor()

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader
          title={t('languages.title')}
          onBack={() => goBackTo('/(app)/(tabs)/me', from)}
        />
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <View style={styles.loading}>
            <Skeleton width="30%" height={14} />
            <Skeleton height={56} />
            <Skeleton width="34%" height={14} />
            <Skeleton height={96} />
          </View>
        )}
      </Screen>
    )
  }

  // Priority order, not stored order: the two are separate statements about
  // the same list and only the first is the one the reader arranged.
  const learning = [...profile.learning].sort((a, b) => a.priority - b.priority)

  async function remove(kind: 'native' | 'learning', code: string): Promise<void> {
    const edit =
      kind === 'native'
        ? ({ kind: 'removeNative', code } as const)
        : ({ kind: 'removeLearning', code } as const)
    // Asked before the dialog, not after it: the last language of a list
    // cannot go, and finding that out only once you have confirmed is the
    // shape of a control that looks like it works.
    if (!allows(edit)) return
    const ok = await confirmAlert({
      title: t('languages.removeTitle', { language: names.language(code) }),
      message: t('languages.removeBody'),
      confirmLabel: t('common.remove'),
      destructive: true,
    })
    if (!ok) return
    apply(edit)
  }

  return (
    // `fluid` rather than `scroll`, the shape edit-profile has: Save sits in a
    // footer under the scrolling list, so this screen owns its own ScrollView.
    <Screen fluid>
      <ScreenHeader
        title={t('languages.title')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.section}>{t('languages.nativeSection')}</Text>
        <Text style={styles.body}>{t('languages.nativeBody')}</Text>
        {/*
          The way to add one heads its section rather than ending it. At the
          bottom, the learning list's was below the fold on any phone with
          three languages in it — the one control this screen exists for, and
          you had to know to scroll for it.
        */}
        <View style={styles.list}>
          <AddRow
            label={t('languages.addNative')}
            onPress={() => {
              if (canAddTo('nativeLanguages')) openLanguagePicker('native')
            }}
          />
          {profile.nativeLanguages.map((entry) => (
            <LanguageRow
              key={entry.code}
              name={names.language(entry.code)}
              onChange={() => openLanguagePicker('native', entry.code)}
              onRemove={() => void remove('native', entry.code)}
            />
          ))}
        </View>

        <Text style={styles.section}>{t('languages.learningSection')}</Text>
        <Text style={styles.body}>{t('languages.learningBody')}</Text>
        <View style={styles.list}>
          <AddRow
            label={t('languages.addLearning')}
            onPress={() => {
              if (canAddTo('learningLanguages')) openLanguagePicker('learning')
            }}
          />
          <LearningList
            learning={learning}
            onMove={(code, to) => apply({ kind: 'moveLearning', code, to })}
            renderRow={(entry, handle) => (
              <LanguageRow
                name={names.language(entry.code)}
                level={entry.level}
                onLevel={(level) => apply({ kind: 'setLevel', code: entry.code, level })}
                onChange={() => openLanguagePicker('learning', entry.code)}
                onRemove={() => void remove('learning', entry.code)}
                handle={handle}
              />
            )}
          />
        </View>

        <Text style={styles.hint}>{t('languages.changeHint')}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('common.save')} onPress={() => goBackTo('/(app)/(tabs)/me', from)} />
      </View>
    </Screen>
  )
}

type LearningEntry = { code: string; level: LanguageLevel }

/** What every learning row reads while one of them is held. */
interface Drag {
  /** The index being dragged, or -1 when none is. */
  from: SharedValue<number>
  /** Where it would land if it were dropped now. */
  to: SharedValue<number>
  /** How far it has been moved from its own slot. */
  dy: SharedValue<number>
  /** Every row's measured height, by index. */
  heights: SharedValue<number[]>
}

/**
 * The learning list, reordered by holding the ≡ and dragging.
 *
 * It replaced a pair of arrows on every row, which cost a tap for every row
 * crossed and put two more small targets beside each ×. A drag says where in
 * one gesture.
 *
 * The rows stay in the list's own layout and only *look* moved: the dragged one
 * follows the finger and its neighbours step aside by its height, all of it
 * transforms on the UI thread. Nothing is written until the drop, which is one
 * edit naming the row it landed on. The transforms are cleared in a layout
 * effect keyed on the order, so they come off as the new order is drawn rather
 * than before it — clearing them at the drop would show the old order for as
 * long as the optimistic write takes to reach the cache.
 *
 * Screen readers get the arrows back as actions on the handle — a drag they
 * cannot see is not a way to reorder anything.
 */
function LearningList({
  learning,
  onMove,
  renderRow,
}: {
  learning: LearningEntry[]
  onMove: (code: string, to: number) => boolean
  renderRow: (entry: LearningEntry, handle: ReactNode) => ReactNode
}) {
  const drag: Drag = {
    from: useSharedValue(-1),
    to: useSharedValue(-1),
    dy: useSharedValue(0),
    heights: useSharedValue<number[]>([]),
  }

  function settle(): void {
    drag.from.value = -1
    drag.to.value = -1
    drag.dy.value = 0
  }

  const order = learning.map((entry) => entry.code).join(',')
  // The shared values are stable, so `order` is the only thing this follows.
  useLayoutEffect(settle, [order])

  function drop(from: number, to: number): void {
    const entry = learning[from]
    // Refused, or a no-op: the list will not redraw, so nothing else clears it.
    if (!entry || !onMove(entry.code, to)) settle()
  }

  return (
    <>
      {learning.map((entry, index) => (
        <DraggableRow
          key={entry.code}
          entry={entry}
          index={index}
          count={learning.length}
          drag={drag}
          onDrop={drop}
          onMove={onMove}
          renderRow={renderRow}
        />
      ))}
    </>
  )
}

function DraggableRow({
  entry,
  index,
  count,
  drag,
  onDrop,
  onMove,
  renderRow,
}: {
  entry: LearningEntry
  index: number
  count: number
  drag: Drag
  onDrop: (from: number, to: number) => void
  onMove: (code: string, to: number) => boolean
  renderRow: (entry: LearningEntry, handle: ReactNode) => ReactNode
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const name = names.language(entry.code)

  const lift = (): void => void impact('light')

  const pan = Gesture.Pan()
    .activateAfterLongPress(LIFT_AFTER_MS)
    .onStart(() => {
      drag.from.value = index
      drag.to.value = index
      drag.dy.value = 0
      runOnJS(lift)()
    })
    .onUpdate((event) => {
      drag.dy.value = event.translationY
      // Sliced, because a removed row's height is left behind at the end.
      drag.to.value = dropIndex(drag.heights.value.slice(0, count), index, event.translationY)
    })
    .onEnd((_event, success) => {
      // The list redrew under the finger — a failed write rolled back — and
      // this index no longer names the row that was picked up.
      if (drag.from.value !== index) return
      // Cancelled rather than released — the system took the touch — goes home.
      const to = success ? drag.to.value : index
      const rest = slotOffset(drag.heights.value.slice(0, count), index, to)
      drag.dy.value = withTiming(rest, { duration: 150 }, (finished) => {
        if (finished) runOnJS(onDrop)(index, to)
      })
    })

  const moving = useAnimatedStyle(() => {
    const from = drag.from.value
    if (from === -1) {
      return { transform: [{ translateY: 0 }], zIndex: 0, shadowOpacity: 0, elevation: 0 }
    }
    if (from === index) {
      return {
        transform: [{ translateY: drag.dy.value }],
        zIndex: 1,
        shadowOpacity: 0.18,
        elevation: 6,
      }
    }
    const room = makeRoom(drag.heights.value, index, from, drag.to.value)
    return {
      transform: [{ translateY: withTiming(room, { duration: 150 }) }],
      zIndex: 0,
      shadowOpacity: 0,
      elevation: 0,
    }
  })

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('languages.moveUp', { language: name }) }] : []),
    ...(index < count - 1
      ? [{ name: 'moveDown', label: t('languages.moveDown', { language: name }) }]
      : []),
  ]
  const onAction = (event: AccessibilityActionEvent): void => {
    onMove(entry.code, event.nativeEvent.actionName === 'moveUp' ? index - 1 : index + 1)
  }

  // One language has nowhere to go, so it gets no handle to suggest otherwise.
  const handle =
    count > 1 ? (
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityLabel={t('languages.reorder', { language: name })}
          accessibilityActions={actions}
          onAccessibilityAction={onAction}
          style={styles.handle}
        >
          <Feather name="menu" size={18} color={colors.textFaint} />
        </View>
      </GestureDetector>
    ) : null

  return (
    <Animated.View
      onLayout={(event) => {
        const next = [...drag.heights.value]
        next[index] = event.nativeEvent.layout.height
        drag.heights.value = next
      }}
      style={[styles.draggable, moving]}
    >
      {renderRow(entry, handle)}
    </Animated.View>
  )
}

/**
 * One language: its name, what it is being spoken at, and where it sits.
 *
 * The name is the button — tapping it opens the picker on *this* row, which is
 * the whole replace flow. The × is its own target beside it rather than a
 * swipe, for the reason it always was: this screen is also the web build, and
 * a gesture two platforms out of three can find is a feature half the users
 * cannot. The ≡ is the exception that proves it — gesture-handler reads a held
 * mouse button as a held finger, so the drag is there on all three.
 */
function LanguageRow({
  name,
  level,
  onLevel,
  onChange,
  onRemove,
  handle,
}: {
  name: string
  level?: LanguageLevel
  onLevel?: (level: LanguageLevel) => void
  onChange: () => void
  onRemove: () => void
  /** The drag handle, for a row that can be reordered. */
  handle?: ReactNode
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        {handle}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('languages.replaceTitle', { language: name })}
          onPress={onChange}
          style={({ pressed }) => [styles.rowName, pressed && styles.pressed]}
        >
          <Text style={styles.name}>{name}</Text>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
        <IconButton icon="x" label={`${t('common.remove')} · ${name}`} onPress={onRemove} />
      </View>
      {level && onLevel ? (
        <View style={styles.levels}>
          {LANGUAGE_LEVELS.map((option) => (
            <Chip
              key={option}
              label={levelShortLabel(t, option)}
              selected={option === level}
              onPress={() => onLevel(option)}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** Always drawn, never dimmed: at the cap it says the number and offers the plan. */
function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.add, pressed && styles.pressed]}
    >
      <Feather name="plus" size={17} color={colors.accent} />
      <Text style={styles.addLabel}>{label}</Text>
    </Pressable>
  )
}

function IconButton({ icon, label, onPress }: { icon: 'x'; label: string; onPress: () => void }) {
  const { colors } = useTheme()
  const styles = useStyles()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Feather name={icon} size={15} color={colors.textMuted} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { gap: spacing.md, marginTop: spacing.lg },
  section: { ...font.label, color: colors.text, marginTop: 22 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 2 },
  list: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.md },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: 14,
  },
  rowHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  rowName: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.xs },
  // Opaque, so the row lifted over its neighbours does not show them through it.
  draggable: {
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  // Bigger than the glyph: gesture-handler hit-tests the view itself, so a
  // `hitSlop` here would not reach the drag.
  handle: { alignItems: 'center', height: 36, justifyContent: 'center', width: 28 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pressed: { opacity: 0.6 },
  // A circle the height of a chip, so an icon on a row of text has a real target.
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  add: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 16,
  },
  addLabel: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: 14, lineHeight: 21, marginTop: 20 },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  // 28 at the bottom for the same reason `Screen`'s scroll content has it: the
  // button must not sit on the home indicator.
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingTop: spacing.md,
  },
}))
