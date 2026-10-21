import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * People search and the Filters page's slider and country picker have a
 * second drawing under `flags.v3Home`. The search and the picker keep their
 * logic in the current file and hand a drawing-only twin what to show, so the
 * promise is the Settings pages' one (`settingsScreensV3.test.ts`): every
 * message key and accessibility role the current drawing uses, the twin uses
 * too — the "nobody found" line, the cancel a screen reader hears, the search
 * field's placeholder cannot go missing from one look.
 */
const COMPONENTS = path.resolve(__dirname, '../components')
const APP = path.resolve(__dirname, '../../app')

const file = (name: string): string => path.join(COMPONENTS, name)
const text = (name: string): string => readFileSync(name, 'utf8')

describe('PeopleSearch in v3', () => {
  const current = uses(file('PeopleSearch.tsx'))
  const twin = uses(file('PeopleSearchV3.tsx'))

  it('switches on the flag and draws both halves from the twin', () => {
    const source = text(file('PeopleSearch.tsx'))
    expect(source).toContain('useV3Home()')
    expect(source).toContain('<PeopleSearchFieldV3')
    expect(source).toContain('<PeopleSearchResultsV3')
  })

  // `discover.searchHandles` is the closed glyph's label, which both looks
  // still draw from `PeopleSearch.tsx` itself.
  for (const key of [...current.keys].filter((k) => k !== 'discover.searchHandles')) {
    it(`the twin says ${key}`, () => {
      expect(twin.keys.has(key)).toBe(true)
    })
  }

  for (const role of current.roles) {
    it(`the twin keeps the ${role} role`, () => {
      expect(twin.roles.has(role)).toBe(true)
    })
  }

  it('leaves the request and the navigation to the current file', () => {
    expect(twin.calls.has('useHandleSearch')).toBe(false)
    expect(twin.calls.has('openProfile')).toBe(false)
    expect(current.calls.has('useHandleSearch')).toBe(true)
    expect(current.calls.has('openProfile')).toBe(true)
  })
})

describe('CountryPicker in v3', () => {
  const current = uses(file('CountryPicker.tsx'))
  const twin = uses(file('CountryPickerV3.tsx'))

  it('switches on the flag', () => {
    const source = text(file('CountryPicker.tsx'))
    expect(source).toContain('useV3Home()')
    expect(source).toContain('<CountryPickerV3')
  })

  // `pickers.noCountryMatch` is worded in the current file and handed over,
  // so it has its interpolation in one place.
  for (const key of [...current.keys].filter((k) => k !== 'pickers.noCountryMatch')) {
    it(`the twin says ${key}`, () => {
      expect(twin.keys.has(key)).toBe(true)
    })
  }

  it('leaves the matching to the current file', () => {
    expect(twin.calls.has('searchCountries')).toBe(false)
    expect(current.calls.has('searchCountries')).toBe(true)
  })
})

describe('RangeSlider in v3', () => {
  const source = text(file('ui/RangeSlider.tsx'))

  // The current look keeps one control for the range; v3 makes each handle
  // its own, named and stepped (V-Filters' "Youngest age" / "Oldest age"),
  // because one control for two ends could not be adjusted at all.
  it('keeps the current look one adjustable control, and gives v3 one per handle', () => {
    expect(source.match(/accessibilityRole="adjustable"/g)).toHaveLength(2)
    expect(source.match(/accessibilityLabel=\{accessibilityLabel\}/g)).toHaveLength(1)
    expect(
      source.match(
        /accessibilityValue=\{\{ min, max, text: `\$\{values\[0\]\}–\$\{values\[1\]\}` \}\}/g,
      ),
    ).toHaveLength(1)
    expect(source).toContain('accessibilityLabel={thumbLabels?.[thumb] ?? accessibilityLabel}')
  })

  // A web load draws the current look first and flips once the config
  // settles. Without its own key the v3 track reuses an old DOM node that
  // react-native-web never starts measuring, and the thumbs are placed by
  // the old track's width — off the ends of the fill.
  it('mounts the v3 look fresh rather than reusing the current one', () => {
    expect(source).toMatch(/<View key="v3" style=\{styles\.root\}>/)
  })

  // react-native-web turns `start` into `left` whatever the page's `dir`, so
  // a track placed by `start` drew left to right under Arabic's mirrored
  // scale. The v3 look places its fill and thumbs by flex rows instead.
  it('places the v3 fill and thumbs by flex, not by an edge offset', () => {
    expect(source).not.toMatch(/\{ start: /)
    expect(source).toMatch(/flexGrow: highPct - lowPct/)
  })

  it('is handed its end labels by Filters', () => {
    const filters = text(path.join(APP, '(app)/filters.tsx'))
    expect(filters).toContain("t('filters.ageScaleOpen'")
    expect(uses(path.join(APP, '(app)/filters.tsx')).keys.has('filters.ageScaleOpen')).toBe(true)
  })
})
