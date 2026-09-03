import { describe, expect, it } from 'vitest'
import { sessionLabel } from './sessionLabel'

describe('sessionLabel', () => {
  it('names the app on iOS from its networking stack', () => {
    expect(sessionLabel('LangX/1.0 CFNetwork/1494 Darwin/23.4.0')).toBe('LangX · iPhone')
  })

  it('names the app on Android from OkHttp', () => {
    expect(sessionLabel('okhttp/4.12.0')).toBe('LangX · Android')
  })

  it('reads Chrome on a Mac', () => {
    expect(
      sessionLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome · Mac')
  })

  it('does not call Chrome Safari, though Chrome says it is', () => {
    // Every Chrome agent ends in "Safari/537.36", so the order of these checks
    // is the whole correctness of this function.
    expect(sessionLabel('… Chrome/140.0 Safari/537.36')).toContain('Chrome')
  })

  it('reads Safari on an iPhone', () => {
    expect(
      sessionLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iOS')
  })

  it('reads Firefox on Windows', () => {
    expect(
      sessionLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/130.0'),
    ).toBe('Firefox · Windows')
  })

  it('gives back nothing it cannot name, so the screen can say so in words', () => {
    expect(sessionLabel('curl/8.5.0')).toBeNull()
    expect(sessionLabel(null)).toBeNull()
    expect(sessionLabel('')).toBeNull()
  })
})
