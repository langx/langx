import Feather from '@expo/vector-icons/Feather'
import { LANGUAGE_LEVELS, PLAN_LIMITS, TIER_NAMES, type LanguageLevel } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
// gesture-handler's, as `languages/index.tsx` has: the drag handle is a
// gesture-handler pan, and React Native's own scroll view does not take part
// in its arbitration, so a long-press drag and a scroll could both win.
import { ScrollView } from 'react-native-gesture-handler'
import { useMe } from '../../api/queries'
import { LearningList } from '../../components/languages/LearningList'
import { LevelChoiceV3 } from '../../components/languages/LevelChoiceV3'
import { LoadFailed } from '../../components/LoadFailed'
import { SettingsHeadingV3, SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Button } from '../../components/ui/Button'
import { ICON_BUTTON_TARGET, IconButton } from '../../components/ui/IconButton'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useLanguageEditor } from '../../hooks/useLanguageEditor'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { levelShortLabel, useDisplayNames, useLocale, useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { queryFailed } from '../../lib/listState'
import { goBackTo, openLanguagePicker } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'

/**
 * Your languages in the redesign's look (`V-Languages`), behind
 * `flags.v3Home`. Every edit, the confirmation before a removal, the cap
 * check before the picker opens and the drag that reorders the learning list
 * are `languages/index.tsx`'s — the drag is the same `LearningList`, drawn
 * on the grey block. Only the drawing differs.
 */
export function LanguagesScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { from } = useLocalSearchParams<{ from?: string }>()
  const me = useMe()
  const { profile, caps, allows, apply, canAddTo } = useLanguageEditor()
  const back = () => goBackTo('/(app)/(tabs)/me', from)

  if (!profile) {
    return (
      <Screen ground={v3.colors.bg}>
        <SettingsHeaderV3 title={t('languages.title')} onBack={back} />
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <View style={styles.loading}>
            <Skeleton width="30%" height={20} />
            <Skeleton height={56} />
            <Skeleton height={64} />
            <Skeleton width="34%" height={20} />
            <Skeleton height={120} />
          </View>
        )}
      </Screen>
    )
  }

  const learning = [...profile.learning].sort((a, b) => a.priority - b.priority)
  const paused = new Set(profile.pausedLanguages ?? [])

  /*
   * The Pro mark on a full list's Add row, as the board draws it for a free
   * account at its cap: only where tapping it would offer the plan. Not past
   * the cap — someone grandfathered over it is told upgrading adds nothing —
   * and never when the plan already holds as many as Pro does.
   */
  const upsell = (key: 'maxNativeLanguages' | 'maxLearningLanguages', count: number) =>
    count === caps[key] && caps[key] < PLAN_LIMITS.pro[key]
      ? `${t('languages.capReachedShort', { count: caps[key] })} ${t('languages.capUpgrade', {
          plan: TIER_NAMES.pro,
          count: PLAN_LIMITS.pro[key],
        })}`
      : undefined

  async function remove(kind: 'native' | 'learning', code: string): Promise<void> {
    const edit =
      kind === 'native'
        ? ({ kind: 'removeNative', code } as const)
        : ({ kind: 'removeLearning', code } as const)
    // Asked before the dialog, as today: the last language of a list cannot go.
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
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('languages.title')} onBack={back} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SettingsHeadingV3
            title={t('languages.nativeSection')}
            body={t('languages.nativeBody')}
          />
          <AddRow
            label={t('languages.addNative')}
            upsell={upsell('maxNativeLanguages', profile.nativeLanguages.length)}
            onPress={() => {
              if (canAddTo('nativeLanguages')) openLanguagePicker('native')
            }}
          />
          {profile.nativeLanguages.map((entry) => (
            <LanguageRow
              key={entry.code}
              code={entry.code}
              name={names.language(entry.code)}
              paused={paused.has(entry.code)}
              onChange={() => openLanguagePicker('native', entry.code)}
              onRemove={() => void remove('native', entry.code)}
            />
          ))}
        </View>

        <View style={styles.section}>
          <SettingsHeadingV3
            title={t('languages.learningSection')}
            body={t('languages.learningBody')}
          />
          <AddRow
            label={t('languages.addLearning')}
            upsell={upsell('maxLearningLanguages', profile.learning.length)}
            onPress={() => {
              if (canAddTo('learningLanguages')) openLanguagePicker('learning')
            }}
          />
          <LearningList
            learning={learning}
            onMove={(code, to) => apply({ kind: 'moveLearning', code, to })}
            // Each row is its own opaque block, so the lifted one hides what it crosses.
            look={{
              ground: 'transparent',
              handle: styles.handle,
              handleColor: v3.colors.muted,
              handleSize: v3.icon.lg,
            }}
            renderRow={(entry, handle) => (
              <LanguageRow
                code={entry.code}
                name={names.language(entry.code)}
                paused={paused.has(entry.code)}
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

      {/* The way out, not the thing that writes: every tap is already saved. */}
      <View style={styles.footer}>
        <Button label={t('common.save')} onPress={back} />
      </View>
    </Screen>
  )
}

