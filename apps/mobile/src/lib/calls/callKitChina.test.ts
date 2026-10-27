import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * App Review rejected 2.9 twice under Guideline 5 — CallKit must not be
 * active on the China App Store — the second time after being told the app
 * already skipped it there. What the review note now claims is a property of
 * the Swift sources: on a phone where `callKitAllowed` is false, no CallKit
 * object is ever created and Siri's "call" is refused. Nothing runs Swift
 * here, so this holds the files to the shape that claim rests on, and fails
 * the moment an edit makes the note untrue. Read as text, for the reason
 * `appIcon.test.ts` gives.
 */
const MOBILE = path.join(__dirname, '../../..')
const CENTER_PATH = 'modules/calls/ios/CallCenter.swift'
const CENTER = readFileSync(path.join(MOBILE, CENTER_PATH), 'utf8')
const CALLING = readFileSync(path.join(MOBILE, 'targets/intents/CallingHandler.swift'), 'utf8')

function swiftFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return swiftFiles(full)
    return name.endsWith('.swift') ? [full] : []
  })
}

/** The body of the first function whose signature contains `signature`. */
function body(source: string, signature: string): string {
  const start = source.indexOf(signature)
  expect(start, signature).toBeGreaterThan(-1)
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1)
  }
  throw new Error(`unbalanced: ${signature}`)
}

describe('CallKit on the China storefront', () => {
  it('is imported by CallCenter.swift and nothing else', () => {
    const files = [
      ...swiftFiles(path.join(MOBILE, 'modules')),
      ...swiftFiles(path.join(MOBILE, 'targets')),
    ]
    const importers = files
      .filter((file) => /^import (CallKit|PushKit)$/m.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(MOBILE, file))
    expect(importers).toEqual([CENTER_PATH])
  })

  it('creates no CallKit object eagerly', () => {
    // A stored property initialised at declaration runs with `shared`, on
    // every phone. `lazy` waits for a use, and every use needs a `Call`.
    // Two spaces: the class's own members, not a local inside the lazy block.
    expect(CENTER).not.toMatch(
      /^ {2}(private )?(let|var) \w+(: \w+)? = CX(Provider|CallController)/m,
    )
    expect(CENTER).toMatch(/private lazy var controller = CXCallController\(\)/)
    expect(CENTER).toMatch(/private lazy var provider: CXProvider = \{/)
    expect(CENTER.match(/CXProvider\(configuration/g)).toHaveLength(1)
    expect(CENTER.match(/CXCallController\(\)/g)).toHaveLength(1)
  })

  it('decides once, and treats an unknown storefront as China', () => {
    expect(CENTER).toMatch(/^\s*let callKitAllowed: Bool$/m)
    const allows = body(CENTER, 'static func allows(')
    expect(allows).toContain('guard let storefront else { return false }')
    expect(allows).toContain('storefront != "CHN"')
    expect(allows).toContain('region != "CN"')
  })

  it('starts PushKit only behind the decision', () => {
    expect(CENTER.match(/PKPushRegistry\(/g)).toHaveLength(1)
    const start = body(CENTER, 'func startPushKit()')
    expect(start).toContain('PKPushRegistry(')
    expect(start.indexOf('guard callKitAllowed')).toBeGreaterThan(-1)
    expect(start.indexOf('guard callKitAllowed')).toBeLessThan(start.indexOf('PKPushRegistry('))
  })

  it('makes a Call only behind the decision', () => {
    // `provider` and `controller` are touched only with a `Call` in hand, and
    // this is the one place a `Call` is made.
    expect(CENTER.match(/call = Call\(/g)).toHaveLength(1)
    const report = body(CENTER, 'func reportIncoming(')
    expect(report.indexOf('guard callKitAllowed')).toBeGreaterThan(-1)
    expect(report.indexOf('guard callKitAllowed')).toBeLessThan(report.indexOf('provider.'))
  })

  it("refuses Siri's call unless the app said yes", () => {
    const key = CENTER.match(/allowedKey = "(\w+)"/)?.[1]
    expect(key).toBe('callKitAllowed')
    expect(CALLING).toContain(`allowedKey = "${key}"`)
    expect(CENTER).toContain('defaults?.set(callKitAllowed, forKey: Self.allowedKey)')
    expect(CALLING).toMatch(/bool\(forKey: Self\.allowedKey\) \?\? false/)
    for (const signature of ['func resolveContacts(', 'func handle(']) {
      expect(body(CALLING, signature), signature).toMatch(/guard callingAllowed/)
    }
  })

  it('tells the API so, which then never sends this phone a VoIP push', () => {
    const registration = body(CENTER, 'func registration()')
    expect(registration).toMatch(/if !callKitAllowed \{ return \["callKit": false/)
  })
})
