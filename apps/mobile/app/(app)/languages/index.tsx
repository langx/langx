import { LANGUAGE_LEVELS, type LanguageLevel } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
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
        <View style={styles.list}>
          {profile.nativeLanguages.map((entry) => (
            <LanguageRow
              key={entry.code}
              name={names.language(entry.code)}
              onChange={() => openLanguagePicker('native', entry.code)}
              onRemove={() => void remove('native', entry.code)}
            />
          ))}
          <AddRow
            label={t('languages.addNative')}
            onPress={() => {
              if (canAddTo('nativeLanguages')) openLanguagePicker('native')
            }}
          />
        </View>

        <Text style={styles.section}>{t('languages.learningSection')}</Text>
        <Text style={styles.body}>{t('languages.learningBody')}</Text>
        <View style={styles.list}>
          {learning.map((entry, index) => (
            <LanguageRow
              key={entry.code}
              name={names.language(entry.code)}
              level={entry.level}
              onLevel={(level) => apply({ kind: 'setLevel', code: entry.code, level })}
              onChange={() => openLanguagePicker('learning', entry.code)}
              onRemove={() => void remove('learning', entry.code)}
              {...(index > 0
                ? { onUp: () => apply({ kind: 'moveLearning', code: entry.code, direction: 'up' }) }
                : {})}
              {...(index < learning.length - 1
                ? {
                    onDown: () =>
                      apply({ kind: 'moveLearning', code: entry.code, direction: 'down' }),
                  }
                : {})}
            />
          ))}
          <AddRow
            label={t('languages.addLearning')}
            onPress={() => {
              if (canAddTo('learningLanguages')) openLanguagePicker('learning')
            }}
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

/**
 * One language: its name, what it is being spoken at, and where it sits.
 *
 * The name is the button — tapping it opens the picker on *this* row, which is
 * the whole replace flow. The reorder arrows and the × are their own targets
 * beside it rather than a swipe, for the reason the old × was: this screen is
 * also the web build, and a gesture two platforms out of three can find is a
 * feature half the users cannot.
 */
function LanguageRow({
  name,
  level,
  onLevel,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  name: string
  level?: LanguageLevel
  onLevel?: (level: LanguageLevel) => void
  onChange: () => void
  onRemove: () => void
  onUp?: () => void
  onDown?: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('languages.replaceTitle', { language: name })}
          onPress={onChange}
          style={({ pressed }) => [styles.rowName, pressed && styles.pressed]}
        >
          <Text style={styles.name}>{name}</Text>
          <Feather name="chevron-right" size={18} color={colors.textFaint} />
        </Pressable>
        <View style={styles.rowActions}>
          {onUp ? (
            <IconButton
              icon="arrow-up"
              label={t('languages.moveUp', { language: name })}
              onPress={onUp}
            />
          ) : null}
          {onDown ? (
            <IconButton
              icon="arrow-down"
              label={t('languages.moveDown', { language: name })}
              onPress={onDown}
            />
          ) : null}
          <IconButton icon="x" label={`${t('common.remove')} · ${name}`} onPress={onRemove} />
        </View>
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

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: 'arrow-up' | 'arrow-down' | 'x'
  label: string
  onPress: () => void
}) {
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
  rowActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
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
