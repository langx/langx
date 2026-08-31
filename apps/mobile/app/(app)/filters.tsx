import {
  CITY_MAX_LENGTH,
  GENDERS,
  LANGUAGE_LEVELS,
  levelRank,
  TIER_BADGES,
  tierUnlocking,
  type LanguageLevel,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useHasFeature, useMe } from '../../src/api/queries'
import { CountryPicker } from '../../src/components/CountryPicker'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { RangeSlider } from '../../src/components/ui/RangeSlider'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Toggle } from '../../src/components/ui/Toggle'
import { goBackTo } from '../../src/lib/navigation'
import { openPaywall } from '../../src/lib/paywall'
import {
  AGE_SLIDER,
  activeCount,
  parseFilters,
  toParams,
  type DiscoveryFilters,
} from '../../src/lib/discoveryFilters'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { genderLabel, levelShortLabel, useDisplayNames, useLocale, useT } from '../../src/i18n'

/** Explicit `undefined` means "clear this filter" — see `set` below. */
type FilterPatch = { [K in keyof DiscoveryFilters]?: DiscoveryFilters[K] | undefined }

/**
 * A section header in v3's quiet voice, with the neutral PRO tag on the gated
 * ones — shown rather than hidden, because someone has to see what Pro is
 * for, and hiding it makes the paywall feel like a surprise rather than an
 * offer.
 */
function SectionTitle({ title, locked }: { title: string; locked?: boolean }) {
  const styles = useStyles()
  // Names the plan that actually unlocks this row rather than a fixed word, so
  // moving a filter between tiers moves the tag with it. `tierUnlocking` reads
  // the real table, which is why it can be trusted to stay right.
  const badge = TIER_BADGES[tierUnlocking('advancedFilters') ?? 'free']

  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {locked && badge ? <Text style={styles.proTag}>{badge}</Text> : null}
    </View>
  )
}

