import { TOKEN_KINDS, type TokenHistoryDay } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { buildTokenHistory, kindKey } from './tokenHistory'

const t = createTranslate('en')
const NOW = new Date('2026-05-10T12:00:00')

const day = (overrides: Partial<TokenHistoryDay> = {}): TokenHistoryDay => ({
  day: '2026-05-10',
  earned: 0,
  spent: 0,
  breakdown: [],
  ...overrides,
})

const build = (days: TokenHistoryDay[]) => buildTokenHistory({ days, t, locale: 'en', now: NOW })

describe('buildTokenHistory', () => {
  it('names today and yesterday, and dates everything else', () => {
    const rows = build([
      day({ day: '2026-05-10' }),
      day({ day: '2026-05-09' }),
      day({ day: '2026-05-01' }),
    ])
    expect(rows.map((r) => r.label)).toEqual(['Today', 'Yesterday', 'May 1'])
  })

  it('keeps the server order rather than re-sorting', () => {
    const rows = build([day({ day: '2026-05-10' }), day({ day: '2026-05-08' })])
    expect(rows.map((r) => r.day)).toEqual(['2026-05-10', '2026-05-08'])
  })

  it('surfaces the pool share on its own, and leaves it in the breakdown', () => {
    const [row] = build([
      day({
        earned: 151,
        breakdown: [
          { kind: 'message', amount: 4 },
          { kind: 'dailyPool', amount: 137 },
          { kind: 'correction', amount: 10 },
        ],
      }),
    ])
    expect(row?.poolShare).toBe(137)
    expect(row?.entries.map((e) => e.kind)).toEqual(['message', 'dailyPool', 'correction'])
  })

  it('reports no pool share as null, not zero — the pool paid nothing, it did not pay 0', () => {
    const [row] = build([day({ earned: 4, breakdown: [{ kind: 'message', amount: 4 }] })])
    expect(row?.poolShare).toBeNull()
  })

  it('keeps a spend negative in the breakdown and positive in the total', () => {
    const [row] = build([
      day({
        earned: 4,
        spent: 200,
        breakdown: [
          { kind: 'message', amount: 4 },
          { kind: 'spend', amount: -200 },
        ],
      }),
    ])
    expect(row?.spent).toBe(200)
    expect(row?.entries.find((e) => e.kind === 'spend')?.amount).toBe(-200)
  })

  it('has a translated label for every kind the ledger can write', () => {
    for (const kind of TOKEN_KINDS) {
      const label = t(kindKey(kind))
      // A missing key resolves to the key itself, which would render as
      // "tokenKind.welcomeBack" in the list.
      expect(label).not.toContain('tokenKind.')
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
