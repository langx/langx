import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * The shell's hosts — the tour, the message banner, the Pro welcome, the
 * offline and deletion strips and the sign-in overlay — each draw a second
 * look under `flags.v3Home`, and with the flag off they must draw exactly
 * today's. Five of them swap their styles inside the component, the way
 * `ScreenHeader` does; the Pro welcome has a twin sheet, held to the words
 * and the calls of the card it replaces.
 */
const COMPONENTS = path.resolve(__dirname, '../components')
const read = (file: string): string => readFileSync(path.join(COMPONENTS, file), 'utf8')

const INLINE = [
  'TourHost.tsx',
  'MessageBannerHost.tsx',
  'OfflineBanner.tsx',
  'DeletionBanner.tsx',
  'SignInProgressHost.tsx',
] as const

/** The `makeStyles` block that starts at `marker`, up to the end of the file's next top-level `}))`. */
function block(source: string, marker: string): string {
  const start = source.indexOf(marker)
  expect(start, `no ${marker}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf('\n}))', start)
  return source.slice(start, end)
}

describe('shell hosts: the v3 look is gated and drawn from theme.v3', () => {
  for (const file of INLINE) {
    it(`${file} keeps today's styles and switches on useV3Home`, () => {
      const source = read(file)
      expect(source).toContain('const v3Look = useV3Home()')
      expect(source).toContain('const styles = v3Look ? v3Styles : currentStyles')
      // Today's block is still there, untouched by the switch.
      expect(source).toContain('const useStyles = makeStyles(')
    })

    it(`${file}: the v3 styles read only theme.v3`, () => {
      const v3 = block(read(file), 'const useStylesV3 = makeStyles(({ v3 }) =>')
      // No current-look token leaks into the v3 drawing.
      expect(v3).not.toMatch(/(?<!v3\.)\b(colors|font|spacing|radius)\./)
    })
  }

  it('the message banner keeps its overlay layer in both looks', () => {
    // Without it the banner paints behind the navigator's screens on native
    // (`overlayLayers.ts`), so the v3 layer must carry it too.
    const v3 = block(read('MessageBannerHost.tsx'), 'const useStylesV3')
    expect(v3).toContain('zIndex: OVERLAY_LAYER.messageBanner')
    expect(v3).toContain('elevation: OVERLAY_LAYER.messageBanner')
  })
})

describe('the v3 Pro welcome says what the current one does', () => {
  it('uses every word of the current card, and the same calls', () => {
    const current = uses(path.join(COMPONENTS, 'ProWelcomeHost.tsx'))
    const twin = uses(path.join(COMPONENTS, 'ProWelcomeSheetV3.tsx'))
    expect(current.keys.size).toBeGreaterThan(0)
    for (const key of current.keys) expect(twin.keys, `key ${key}`).toContain(key)
    for (const call of ['notification', 'proWelcomeCopy', 'PRO_WELCOME_HIGHLIGHTS.map']) {
      expect(twin.calls, `call ${call}`).toContain(call)
    }
  })

  it('is opened with the same two ways out as the current card', () => {
    const host = read('ProWelcomeHost.tsx')
    const tag = /<ProWelcomeSheetV3\b[\s\S]*?\/>/.exec(host)?.[0]
    expect(tag).toBeDefined()
    expect(tag).toContain('onStart={() => close(true)}')
    expect(tag).toContain('onClose={() => close(false)}')
  })
})
