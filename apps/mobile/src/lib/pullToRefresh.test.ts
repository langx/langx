import { describe, expect, it } from 'vitest'
import { isPulling, nextPull, NO_PULL, settlePull } from './pullToRefresh'

describe('pullToRefresh', () => {
  it('starts closed', () => {
    expect(isPulling(NO_PULL)).toBe(false)
  })

  it('opens on a pull and closes when that pull settles', () => {
    const pull = nextPull(NO_PULL)
    expect(isPulling(pull)).toBe(true)
    expect(settlePull(pull, pull)).toBe(NO_PULL)
  })

  it('does not let an older settle close a newer pull', () => {
    const first = nextPull(NO_PULL)
    const second = nextPull(first)
    expect(settlePull(second, first)).toBe(second)
    expect(isPulling(settlePull(second, first))).toBe(true)
    expect(settlePull(second, second)).toBe(NO_PULL)
  })

  it('ignores a settle when nothing is pulling', () => {
    expect(settlePull(NO_PULL, 3)).toBe(NO_PULL)
  })

  it('hands out a fresh number for every pull', () => {
    expect(nextPull(NO_PULL)).not.toBe(NO_PULL)
    expect(nextPull(nextPull(NO_PULL))).not.toBe(nextPull(NO_PULL))
  })
})
