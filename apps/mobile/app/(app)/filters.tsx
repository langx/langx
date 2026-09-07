import Feather from '@expo/vector-icons/Feather'
import {
  GENDERS,
  LANGUAGE_LEVELS,
  levelRank,
  TIER_BADGES,
  tierUnlocking,
  type Gender,
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
import { RangeSlider } from '../../src/components/ui/RangeSlider'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
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
import { genderLabel, useDisplayNames, useLocale, useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/** Explicit `undefined` means "clear this filter" — see `set` below. */
type FilterPatch = { [K in keyof DiscoveryFilters]?: DiscoveryFilters[K] | undefined }

/** One segment per level, plus the one that means no band at all. */
type LevelChoice = 'any' | LanguageLevel
type GenderChoice = 'any' | Gender

/**
 * A section header in v3's quiet voice, with the plan tag on the gated ones —
 * shown rather than hidden, because someone has to see what the plan is for,
 * and hiding it makes the paywall feel like a surprise rather than an offer.
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
  useScreenInteractive()
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
  const [cityFocused, setCityFocused] = useState(false)
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

  function reset(): void {
    setFilters({})
    // The box would otherwise keep showing a city over a filter that is gone.
    setCityDraft('')
  }

  function apply(): void {
    // `replace`, not `push`: the filter screen has done its job and should not
    // sit in the history behind the results it produced.
    router.replace({ pathname: '/(app)/(tabs)/discover', params: toParams(filters) })
  }

  /**
   * The level band, as segment indices. Tapping outside the band extends it to
   * the tap; tapping an edge shrinks past it; tapping inside collapses to that
   * one level — so any band is reachable in at most two taps and a selected
   * band can always be dismantled the way it was built. "Any" clears it.
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

  const levelOptions: { value: LevelChoice; label: string }[] = [
    { value: 'any', label: t('common.any') },
    // Digits, as the prototype draws them: four level names do not fit five
    // segments, and the rank is the number the bars already count to.
    ...LANGUAGE_LEVELS.map((level) => ({ value: level, label: String(levelRank(level)) })),
  ]
  const levelSelected: LevelChoice[] =
    bandMin === null || bandMax === null ? ['any'] : LANGUAGE_LEVELS.slice(bandMin, bandMax + 1)

  const genderOptions: { value: GenderChoice; label: string }[] = [
    { value: 'any', label: t('common.any') },
    ...GENDERS.filter((gender) => gender !== 'undisclosed').map((gender) => ({
      value: gender,
      label: genderLabel(t, gender),
    })),
  ]

  /**
   * The slider always holds a concrete pair; "no filter" is the full span.
   * The right handle at the top is an open end — it reads `55+` and sends no
   * `ageMax`, matching what the old top bracket meant.
   */
  const ageLow = filters.ageMin ?? AGE_SLIDER.min
  const ageHigh = filters.ageMax ?? AGE_SLIDER.max

  function setAges([low, high]: [number, number]): void {
    set({
      ageMin: low === AGE_SLIDER.min ? undefined : low,
      ageMax: high === AGE_SLIDER.max ? undefined : high,
    })
  }

  // Always the range, never "Any": the handles are the range, and the label
  // is what they are pointing at.
  const ageText =
    ageHigh === AGE_SLIDER.max
      ? t('filters.ageRangeOpen', { min: ageLow, max: AGE_SLIDER.max })
      : t('filters.ageRange', { min: ageLow, max: ageHigh })

  const count = activeCount(filters)

  return (
    <Screen fluid style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          hitSlop={12}
          onPress={() => goBackTo('/(app)/(tabs)/discover')}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {t('filters.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={reset}
          hitSlop={8}
          style={styles.resetButton}
        >
          <Text style={styles.reset}>{t('common.reset')}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        // The city field is the last thing on the screen; without this iOS
        // covers it with the keyboard as you type. See `Screen` for the split.
        automaticallyAdjustKeyboardInsets
      >
        <View style={[styles.section, styles.first]}>
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

        <View style={[styles.section, styles.gapMd]}>
          <SectionTitle title={t('filters.theirLevel')} />
          <Text style={styles.hint}>{t('filters.theirLevelBody')}</Text>
          <SegmentedControl
            options={levelOptions}
            selected={levelSelected}
            onToggle={(value) => {
              if (value === 'any') set({ minLevel: undefined, maxLevel: undefined })
              else tapLevel(LANGUAGE_LEVELS.indexOf(value))
            }}
            accessibilityLabel={t('filters.theirLevel')}
          />
        </View>

        <View style={[styles.section, styles.gapLg]}>
          <View style={styles.spread}>
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

        <View style={[styles.section, styles.gapMd]}>
          <SectionTitle title={t('filters.country')} />
          <CountryPicker
            value={filters.country ?? ''}
            onChange={(country) => set({ country: country || undefined })}
          />
        </View>

        {/*
          One section, two rules. Naming a gender is a way of searching for
          other people and stays paid; matching your own is a comfort setting
          and is free — see `DISCOVERY_PRO_FILTER_KEYS`. They are still
          mutually exclusive, so each one clears the other, and clearing is
          never a paid action even when the thing being cleared is.
        */}
        <View style={[styles.section, styles.gapMd]}>
          <SectionTitle title={t('filters.gender')} locked={!isPro} />
          <SegmentedControl
            options={genderOptions}
            selected={[filters.gender ?? 'any']}
            onToggle={(value) =>
              value === 'any'
                ? set({ gender: undefined }, true)
                : set(
                    {
                      gender: filters.gender === value ? undefined : value,
                      onlyMyGender: undefined,
                    },
                    true,
                  )
            }
            accessibilityLabel={t('filters.gender')}
          />
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

        {/*
          A picker, not a text box. Both ends of this filter used to be free
          text — somebody typed their city, somebody else typed the one they
          were looking for, and a fold on both sides made them meet. A profile's
          city is now read off its coordinates against a fixed list, so the only
          honest way to search it is to choose from the same list.

          Locked as a whole rather than per keystroke: a paywall that fires on
          the first letter typed is a worse way to learn the rule than one tap
          on a field that says which plan.
        */}
        <View style={[styles.section, styles.last]}>
          <SectionTitle title={t('filters.city')} locked={!isPro} />
          {/*
            Said plainly rather than left to be discovered: a city is worked out
            from a shared location, so this filter can only ever answer for
            people who share one.
          */}
          <Text style={styles.hint}>{t('filters.cityNeedsLocation')}</Text>
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
              onFocus={() => setCityFocused(true)}
              onBlur={() => setCityFocused(false)}
              placeholder={t('filters.cityPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={64}
              style={[styles.cityInput, cityFocused && styles.cityInputFocused]}
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
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={
            count > 0 ? t('filters.showResultsWithCount', { count }) : t('filters.showResults')
          }
          onPress={apply}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // The header and footer hairlines run edge to edge, so the screen's gutter
  // moves onto the three blocks themselves — the same shape as the chat screen.
  screen: { paddingHorizontal: 0 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingBottom: spacing.md,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  // 34 square: the glyph's own hit box, before `hitSlop` widens it.
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  title: { ...font.heading, color: colors.text, flex: 1, fontSize: 24 },
  resetButton: { height: 40, justifyContent: 'center', paddingHorizontal: 10 },
  reset: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  body: { flex: 1 },
  content: { paddingHorizontal: 20 },
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingVertical: 22,
  },
  first: { paddingTop: spacing.lg },
  last: { borderBottomWidth: 0, paddingBottom: spacing.xxl },
  gapMd: { gap: spacing.md },
  gapLg: { gap: 14 },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sectionTitle: { ...font.heading, color: colors.text, fontSize: 17 },
  // Ringed in `pro` at 35%, as the prototype has it. `pro` is a six-digit hex
  // in both schemes, so the alpha byte can be appended rather than parsed in.
  proTag: {
    borderColor: `${colors.pro}59`,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.pro,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  spread: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  ageValue: { ...font.heading, color: colors.accent, fontSize: 16 },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, paddingTop: 6 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  switchHint: { color: colors.textMuted, fontSize: 13 },
  // Radius 14, not the pill: the prototype's one square-ish field. The border
  // is there from the start so focusing does not shift the text by a pixel.
  cityInput: {
    backgroundColor: colors.fill,
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    height: 52,
    paddingHorizontal: 18,
  },
  cityInputFocused: { backgroundColor: colors.bg, borderColor: colors.accent },
  /** Under the field, like the search results on Discover's own row. */
  cityList: { borderRadius: 14, overflow: 'hidden' },
  cityOption: {
    backgroundColor: colors.fill,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingHorizontal: 18,
    paddingVertical: spacing.sm + 2,
  },
  cityOptionName: { color: colors.text, fontSize: 16 },
  cityOptionWhere: { color: colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.7 },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
  },
}))
