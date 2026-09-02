import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { LevelBars, LEVEL_SCALE } from '../../src/components/ui/LevelBars'
import { ListRow } from '../../src/components/ui/ListRow'
import { RangeSlider } from '../../src/components/ui/RangeSlider'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { StatTile } from '../../src/components/ui/StatTile'
import { Toggle } from '../../src/components/ui/Toggle'
import { isDebugPanelEnabled } from '../../src/lib/debugPanel'
import { KITCHEN_SECTIONS } from '../../src/lib/externalLinks'
import { goBackTo } from '../../src/lib/navigation'
import { openExternal } from '../../src/lib/openExternal'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * Our Kitchen — where the project is made, and everything around it: the people
 * who built it, the places to support it, and the pages that say what it is.
 *
 * v1 had this page and v2 lost it, which cost more than a list of links: it is
 * the only route from the app to the Discord, to the backers, and to the
 * repository this whole thing is open about. Every row leaves the app, so
 * every row goes through the in-app browser rather than switching away.
 */
export default function KitchenScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  return (
    <Screen scroll fluid>
      <ScreenHeader title={t('kitchen.title')} onBack={() => goBackTo('/(app)/settings')} />
      <Text style={styles.intro}>{t('kitchen.intro')}</Text>

      {KITCHEN_SECTIONS.map((section) => (
        <View key={section.titleKey}>
          <Text style={styles.section}>{t(section.titleKey)}</Text>
          {section.rows.map((row, index) => (
            <ListRow
              key={`${section.titleKey}-${row.label ?? row.labelKey}`}
              title={row.label ?? t(row.labelKey as never)}
              onPress={() => void openExternal(row.url)}
              last={index === section.rows.length - 1}
              accessory={
                <Feather
                  // The icon set types its own names; the link table is plain
                  // data and does not import them.
                  name={row.icon as never}
                  size={17}
                  color={colors.textMuted}
                />
              }
            />
          ))}
        </View>
      ))}

      {isDebugPanelEnabled() ? <ComponentGallery /> : null}

      {/*
        A licence condition, not a courtesy: the city list is CC BY 4.0 and the
        attribution has to be somewhere a person can find it. `docs/data-sources.md`
        records the other two places it appears.
      */}
      <Text style={styles.footer}>{t('kitchen.dataCredit')}</Text>

      <Text style={styles.footer}>{t('kitchen.footer')}</Text>
    </Screen>
  )
}

type GallerySegment = 'one' | 'two' | 'three'

/**
 * A live sample of the v3 kit — every restyled control with real state, for
 * checking them against the design in one place. Debug builds only, so the
 * labels are raw strings on `DebugQuotaPanel`'s bargain: `isDebugPanelEnabled`
 * keeps this out of every shipped bundle, and nothing here needs product copy.
 */
function ComponentGallery() {
  const styles = useStyles()

  const [segment, setSegment] = useState<GallerySegment>('one')
  const [chipOn, setChipOn] = useState(true)
  const [toggleOn, setToggleOn] = useState(true)
  const [ages, setAges] = useState<[number, number]>([24, 41])

  return (
    <View>
      <Text style={styles.section}>DEBUG · component gallery</Text>

      <View style={styles.galleryBlock}>
        <Button label="Primary" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
      </View>

      <View style={styles.galleryRow}>
        <Chip label="Toggles" selected={chipOn} onPress={() => setChipOn((on) => !on)} />
        <Chip label="Plain" />
        <Chip label="Accent" tone="accent" selected />
        <Chip label="Streak" tone="streak" selected />
      </View>

      <View style={styles.galleryBlock}>
        <SegmentedControl<GallerySegment>
          accessibilityLabel="Gallery segments"
          options={[
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
            { value: 'three', label: 'Three' },
          ]}
          selected={[segment]}
          onToggle={setSegment}
        />
      </View>

      <View style={styles.galleryRow}>
        <StatTile value="128" label="Days" />
        <StatTile value="26" label="Corrections" tone="success" />
        <StatTile value="940" label="Tokens" />
      </View>

      <ListRow
        title="List row"
        subtitle="Edge to edge, hairline divider"
        accessory={
          <Toggle
            accessibilityLabel="Gallery toggle"
            value={toggleOn}
            onValueChange={setToggleOn}
          />
        }
      />
      <ListRow title="Tappable row" value="Value" onPress={() => {}} last />

      <View style={styles.galleryRow}>
        {LEVEL_SCALE.map((level) => (
          <LevelBars key={level} level={level} />
        ))}
        <LevelBars level="fluent" native />
      </View>

      <RangeSlider
        min={18}
        max={70}
        values={ages}
        onChange={setAges}
        accessibilityLabel="Gallery range"
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  intro: { ...font.body, color: colors.textMuted, marginTop: spacing.xs },
  /** v3's section kicker: 13/600, faint, flush with the rows it introduces. */
  section: {
    ...font.label,
    color: colors.textFaint,
    marginTop: spacing.xl,
  },
  footer: {
    ...font.caption,
    color: colors.textFaint,
    marginBottom: spacing.xxl,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  galleryBlock: { gap: spacing.sm, marginTop: spacing.lg },
  galleryRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
}))
