import { PAYWALL_RULES, QUOTA_WINDOW_MS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  opensOn,
  parsePaywallLimit,
  parseRetryAt,
  paywallRoad,
  showsViewerCount,
} from './paywallRoad'

describe('paywallRoad', () => {
  it('sells nothing over a plan already held, whatever opened it', () => {
    expect(paywallRoad({ owned: true, refused: 'nearby', limit: 'initiations' })).toBe('owned')
  })

  it('reads the spent allowance before the feature', () => {
    expect(paywallRoad({ owned: false, refused: null, limit: 'initiations' })).toBe('chatLimit')
  })

  it('names the three personalised gates and folds the rest', () => {
    const road = (refused: Parameters<typeof paywallRoad>[0]['refused']) =>
      paywallRoad({ owned: false, refused, limit: null })
    expect(road('profileViewerIdentities')).toBe('viewers')
    expect(road('advancedFilters')).toBe('filters')
    expect(road('nearby')).toBe('nearby')
    expect(road('deckExport')).toBe('feature')
    expect(road(null)).toBe('general')
  })
})

describe('parsePaywallLimit', () => {
  it('accepts only the allowance it knows', () => {
    expect(parsePaywallLimit('initiations')).toBe('initiations')
    expect(parsePaywallLimit('translations')).toBeNull()
    expect(parsePaywallLimit(undefined)).toBeNull()
  })
})

describe('parseRetryAt', () => {
  const now = new Date('2026-10-18T10:00:00Z')

  it('takes a time inside the rolling window', () => {
    const at = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    expect(parseRetryAt(at.toISOString(), now)?.getTime()).toBe(at.getTime())
  })

  it('refuses the past, the far future and nonsense', () => {
    expect(parseRetryAt(new Date(now.getTime() - 1000).toISOString(), now)).toBeNull()
    expect(parseRetryAt(now.toISOString(), now)).toBeNull()
    expect(
      parseRetryAt(new Date(now.getTime() + QUOTA_WINDOW_MS + 60_000).toISOString(), now),
    ).toBeNull()
    expect(parseRetryAt('soon', now)).toBeNull()
    expect(parseRetryAt(undefined, now)).toBeNull()
    expect(parseRetryAt(null, now)).toBeNull()
  })
})

describe('opensOn', () => {
  // Built from local parts, so the test means the same in every time zone.
  const now = new Date(2026, 9, 18, 21, 30)

  it('says today for later the same day', () => {
    expect(opensOn(new Date(2026, 9, 18, 23, 59), now)).toBe('today')
  })

  it('says tomorrow after local midnight', () => {
    expect(opensOn(new Date(2026, 9, 19, 0, 5), now)).toBe('tomorrow')
    expect(opensOn(new Date(2026, 9, 19, 21, 0), now)).toBe('tomorrow')
  })

  it('crosses a month end', () => {
    expect(opensOn(new Date(2026, 10, 1, 8, 0), new Date(2026, 9, 31, 22, 0))).toBe('tomorrow')
  })

  it('has no word for further out', () => {
    expect(opensOn(new Date(2026, 9, 20, 9, 0), now)).toBeNull()
  })
})

describe('showsViewerCount', () => {
  it('holds back a count under the threshold', () => {
    expect(showsViewerCount(PAYWALL_RULES.viewerCountMin - 1)).toBe(false)
    expect(showsViewerCount(0)).toBe(false)
  })

  it('says a count at or over it', () => {
    expect(showsViewerCount(PAYWALL_RULES.viewerCountMin)).toBe(true)
    expect(showsViewerCount(40)).toBe(true)
  })

  it('says nothing when an older API sent no count', () => {
    expect(showsViewerCount(undefined)).toBe(false)
  })
})
