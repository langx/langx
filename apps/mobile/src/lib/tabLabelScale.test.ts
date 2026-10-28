import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { V3_LABEL_MAX_SCALE, v3TabBarHeight, v3TabLabelScale } from './tabLabelScale'
import { v3Type } from './theme/tokens'

const LINE = v3Type.label.lineHeight

describe('v3TabLabelScale', () => {
  it('never grows the words on iOS, which has the large-content viewer', () => {
    expect(v3TabLabelScale('ios', 1)).toBe(1)
    expect(v3TabLabelScale('ios', 3.1)).toBe(1)
    expect(v3TabLabelScale('ios', 0.8)).toBe(1)
  })

  it('follows the reader’s size elsewhere, up to the cap', () => {
    for (const os of ['android', 'web']) {
      expect(v3TabLabelScale(os, 1), os).toBe(1)
      expect(v3TabLabelScale(os, 1.15), os).toBe(1.15)
      expect(v3TabLabelScale(os, 2), os).toBe(V3_LABEL_MAX_SCALE)
      expect(v3TabLabelScale(os, 3.1), os).toBe(V3_LABEL_MAX_SCALE)
    }
  })

  it('shrinks them with a smaller text size', () => {
    expect(v3TabLabelScale('android', 0.85)).toBe(0.85)
  })
})

describe('v3TabBarHeight', () => {
  const at = (labelScale: number) =>
    v3TabBarHeight({ base: 62, lineHeight: LINE, labelScale, bottomInset: 34 })

  it('is the bar’s own height and the inset at the default size', () => {
    expect(at(1)).toBe(62 + 34)
  })

  it('grows by what the word’s line grows by, and no further than the cap', () => {
    expect(at(V3_LABEL_MAX_SCALE)).toBe(62 + 34 + LINE * (V3_LABEL_MAX_SCALE - 1))
    expect(at(v3TabLabelScale('android', 3.1))).toBe(at(V3_LABEL_MAX_SCALE))
  })

  it('never shrinks under the pill at a smaller text size', () => {
    expect(at(0.85)).toBe(at(1))
  })
})

describe('the tab bar draws its words at that scale', () => {
  const source = readFileSync(path.resolve(__dirname, '../../app/(app)/(tabs)/_layout.tsx'), 'utf8')

  it('turns the bar’s own scaling off, so the scale is the only one', () => {
    // Left on, the bar would grow the words again on top of the scale, past
    // the cap and out of the bar's height.
    expect(source).toContain('tabBarAllowFontScaling: false')
    expect(source).toContain('v3TabLabelScale(Platform.OS, fontScale)')
    expect(source).toMatch(/height: v3TabBarHeight\(\{[\s\S]*?labelScale,/)
  })

  it('never grows the badge, whose pill does not grow', () => {
    const badge = source.slice(source.indexOf('function V3TabBadge'))
    expect(badge.slice(0, badge.indexOf('</Animated.Text>'))).toContain('allowFontScaling={false}')
  })
})
