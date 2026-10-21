import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { TranslateFn } from '../i18n/runtime'
import { spokenGrade } from './format'

/**
 * The fixes the nine v3 batch reviews left open. Most are a prop or a style in
 * a file vitest cannot render (react-native does not load here), so beside the
 * one function there is to call, these read the sources for the piece each fix
 * hangs on — enough that undoing one by accident fails a test.
 */
const SRC = path.resolve(__dirname, '..')
const read = (file: string) => readFileSync(path.join(SRC, file), 'utf8')

const t: TranslateFn = (key, params) => `${key} ${JSON.stringify(params)}`

describe('a grade read aloud', () => {
  it('says the interval in compactDuration’s steps, in full', () => {
    expect(spokenGrade(t, 'Good', 0)).toBe('echo.gradeInMinutes {"count":1,"grade":"Good"}')
    expect(spokenGrade(t, 'Again', 10)).toBe('echo.gradeInMinutes {"count":10,"grade":"Again"}')
    expect(spokenGrade(t, 'Hard', 90)).toBe('echo.gradeInHours {"count":2,"grade":"Hard"}')
    expect(spokenGrade(t, 'Good', 8 * 24 * 60)).toBe('echo.gradeInDays {"count":8,"grade":"Good"}')
  })

  it('is what each v3 grade tile tells a screen reader', () => {
    const session = read('screens/echo/EchoSessionScreenV3.tsx')
    expect(session).toContain('accessibilityLabel={spokenGrade(t, t(`echo.${value}`), minutes)}')
  })
})

describe('labels that must shrink rather than truncate, on the web too', () => {
  it('the v3 session draws its grade words and autoplay label with FitText', () => {
    const session = read('screens/echo/EchoSessionScreenV3.tsx')
    expect(session).not.toContain('adjustsFontSizeToFit')
    expect(session.match(/<FitText /g)).toHaveLength(2)
  })

  it('FitText measures on the web, where adjustsFontSizeToFit does nothing', () => {
    const fit = read('components/ui/FitText.tsx')
    expect(fit).toContain("Platform.OS === 'web'")
    expect(fit).toContain('onLayout')
  })
})

describe('the v3 age slider', () => {
  it('makes each handle its own adjustable control with steps', () => {
    const slider = read('components/ui/RangeSlider.tsx')
    const v3Half = slider.slice(
      slider.indexOf('if (v3Look)'),
      slider.indexOf('const styles = legacyStyles'),
    )
    expect(v3Half).toContain(
      "accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}",
    )
    expect(v3Half).toContain('thumbLabels?.[thumb]')
    expect(read('../app/(app)/filters.tsx')).toContain(
      "thumbLabels={[t('filters.ageYoungest'), t('filters.ageOldest')]}",
    )
  })
})

describe('the shell and thread fixes', () => {
  it('rounds every tour hole on People to the shape it points at', () => {
    const people = read('components/people/PeopleV3.tsx')
    const targets = people.match(/<TourTarget [^>]*>/g) ?? []
    expect(targets).toHaveLength(3)
    for (const target of targets) expect(target).toContain('radius={')
  })

  it('lets a touch end the Pro welcome’s confetti, as CelebrationSheet does', () => {
    expect(read('components/ProWelcomeSheetV3.tsx')).toContain(
      'onStartShouldSetResponderCapture={skip}',
    )
  })

  it('lifts the partner’s bubble in their hue', () => {
    expect(read('screens/ChatScreen.tsx')).toContain('{ tint: partnerHue }')
    expect(read('components/MessageMenuHost.tsx')).toContain('request.tint')
  })

  it('never drops the web focus ring from a search field without an edge of its own', () => {
    for (const file of ['components/ChatSearch.tsx', 'components/ConversationPicker.tsx']) {
      const source = read(file)
      expect(source, file).toContain('outlineWidth: 0')
      expect(source, file).toContain('v3Look && focused && { borderColor: v3.colors.fg }')
      expect(source, file).toContain('onFocus={() => setFocused(true)}')
    }
  })
})
