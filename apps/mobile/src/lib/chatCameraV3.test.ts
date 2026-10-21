import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The chat camera's states before the shutter — the viewfinder, the
 * permission screen, the web's library-only screen — have a second drawing
 * under `flags.v3Home`, in `SnapCameraV3.tsx`. The promise is that only the
 * drawing differs: the words and the screen-reader names are today's, and the
 * camera, its permission prompts and the hold-to-record timing stay in the
 * route, handed over as props. This holds both halves of that.
 */
const ROUTE = readFileSync(path.resolve(__dirname, '../../app/(app)/chat-camera.tsx'), 'utf8')
const V3 = readFileSync(path.resolve(__dirname, '../screens/chat/SnapCameraV3.tsx'), 'utf8')

/** Every key the current camera states say, minus the preview step's own (`SnapPreviewV3`). */
const KEYS = [
  'viewOnce.close',
  'viewOnce.flash',
  'viewOnce.recording',
  'viewOnce.hint',
  'viewOnce.gallery',
  'viewOnce.shutter',
  'viewOnce.flip',
  'scan.permissionTitle',
  'viewOnce.cameraPermission',
  'scan.allow',
  'scan.openSettings',
  'viewOnce.cameraUnavailable',
] as const

describe('the v3 chat camera keeps the current camera’s words', () => {
  for (const key of KEYS) {
    it(`says ${key}`, () => {
      expect(ROUTE, `the route no longer says ${key} — update this list`).toContain(`'${key}'`)
      expect(V3).toContain(`'${key}'`)
    })
  }

  it('keeps the flash a toggle a screen reader can hear', () => {
    expect(V3).toMatch(/accessibilityState=\{\{ selected: flashOn \}\}/)
  })

  it('keeps tap-for-photo and hold-for-video on the shutter', () => {
    expect(V3).toMatch(/onPressIn=\{onPressIn\}/)
    expect(V3).toMatch(/onPressOut=\{onPressOut\}/)
  })
})

describe('the v3 chat camera is only a drawing', () => {
  it('leaves the camera and its permissions to the route', () => {
    expect(V3).not.toMatch(/from 'expo-camera'/)
    expect(V3).not.toMatch(/Linking|requestPermission|snapOutbox|writeFlag/)
  })

  it('is reached only under the flag', () => {
    expect(ROUTE).toMatch(/!permission\.granted && v3Look/)
    expect(ROUTE).toMatch(/Platform\.OS === 'web' && v3Look/)
    expect(ROUTE).toMatch(/if \(v3Look\) \{\s*return \(\s*<SnapViewfinderV3/)
  })
})
