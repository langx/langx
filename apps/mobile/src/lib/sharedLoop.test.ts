import { describe, expect, it } from 'vitest'
import { sharedLoop } from './sharedLoop'

function counted() {
  const log: string[] = []
  const loop = sharedLoop(() => {
    log.push('make')
    return { start: () => log.push('start'), stop: () => log.push('stop') }
  })
  return { log, loop }
}

describe('sharedLoop', () => {
  it('starts on the first user and stops after the last', () => {
    const { log, loop } = counted()
    const a = loop.acquire()
    const b = loop.acquire()
    const c = loop.acquire()
    expect(log).toEqual(['make', 'start'])
    expect(loop.users()).toBe(3)

    b()
    a()
    expect(log).toEqual(['make', 'start'])
    c()
    expect(log).toEqual(['make', 'start', 'stop'])
    expect(loop.users()).toBe(0)
  })

  it('makes a fresh loop when it starts again from nothing', () => {
    const { log, loop } = counted()
    loop.acquire()()
    loop.acquire()
    expect(log).toEqual(['make', 'start', 'stop', 'make', 'start'])
  })

  it('ignores a second release from the same user', () => {
    const { log, loop } = counted()
    const a = loop.acquire()
    const b = loop.acquire()
    a()
    a()
    expect(loop.users()).toBe(1)
    expect(log).not.toContain('stop')
    b()
    expect(log).toEqual(['make', 'start', 'stop'])
  })
})
