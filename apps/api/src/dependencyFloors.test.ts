import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The root package.json pins these through pnpm.overrides, because none of
// them is a direct dependency: each arrives inside fastify, @fastify/rate-limit
// or socket.io, and nothing else would pull the patched release in. A lockfile
// regenerated without the overrides would quietly bring the advisories back,
// so this walks the same chain the server loads and reads what is there.

// pnpm's layout: a package's own dependencies sit beside it in the
// node_modules directory that contains it.
function dep(fromDir: string, name: string): string {
  const root = fromDir.slice(0, fromDir.lastIndexOf('node_modules') + 'node_modules'.length)
  return realpathSync(join(root, name))
}

function version(dir: string): number[] {
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    version: string
  }
  return version.split('.').map(Number)
}

function atLeast(actual: number[], floor: number[]): boolean {
  for (let i = 0; i < floor.length; i++) {
    const a = actual[i] ?? 0
    const f = floor[i] ?? 0
    if (a !== f) return a > f
  }
  return true
}

const api = realpathSync(join(dirname(new URL(import.meta.url).pathname), '..', 'node_modules'))
const own = (name: string) => realpathSync(join(api, name))

describe('runtime dependency floors', () => {
  it('fast-uri under fastify is past the authority-injection advisories', () => {
    const dir = dep(dep(own('fastify'), '@fastify/ajv-compiler'), 'fast-uri')
    expect(atLeast(version(dir), [4, 1, 5])).toBe(true)
  })

  it('ip-address under the rate limiter classifies link-local and NAT64 correctly', () => {
    const dir = dep(own('@fastify/rate-limit'), 'ip-address')
    expect(atLeast(version(dir), [10, 7, 1])).toBe(true)
  })

  it('engine.io under socket.io is past the protocol-mismatch DoS', () => {
    const dir = dep(own('socket.io'), 'engine.io')
    expect(atLeast(version(dir), [6, 6, 10])).toBe(true)
  })
})
