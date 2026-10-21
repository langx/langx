import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The call screen and the put-away strip are drawn twice while `flags.v3Home`
 * decides the look: the current `CallHost`/`CallBar`, and `CallScreenV3`/
 * `CallBarV3`. The promise is that only the drawing differs — every control
 * the current look has is in v3 too, says the same words to a screen reader
 * and does the same thing when pressed. A call is the one screen where a
 * missing Mute or Hang up cannot wait for a fix.
 *
 * Read as source text: what each `onPress` calls, and every catalogue key the
 * file names. v3 may say more (its tiles' short captions, the closing
 * screen's question), never less.
 */
const HERE = __dirname

function source(file: string): string {
  return readFileSync(path.join(HERE, file), 'utf8')
}

/** The functions each `onPress={…}` calls, with `() =>` and `void` peeled off. */
function pressed(text: string): Set<string> {
  const found = new Set<string>()
  for (const match of text.matchAll(/onPress=\{([^}]*)\}/g)) {
    const body = match[1]!.replace(/^\s*\(\)\s*=>\s*/, '').replace(/^void\s+/, '')
    const callee = /^[A-Za-z_$][\w$]*/.exec(body.trim())?.[0]
    if (callee) found.add(callee)
  }
  return found
}

function keys(text: string): Set<string> {
  return new Set([...text.matchAll(/'((?:calls|common|feedback)\.[\w.]+)'/g)].map((m) => m[1]!))
}

describe('the v3 call screen keeps every control of the current one', () => {
  const current = source('CallHost.tsx')
  const redesigned = source('CallScreenV3.tsx')

  it('calls every handler the current look calls', () => {
    const missing = [...pressed(current)].filter((name) => !pressed(redesigned).has(name))
    expect(missing).toEqual([])
  })

  it('answers with and without the camera, and puts the call away', () => {
    for (const call of ['answer(true)', 'answer(false)', 'setCallMinimized(true)']) {
      expect(redesigned, call).toContain(call)
    }
  })

  it('says everything the current look says', () => {
    const missing = [...keys(current)].filter((key) => !keys(redesigned).has(key))
    expect(missing).toEqual([])
  })

  it('draws the same switches under the same conditions', () => {
    for (const condition of [
      'video && call.cameraOn && CAN_FLIP',
      "Platform.OS !== 'web'",
      "call.phase === 'incoming'",
      "call.phase === 'outgoing'",
      'up && !call.remoteMicOn',
      "video && call.phase === 'active' && !call.remoteCameraOn",
      'mineInTile',
    ]) {
      expect(current, condition).toContain(condition)
      expect(redesigned, condition).toContain(condition)
    }
  })

  it('takes its behaviour from the one shared hook', () => {
    expect(current).toContain('useCallScreen(call)')
    expect(redesigned).toContain('useCallScreen(call)')
  })
})

describe('the v3 call bar keeps the current one', () => {
  it('brings the call back, under the same name', () => {
    const current = source('CallBar.tsx')
    const redesigned = source('CallBarV3.tsx')
    for (const text of [current, redesigned]) {
      expect(text).toContain('setCallMinimized(false)')
      expect(text).toContain("accessibilityLabel={t('calls.returnToCall')}")
    }
  })
})
