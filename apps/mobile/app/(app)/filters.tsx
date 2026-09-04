import {
  GENDERS,
  LANGUAGE_LEVELS,
  levelRank,
  TIER_BADGES,
  tierUnlocking,
  type LanguageLevel,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useDebounced } from '../../src/hooks/useDebounced'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useCitySearch, useHasFeature, useMe } from '../../src/api/queries'
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
  type DiscoveryFilters,
  activeCount,
  parseFilters,
  scopeOf,
  toParams,
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
  const learningCodes = learning.map((l) => l.code)
  const native = me.data?.nativeLanguages ?? []
  const nativeCodes = native.map((l) => l.code)

  /**
   * The language scope, as chips: every language ticked until one is not. The
   * same two lists the header's sheet edits, through the same params, so the
   * two controls cannot disagree. The last ticked language in a group stays
   * ticked — a search with no language is refused by the server.
   */
  function toggleScope(key: 'learningLanguages' | 'nativeLanguages', code: string): void {
    const all = key === 'learningLanguages' ? learningCodes : nativeCodes
    const picked = filters[key] ?? all
    const next = picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code]
    if (next.length === 0) return
    set(
      key === 'learningLanguages'
        ? { learningLanguages: scopeOf(next, all) }
        : { nativeLanguages: scopeOf(next, all) },
    )
  }

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
   * Drafted locally: the filter is committed when a city is chosen from the
   * list, not on each keystroke, which would rewrite the route params — and
   * therefore refetch Discover — once a letter.
   */
  const [cityDraft, setCityDraft] = useState(filters.cityName ?? '')
  // The query follows the settled value, so typing stays responsive and
  // "istanbul" is one request rather than eight.
  const cityResults = useCitySearch(useDebounced(cityDraft))
  const cityOptions = cityResults.data?.items ?? []

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
    router.replace({ pathname: '/(app)/(tabs)/discover', params: toParams(filters) })
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
          onBack={() => goBackTo('/(app)/(tabs)/discover')}
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
            {learning.map((language) => (
              <Chip
                key={language.code}
                label={names.language(language.code)}
                selected={(filters.learningLanguages ?? learningCodes).includes(language.code)}
                onPress={() => toggleScope('learningLanguages', language.code)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title={t('filters.learns')} />
          <Text style={styles.hint}>{t('filters.learnsBody')}</Text>
          <View style={styles.row}>
            {native.map((language) => (
              <Chip
                key={language.code}
                label={names.language(language.code)}
                selected={(filters.nativeLanguages ?? nativeCodes).includes(language.code)}
                onPress={() => toggleScope('nativeLanguages', language.code)}
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
          A picker, not a text box. Both ends of this filter used to be free
          text — somebody typed their city, somebody else typed the one they
          were looking for, and a fold on both sides made them meet. A profile's
          city is now read off its coordinates against a fixed list, so the only
          honest way to search it is to choose from the same list.

          Locked as a whole rather than per keystroke: a paywall that fires on
          the first letter typed is a worse way to learn the rule than one tap
          on a field that says PRO.
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
              onChangeText={(text) => {
                setCityDraft(text)
                // Clearing the box clears the filter. Leaving the old id behind
                // while the box reads empty is a filter nobody can see.
                if (!text.trim() && filters.cityId)
                  set({ cityId: undefined, cityName: undefined }, true)
              }}
              placeholder={t('filters.cityPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={64}
              style={styles.cityInput}
              // A disabled input still has to announce why it is disabled.
              pointerEvents={isPro ? 'auto' : 'none'}
            />
          </Pressable>
          {isPro && cityOptions.length > 0 && cityDraft.trim() !== filters.cityName ? (
            <View style={styles.cityList}>
              {cityOptions.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setCityDraft(option.name)
                    set({ cityId: option.id, cityName: option.name }, true)
                  }}
                  style={({ pressed }) => [styles.cityOption, pressed && styles.pressed]}
                >
                  <Text style={styles.cityOptionName}>{option.name}</Text>
                  <Text style={styles.cityOptionWhere}>
                    {[option.admin1, option.countryCode].filter(Boolean).join(', ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {/*
            Said plainly rather than left to be discovered: a city is worked out
            from a shared location, so this filter can only ever answer for
            people who share one.
          */}
          <Text style={styles.hint}>{t('filters.cityNeedsLocation')}</Text>
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
  /** Under the field, like the search results on Discover's own row. */
  cityList: { borderRadius: radius.md, marginTop: spacing.sm, overflow: 'hidden' },
  cityOption: {
    backgroundColor: colors.fill,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cityOptionName: { ...font.body, color: colors.text },
  cityOptionWhere: { ...font.caption, color: colors.textMuted },
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
