import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ar } from '../i18n/messages/ar'
import { de } from '../i18n/messages/de'
import { en } from '../i18n/messages/en'
import { es } from '../i18n/messages/es'
import { fr } from '../i18n/messages/fr'
import { ptBR } from '../i18n/messages/pt-BR'
import { ru } from '../i18n/messages/ru'
import { tr } from '../i18n/messages/tr'
import {
  APP_ICONS,
  iconAfterPlan,
  isProIcon,
  NATIVE_ICONS,
  pickerIcons,
  PRO_ICONS,
  RETIRED_ICONS,
} from './appIconList'

/*
 * The icon list lives in three places nothing joins at runtime: `APP_ICONS`
 * here, the plugin entries in `app.config.ts` (the only thing the OS knows),
 * and the previews and labels the picker draws. A name in the first and
 * missing from the second fails on the device with "icon not found"; a name
 * without a preview or a label draws an empty tile. Read as text, because
 * `app.config.ts` and `SettingsRow.tsx` cannot be imported under vitest.
 */
const MOBILE = path.join(__dirname, '../..')
const CONFIG = readFileSync(path.join(MOBILE, 'app.config.ts'), 'utf8')
const ROW = readFileSync(path.join(MOBILE, 'src/components/settings/SettingsRow.tsx'), 'utf8')

describe('the app-icon list', () => {
  it('has eight free icons and nine Pro ones, Contrast free', () => {
    expect(APP_ICONS.filter((icon) => !isProIcon(icon))).toHaveLength(8)
    expect(APP_ICONS.filter(isProIcon)).toHaveLength(9)
    expect(isProIcon('contrast')).toBe(false)
    expect(isProIcon('default')).toBe(false)
    for (const icon of PRO_ICONS) expect(APP_ICONS).toContain(icon)
  })

  it('draws free first, then Pro', () => {
    const firstPro = APP_ICONS.findIndex(isProIcon)
    expect(APP_ICONS.slice(firstPro).every(isProIcon)).toBe(true)
  })

  it('keeps every name lower-camel, so the plugin round-trips it', () => {
    for (const icon of NATIVE_ICONS) expect(icon).toMatch(/^[a-z]+(?:[A-Z][a-z]+)*$/)
  })

  it.each(NATIVE_ICONS.filter((icon) => icon !== 'default'))(
    '%s has a plugin entry whose files exist',
    (icon) => {
      const layered = new RegExp(`layeredIcon\\('${icon}', '([a-z-]+)'`).exec(CONFIG)
      const plain = new RegExp(`name: '${icon}',\\s*ios: '([^']+)'`).exec(CONFIG)
      expect(layered ?? plain, icon).not.toBeNull()
      const files = layered
        ? [
            `assets/icons/${layered[1]}.png`,
            `assets/icons/android/${layered[1]}-foreground.png`,
            `assets/icons/android/${layered[1]}-background.png`,
          ]
        : [plain![1]!]
      for (const file of files) expect(existsSync(path.join(MOBILE, file)), file).toBe(true)
    },
  )

  it('declares no plugin entry the list does not know', () => {
    const declared = [
      ...[...CONFIG.matchAll(/layeredIcon\('(\w+)'/g)].map((match) => match[1]),
      ...[...CONFIG.matchAll(/name: '(\w+)',\s*ios:/g)].map((match) => match[1]),
    ]
    expect(new Set(declared)).toEqual(new Set(NATIVE_ICONS.filter((icon) => icon !== 'default')))
  })

  it.each(NATIVE_ICONS)('%s has a preview', (icon) => {
    const imported = new RegExp(
      `import ${icon}Icon from '../../../(assets/icons/previews/[a-z-]+\\.png)'`,
    )
    const match = imported.exec(ROW)
    expect(match, icon).not.toBeNull()
    expect(existsSync(path.join(MOBILE, match![1]!))).toBe(true)
    expect(ROW).toContain(`  ${icon}: ${icon}Icon,`)
  })

  it.each(NATIVE_ICONS)('%s has a label in all eight languages', (icon) => {
    for (const messages of [en, tr, de, es, fr, ptBR, ru, ar]) {
      const label = (messages.settings as Record<string, unknown>)[`appIcon_${icon}`]
      expect(typeof label === 'string' && label.length > 0).toBe(true)
    }
  })
})

describe('a retired icon', () => {
  it('is shown first, as current, only while it is on the home screen', () => {
    for (const icon of RETIRED_ICONS) {
      expect(APP_ICONS).not.toContain(icon)
      expect(pickerIcons(icon)).toEqual([icon, ...APP_ICONS])
    }
    expect(pickerIcons('mosaic')).toEqual(APP_ICONS)
  })
})

describe('a Pro icon when Pro ends', () => {
  it('stays, as decided', () => {
    expect(iconAfterPlan('mosaic', { loaded: true, paid: false })).toBeNull()
  })

  it('goes back to the default only when the constant is flipped, and only for a Pro icon', () => {
    expect(iconAfterPlan('mosaic', { loaded: true, paid: false }, false)).toBe('default')
    expect(iconAfterPlan('contrast', { loaded: true, paid: false }, false)).toBeNull()
    expect(iconAfterPlan('mosaic', { loaded: true, paid: true }, false)).toBeNull()
    // Every account reads as free until its profile has loaded.
    expect(iconAfterPlan('mosaic', { loaded: false, paid: false }, false)).toBeNull()
  })
})
