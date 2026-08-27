import { CEFR_LEVELS, GENDERS, getLanguage, type CefrLevel, type Gender } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useIsPro, useMe } from '../../src/api/queries'
import { CountryPicker } from '../../src/components/CountryPicker'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { Screen } from '../../src/components/ui/Screen'
import {
  AGE_BRACKETS,
  activeCount,
  parseFilters,
  toParams,
  type DiscoveryFilters,
} from '../../src/lib/discoveryFilters'
import { colors, font, radius, spacing } from '../../src/lib/theme'

/** Explicit `undefined` means "clear this filter" — see `set` below. */
type FilterPatch = { [K in keyof DiscoveryFilters]?: DiscoveryFilters[K] | undefined }

const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: 'Prefer not to say',
}

/**
 * A section header. `locked` marks the ones a free account cannot use — shown
 * rather than hidden, because someone has to see what Pro is for, and hiding
 * it makes the paywall feel like a surprise rather than an offer.
 */
function SectionTitle({ title, locked }: { title: string; locked?: boolean }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {locked ? <Chip label="PRO" tone="pro" /> : null}
    </View>
  )
}

export default function FiltersScreen() {
  const params = useLocalSearchParams<Record<string, string>>()
  const me = useMe()
  const isPro = useIsPro()
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
  function set(patch: FilterPatch, pro = false): void {
    if (pro && !isPro) {
      router.push('/(app)/paywall')
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

  const count = activeCount(filters)

  return (
    <Screen fluid>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Filters</Text>

        <SectionTitle title="Language" />
        <Text style={styles.hint}>
          Which of your own languages you want to practise. Everyone here already speaks it
          natively.
        </Text>
        <View style={styles.row}>
          <Chip
            label="Any"
            selected={!filters.targetLanguage}
            onPress={() => set({ targetLanguage: undefined })}
          />
          {learning.map((language) => (
            <Chip
              key={language.code}
              label={getLanguage(language.code)?.name ?? language.code}
              selected={filters.targetLanguage === language.code}
              onPress={() => set({ targetLanguage: language.code })}
            />
          ))}
        </View>

        <SectionTitle title="Availability" />
        <View style={styles.row}>
          <Chip
            label="Online now"
            tone="accent"
            selected={filters.online === true}
            onPress={() => set({ online: filters.online ? undefined : true })}
          />
        </View>

        <SectionTitle title="Gender" locked={!isPro} />
        <View style={styles.row}>
          <Chip
            label="Any"
            selected={!filters.gender && !filters.onlyMyGender}
            onPress={() => set({ gender: undefined, onlyMyGender: undefined }, true)}
          />
          {GENDERS.filter((gender) => gender !== 'undisclosed').map((gender) => (
            <Chip
              key={gender}
              label={GENDER_LABELS[gender]}
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

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Only my gender</Text>
            <Text style={styles.switchHint}>
              {myGender && myGender !== 'undisclosed'
                ? `Show only people who are ${GENDER_LABELS[myGender].toLowerCase()}, like you.`
                : 'Add your own gender to your profile to use this.'}
            </Text>
          </View>
          <Switch
            value={filters.onlyMyGender === true}
            disabled={!myGender || myGender === 'undisclosed'}
            onValueChange={(value) =>
              set({ onlyMyGender: value ? true : undefined, gender: undefined }, true)
            }
          />
        </View>

        <SectionTitle title="Age" locked={!isPro} />
        <View style={styles.row}>
          <Chip
            label="Any"
            selected={filters.ageMin === undefined && filters.ageMax === undefined}
            onPress={() => set({ ageMin: undefined, ageMax: undefined }, true)}
          />
          {AGE_BRACKETS.map((bracket) => {
            const max = 'ageMax' in bracket ? bracket.ageMax : undefined
            const selected = filters.ageMin === bracket.ageMin && filters.ageMax === max
            return (
              <Chip
                key={bracket.label}
                label={bracket.label}
                selected={selected}
                onPress={() =>
                  set(
                    selected
                      ? { ageMin: undefined, ageMax: undefined }
                      : { ageMin: bracket.ageMin, ageMax: max },
                    true,
                  )
                }
              />
            )
          })}
        </View>

        <SectionTitle title="Their level in your language" locked={!isPro} />
        <Text style={styles.hint}>
          How well they already speak what you teach. Higher means an easier conversation, lower
          means someone who needs you more.
        </Text>
        <View style={styles.row}>
          <Chip
            label="Any"
            selected={!filters.minLevel}
            onPress={() => set({ minLevel: undefined }, true)}
          />
          {CEFR_LEVELS.map((level: CefrLevel) => (
            <Chip
              key={level}
              label={`${level}+`}
              selected={filters.minLevel === level}
              onPress={() =>
                set({ minLevel: filters.minLevel === level ? undefined : level }, true)
              }
            />
          ))}
        </View>

        <SectionTitle title="Country" locked={!isPro} />
        <CountryPicker
          value={filters.country ?? ''}
          onChange={(country) => set({ country: country || undefined }, true)}
          {...(isPro ? {} : { onLocked: () => router.push('/(app)/paywall') })}
        />

        <View style={styles.actions}>
          <Button label={count > 0 ? `Show results · ${count}` : 'Show results'} onPress={apply} />
          <Pressable onPress={() => setFilters({})} hitSlop={8} style={styles.reset}>
            <Text style={styles.resetLabel}>Reset all</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  back: { ...font.body, color: colors.textMuted, paddingVertical: spacing.sm },
  title: { ...font.title, color: colors.text, marginBottom: spacing.sm },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  sectionTitle: { ...font.label, color: colors.textMuted },
  hint: { ...font.caption, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchText: { flex: 1 },
  switchLabel: { ...font.body, color: colors.text, fontWeight: '600' },
  switchHint: { ...font.caption, color: colors.textMuted },
  search: {
    ...font.body,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
  reset: { alignSelf: 'center' },
  resetLabel: { ...font.body, color: colors.textMuted },
})