/** One language: its code on its colour, its name (the button that replaces it), and ×. */
function LanguageRow({
  code,
  name,
  paused = false,
  level,
  onLevel,
  onChange,
  onRemove,
  handle,
}: {
  code: string
  name: string
  paused?: boolean
  level?: LanguageLevel
  onLevel?: (level: LanguageLevel) => void
  onChange: () => void
  onRemove: () => void
  handle?: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()
  const levels = LANGUAGE_LEVELS.map((option) => ({
    level: option,
    label: levelShortLabel(t, option),
  }))

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
          <View style={[styles.code, { backgroundColor: v3.hues[partnerHueFor(code)] }]}>
            <Text style={styles.codeText}>{code.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Feather
            name={isRtl ? 'chevron-left' : 'chevron-right'}
            size={v3.icon.md}
            color={v3.colors.muted}
          />
        </Pressable>
        <IconButton
          icon="x"
          accessibilityLabel={`${t('common.remove')} · ${name}`}
          color={v3.colors.muted}
          onPress={onRemove}
        />
      </View>
      {paused ? <Text style={styles.paused}>{t('languages.pausedNote')}</Text> : null}
      {level && onLevel ? (
        <LevelChoiceV3
          label={t('languages.levelGroup', { language: name })}
          options={levels}
          value={level}
          onChange={(next) => onLevel(next)}
        />
      ) : null}
    </View>
  )
}

/**
 * Always drawn, never dimmed: at the cap it says the number and offers the
 * plan. `upsell` is that sentence, read after the label; the eye gets the Pro
 * mark instead.
 */
function AddRow({
  label,
  upsell,
  onPress,
}: {
  label: string
  upsell?: string | undefined
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={upsell ? `${label}. ${upsell}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.add, pressed && styles.pressed]}
    >
      <Feather name="plus" size={v3.icon.lg} color={v3.colors.fg} />
      <Text style={styles.addLabel}>{label}</Text>
      {upsell ? (
        <View style={styles.pro}>
          <Text style={styles.proText}>{TIER_NAMES.pro}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12], marginTop: v3.space[8] },
  scroll: { flex: 1 },
  content: { gap: v3.space[20], paddingBottom: v3.space[20] },
  section: { gap: v3.space[8] },
  row: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    marginBottom: v3.space[8],
    paddingEnd: v3.space[4],
    paddingStart: v3.space[8],
    paddingVertical: v3.space[8],
  },
  rowHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  rowName: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: ICON_BUTTON_TARGET,
  },
  code: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  codeText: { ...v3.type.label, color: v3.colors.ink },
  name: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  // The drag's own target, at the platform's minimum: gesture-handler
  // hit-tests the view itself, so a `hitSlop` would not reach it.
  handle: { height: ICON_BUTTON_TARGET, width: ICON_BUTTON_TARGET },
  paused: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  pressed: { opacity: 0.6 },
  add: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingHorizontal: v3.space[16],
  },
  addLabel: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  pro: {
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  proText: { ...v3.type.label, color: v3.colors.pillText },
  hint: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  footer: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: v3.space[16],
    paddingTop: v3.space[8],
  },
}))
