import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { uses } from './v3ScreenParity'

/**
 * The review's second drawing under `flags.v3Home`, held to today's. The
 * session's state stays in `app/(app)/echo/session.tsx` and is handed to
 * `EchoSessionScreenV3`, so what has to agree is what each drawing says and
 * offers: every word, every screen-reader role. The end of a session is
 * `EchoDoneV3`'s, so its words count on the v3 side too.
 *
 * The same promise for the About sheet and Play again, which have their v3
 * look beside the current one.
 */
const MOBILE = path.resolve(__dirname, '../..')
const at = (file: string) => path.join(MOBILE, file)

function union(files: readonly string[]) {
  const all = files.map((file) => uses(at(file)))
  return {
    keys: new Set(all.flatMap((found) => [...found.keys])),
    roles: new Set(all.flatMap((found) => [...found.roles])),
  }
}

const SESSION = 'app/(app)/echo/session.tsx'
const SESSION_V3 = 'src/screens/echo/EchoSessionScreenV3.tsx'

describe('Echo session under v3', () => {
  const current = uses(at(SESSION))
  const v3 = union([SESSION_V3, 'src/components/echo/EchoDoneV3.tsx'])

  /** Words today's done step says that `EchoDoneV3` says another way. */
  const DROPPED: Readonly<Record<string, string>> = {
    // V-EchoDone counts in one plural line ("10 cards · 8 remembered").
    'echo.doneReviewed': 'counted in echo.cardCount',
    'echo.doneRemembered': 'counted in echo.rememberedCount',
    'echo.doneAgain': 'the plural line has no Again count',
    'echo.doneBody': 'the streak and token rows say what it was worth',
  }

  it('says every word the current review says', () => {
    const missing = [...current.keys].filter((key) => !v3.keys.has(key) && !(key in DROPPED))
    expect(missing).toEqual([])
  })

  it('drops only words it still has reason to drop', () => {
    for (const key of Object.keys(DROPPED)) expect(current.keys.has(key)).toBe(true)
  })

  it('keeps every screen-reader role', () => {
    expect([...current.roles].filter((role) => !v3.roles.has(role))).toEqual([])
  })

  it('takes every piece of state from the route rather than keeping its own', () => {
    const source = readFileSync(at(SESSION_V3), 'utf8')
    // The calls that would make it a second session: requests, the device
    // store, analytics, the reveal and the grade.
    for (const call of [
      'useEchoQueue',
      'useSubmitEchoReviews',
      'rememberEchoCards',
      'rememberPendingReviews',
      'readEchoSnapshot',
      'track(',
      'newClientId',
      'setBoolFlag',
    ]) {
      expect(source).not.toContain(call)
    }
    const route = readFileSync(at(SESSION), 'utf8')
    expect(route).toContain('<EchoSessionScreenV3')
    expect(route).toContain('<EchoSessionLoadingV3')
    expect(route).toContain('<EchoSessionEmptyV3')
  })
})

describe('the About sheet under v3', () => {
  const current = uses(at('src/components/EchoAboutSheet.tsx'))
  const v3 = uses(at('src/components/echo/EchoAboutSheetV3.tsx'))
  /*
   * The ladder's steps and the three reasons are the current file's
   * constants, imported rather than copied, so the v3 file names none of
   * them itself. The backdrop's Cancel label became the ✕'s Close, as on
   * `WhatsProSheet`.
   */
  const SHARED = new Set([
    'echo.aboutStep10m',
    'echo.aboutStep1d',
    'echo.aboutStep3d',
    'echo.aboutStep8d',
    'echo.aboutStep20d',
    'echo.aboutRecall',
    'echo.aboutLittle',
    'echo.aboutYours',
    'common.cancel',
  ])

  it('says every word the current sheet says', () => {
    expect([...current.keys].filter((key) => !v3.keys.has(key) && !SHARED.has(key))).toEqual([])
  })

  it('reads the ladder and the reasons from the current sheet', () => {
    const source = readFileSync(at('src/components/echo/EchoAboutSheetV3.tsx'), 'utf8')
    expect(source).toMatch(/import \{[^}]*REASONS[^}]*STEPS[^}]*\} from '\.\.\/EchoAboutSheet'/)
  })

  it('is the sheet the v3 Echo tab opens', () => {
    const tab = readFileSync(at('src/screens/EchoV3Screen.tsx'), 'utf8')
    expect(tab).toContain('<EchoAboutSheetV3')
    expect(tab).not.toContain('<EchoAboutSheet ')
  })
})

describe('Play again under v3', () => {
  it('says what the current button says', () => {
    const source = readFileSync(at('src/components/echo/PlayAgain.tsx'), 'utf8')
    const v3 = source.slice(source.indexOf('export function PlayAgainButtonV3'))
    expect(v3).toContain("t('echo.playAgain')")
    expect(v3).toContain('accessibilityRole="button"')
  })
})
