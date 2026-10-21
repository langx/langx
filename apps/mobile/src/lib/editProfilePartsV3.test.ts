import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * Edit profile's parts under `flags.v3Home`. The country row has a second
 * drawing in its own file, and the promise is the Settings pages' one
 * (`settingsScreensV3.test.ts`): only the drawing differs. Every message key,
 * request and call that does something in the current row — the permission
 * prompt, the reverse geocode, the write, the toast — must be in its twin.
 *
 * The photo tiles and the level bars keep one file and switch their styles,
 * as `CallMenu` does; what can drift there is the switch itself, so each is
 * held to reading the flag.
 */
const COMPONENTS = path.resolve(__dirname, '../components')

describe('v3 country row keeps the current one’s words and requests', () => {
  it('CountryFromLocationV3.tsx uses everything CountryFromLocation.tsx does', () => {
    const before = uses(path.join(COMPONENTS, 'CountryFromLocation.tsx'))
    const after = uses(path.join(COMPONENTS, 'CountryFromLocationV3.tsx'))
    expect(before.keys.size, 'no keys — is the reader broken?').toBeGreaterThan(0)
    for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
    for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
    for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
    // `button` is left out: the kit's Button names no role itself.
    for (const role of before.roles) {
      if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
    }
  })
})

describe('edit profile parts switch on the flag', () => {
  for (const file of [
    'CountryFromLocation.tsx',
    'DraggablePhotos.tsx',
    'PendingPhotoTile.tsx',
    'ui/LevelBars.tsx',
  ]) {
    it(`${file} reads useV3Home`, () => {
      expect(readFileSync(path.join(COMPONENTS, file), 'utf8')).toMatch(/useV3Home\(\)/)
    })
  }
})