export default function FiltersScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  const params = useLocalSearchParams<Record<string, string>>()
  const me = useMe()
  /*
   * `advancedFilters`, not "any paid plan". Correct by accident while every
   * gated filter was Fluent's; correct by construction now. On discover it is
   * load-bearing: this decides whether to strip Pro filters before asking, and
   * if it disagrees with the server the reader gets a 403 instead of a list.
   */
  const isPro = useHasFeature('advancedFilters')
  const myGender = me.data?.gender

  const [filters, setFilters] = useState<DiscoveryFilters>(() => parseFilters(params))

  const learning = me.data?.learning ?? []

  /**
   * Every control in a locked section routes to the paywall instead of
   * changing anything. One guard rather than a disabled state on each control:
   * a disabled chip tells the user nothing about why it is disabled.
   *
   * `undefined` in a patch *removes* the key rather than storing it, which is
   * what "no filter" actually means here — an absent key is what `toParams`
   * and the API both read as unfiltered, and under `exactOptionalPropertyTypes`
   * it is also the only well-typed way to say it.
   */
  /*
   * The city field is drafted locally and committed on blur, unlike every
   * other control here, which commits on press. Committing per keystroke would
   * rewrite the route params — and therefore refetch Discover — once a letter.
   */
  const [cityDraft, setCityDraft] = useState(filters.city ?? '')

  function set(patch: FilterPatch, pro = false): void {
    if (pro && !isPro) {
      openPaywall('advancedFilters', '/(app)/filters')
      return
    }
    setFilters((current) => {
      const next: FilterPatch = { ...current, ...patch }
      for (const key of Object.keys(next) as (keyof DiscoveryFilters)[]) {
        if (next[key] === undefined) delete next[key]
      }
      return next as DiscoveryFilters
    })
  }

  function apply(): void {
    // `replace`, not `push`: the filter screen has done its job and should not
    // sit in the history behind the results it produced.
    router.replace({ pathname: '/(app)/discover', params: toParams(filters) })
  }

  /**
   * The level band, as pill indices. Tapping outside the band extends it to
   * the tap; tapping an edge shrinks past it; tapping inside collapses to that
   * one level — so any band is reachable in at most two taps and a selected
   * band can always be dismantled the way it was built.
   */
  const bandMin = filters.minLevel ? levelRank(filters.minLevel) - 1 : null
  const bandMax = filters.maxLevel
    ? levelRank(filters.maxLevel) - 1
    : bandMin !== null
      ? LANGUAGE_LEVELS.length - 1
      : null

  function tapLevel(index: number): void {
    const level = LANGUAGE_LEVELS[index] as LanguageLevel
    if (bandMin === null || bandMax === null) {
      set({ minLevel: level, maxLevel: level })
      return
    }
    if (index < bandMin) {
      set({ minLevel: level })
    } else if (index > bandMax) {
      set({ maxLevel: level })
    } else if (bandMin === bandMax && index === bandMin) {
      set({ minLevel: undefined, maxLevel: undefined })
    } else if (index === bandMin) {
      set({ minLevel: LANGUAGE_LEVELS[index + 1] })
    } else if (index === bandMax) {
      set({ maxLevel: LANGUAGE_LEVELS[index - 1] })
    } else {
      set({ minLevel: level, maxLevel: level })
    }
  }

  /**
   * The slider always holds a concrete pair; "no filter" is the full span.
   * The right handle at the top is an open end — it reads `55+` and sends no
   * `ageMax`, matching what the old top bracket meant.
   */
  const ageLow = filters.ageMin ?? AGE_SLIDER.min
  const ageHigh = filters.ageMax ?? AGE_SLIDER.max
  const ageIsAny = filters.ageMin === undefined && filters.ageMax === undefined

  function setAges([low, high]: [number, number]): void {
    set({
      ageMin: low === AGE_SLIDER.min ? undefined : low,
      ageMax: high === AGE_SLIDER.max ? undefined : high,
    })
  }

  const ageText = ageIsAny
    ? t('common.any')
    : ageHigh === AGE_SLIDER.max
      ? t('filters.ageRangeOpen', { min: ageLow, max: AGE_SLIDER.max })
      : t('filters.ageRange', { min: ageLow, max: ageHigh })

  const count = activeCount(filters)

  return (
    <Screen fluid>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={t('filters.title')}
          onBack={() => goBackTo('/(app)/discover')}
          trailing={
            <Pressable onPress={() => setFilters({})} hitSlop={8}>
              <Text style={styles.reset}>{t('common.reset')}</Text>
            </Pressable>
          }
        />

        <View style={styles.section}>
          <SectionTitle title={t('filters.speaks')} />
          <Text style={styles.hint}>{t('filters.practiseBody')}</Text>
          <View style={styles.row}>
            <Chip
              label={t('common.any')}
              selected={!filters.targetLanguage}
              onPress={() => set({ targetLanguage: undefined })}
            />
            {learning.map((language) => (
              <Chip
                key={language.code}
                label={names.language(language.code)}
                selected={filters.targetLanguage === language.code}
                onPress={() => set({ targetLanguage: language.code })}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title={t('filters.theirLevel')} />
          <Text style={styles.hint}>{t('filters.theirLevelBody')}</Text>
          <View style={styles.levelRow}>
            {LANGUAGE_LEVELS.map((level, index) => {
              const on =
                bandMin !== null && bandMax !== null && index >= bandMin && index <= bandMax
              return (
                <Pressable
                  key={level}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={levelShortLabel(t, level)}
                  onPress={() => tapLevel(index)}
                  style={({ pressed }) => [
                    styles.levelPill,
                    on ? styles.levelOn : styles.levelOff,
                    pressed && styles.pressed,
                  ]}
                >
                  <LevelBars
                    level={level}
                    color={on ? colors.bg : colors.textFaint}
                    restColor={on ? colors.onInkMuted : colors.border}
                  />
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.ageHead}>
            <SectionTitle title={t('filters.age')} />
            <Text style={styles.ageValue}>{ageText}</Text>
          </View>
          <RangeSlider
            min={AGE_SLIDER.min}
            max={AGE_SLIDER.max}
            values={[ageLow, ageHigh]}
            onChange={(next) => setAges(next)}
            accessibilityLabel={t('filters.age')}
          />
        </View>

        {/*
          Two sections where there used to be one, because the paywall no
          longer runs through the middle of the pair. Naming a gender is a way
          of searching for other people and stays paid; matching your own is a
          comfort setting and is free — see `DISCOVERY_PRO_FILTER_KEYS`. They
          are still mutually exclusive, so each one clears the other, and
          clearing is never a paid action even when the thing being cleared is.
        */}
        <View style={styles.section}>
          <SectionTitle title={t('filters.gender')} locked={!isPro} />
          <View style={styles.row}>
            <Chip
              label={t('common.any')}
              selected={!filters.gender}
              onPress={() => set({ gender: undefined }, true)}
            />
            {GENDERS.filter((gender) => gender !== 'undisclosed').map((gender) => (
              <Chip
                key={gender}
                label={genderLabel(t, gender)}
                selected={filters.gender === gender}
                onPress={() =>
                  set(
                    {
                      gender: filters.gender === gender ? undefined : gender,
                      onlyMyGender: undefined,
                    },
                    true,
                  )
                }
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>{t('filters.onlyMyGender')}</Text>
              <Text style={styles.switchHint}>
                {myGender && myGender !== 'undisclosed'
                  ? t('filters.onlyMyGenderBody', {
                      gender: genderLabel(t, myGender).toLocaleLowerCase(locale),
                    })
                  : t('filters.onlyMyGenderMissing')}
              </Text>
            </View>
            <Toggle
              accessibilityLabel={t('filters.onlyMyGender')}
              value={filters.onlyMyGender === true}
              disabled={!myGender || myGender === 'undisclosed'}
              onValueChange={(value) =>
                set({ onlyMyGender: value ? true : undefined, gender: undefined })
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title={t('filters.country')} />
          <CountryPicker
            value={filters.country ?? ''}
            onChange={(country) => set({ country: country || undefined })}
          />
        </View>

        {/*
          Free text, not a picker: there is no city list to pick from, and the
          server matches on a folded key so case, accents and punctuation do
          not have to agree. Locked as a whole rather than per keystroke — a
          paywall that fires on the first letter typed is a worse way to learn
          the rule than one tap on a field that says PRO.
        */}
        <View style={[styles.section, styles.last]}>
          <SectionTitle title={t('filters.city')} locked={!isPro} />
          <Text style={styles.hint}>{t('filters.cityBody')}</Text>
          <Pressable
            disabled={isPro}
            onPress={() => openPaywall('advancedFilters', '/(app)/filters')}
          >
            <TextInput
              value={cityDraft}
              editable={isPro}
              onChangeText={setCityDraft}
              onEndEditing={() => set({ city: cityDraft.trim() || undefined }, true)}
              placeholder={t('filters.cityPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={CITY_MAX_LENGTH}
              style={styles.cityInput}
              // A disabled input still has to announce why it is disabled.
              pointerEvents={isPro ? 'auto' : 'none'}
            />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Button
            label={
              count > 0 ? t('filters.showResultsWithCount', { count }) : t('filters.showResults')
            }
            onPress={apply}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  content: { paddingBottom: spacing.xxl },
  reset: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.lg + 2,
  },
  last: { borderBottomWidth: 0 },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  proTag: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  hint: { ...font.caption, color: colors.textFaint, marginTop: 2 },
  cityInput: {
    ...font.body,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    color: colors.text,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  levelRow: { flexDirection: 'row', gap: 7, marginTop: spacing.md },
  levelPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingTop: 11,
  },
  levelOn: { backgroundColor: colors.ink },
  levelOff: { borderColor: colors.border, borderWidth: 1 },
  pressed: { opacity: 0.7 },
  ageHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ageValue: { ...font.heading, fontSize: 17, color: colors.text },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  switchText: { flex: 1 },
  switchLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  switchHint: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  actions: { marginTop: spacing.xl },
}))
