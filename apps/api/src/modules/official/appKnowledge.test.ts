import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENDER_CHANGE_COOLDOWN_DAYS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { assistantSystemPrompt } from './assistant'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOBILE_EN = join(HERE, '../../../../mobile/src/i18n/messages/en.ts')

/**
 * The settings rows the assistant names out loud, as the app writes them.
 *
 * Typed by hand into the prompt, because the API does not import the app's
 * catalogue — that would ship four hundred screen strings in this image to use
 * eight of them. So this suite reads the file instead, which is the cheapest
 * thing that can tell us they still say what we claim.
 */
const ROWS = [
  'Share rough location',
  'Hide my city',
  'Hide when I’m online',
  'Show me in Discover',
  'Show my activity map',
  'Show this week’s chart',
  'Browse incognito',
  'Blocked people',
  'App language',
  'Delete account',
  'Edit profile',
]

const SECTIONS = ['Privacy', 'Notifications', 'Appearance', 'Account', 'Subscription', 'About']

describe('what the assistant says is in the app', () => {
  const prompt = assistantSystemPrompt('hi@langx.test')
  const catalogue = readFileSync(MOBILE_EN, 'utf8')

  /**
   * The drift this catches is the quiet kind: somebody renames a switch, the
   * app is right, every test passes, and @langx keeps telling people in eight
   * languages to look for a row that is not there any more.
   */
  it.each(ROWS)('still calls it “%s”, as the app does', (row) => {
    expect(prompt).toContain(row)
    expect(catalogue).toContain(`'${row}'`)
  })

  it.each(SECTIONS)('still has a %s section in Settings', (section) => {
    expect(prompt).toContain(section)
    expect(catalogue).toContain(`Section: '${section}'`)
  })

  it('takes the gender cooldown from config rather than repeating it', () => {
    expect(prompt).toContain(`once every ${String(GENDER_CHANGE_COOLDOWN_DAYS)} days`)
  })

  /**
   * The one question it must refuse even though it now knows a lot: a model
   * that has been told what exists will happily call any of it "new".
   */
  it('refuses to say what is new', () => {
    expect(prompt).toContain('no changelog')
    expect(prompt).toContain('Never describe a feature as new')
  })
})
