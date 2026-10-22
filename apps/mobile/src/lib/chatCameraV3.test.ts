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

const PREVIEW = readFileSync(path.resolve(__dirname, '../screens/chat/SnapPreviewV3.tsx'), 'utf8')

/*
 * The preview's panel folds to a chip so the whole photo can be seen, and a
 * Save in the top corner puts the shot in the phone's photos. Mobile vitest
 * cannot render a screen, so these hold the promises that are easy to lose in
 * a later redraw.
 */
describe('the v3 preview folds and saves', () => {
  it('names both ends of the fold for a screen reader', () => {
    expect(PREVIEW).toContain("accessibilityLabel={t('viewOnce.hideOptions')}")
    expect(PREVIEW).toContain("accessibilityHint={t('viewOnce.showOptions')}")
    expect(PREVIEW).toMatch(/accessibilityState=\{\{ expanded: false \}\}/)
  })

  it('folds on the UI thread, and not at all when motion is reduced', () => {
    expect(PREVIEW).toMatch(/from 'react-native-reanimated'/)
    expect(PREVIEW).toMatch(/unlessReduced\(reduce,/)
    expect(PREVIEW).toMatch(/SPRING\.sheet/)
  })

  it('keeps Retake and Send outside the part that folds', () => {
    const folding = PREVIEW.indexOf('styles.clip, optionsMotion')
    const actions = PREVIEW.indexOf('<View style={styles.actions}>')
    expect(folding).toBeGreaterThan(0)
    expect(actions).toBeGreaterThan(folding)
    expect(PREVIEW.slice(folding, actions)).not.toMatch(/viewOnce\.(retake|send)/)
  })

  it('names the Save button and leaves the saving to the route', () => {
    expect(PREVIEW).toContain("accessibilityLabel={t('photo.save')}")
    expect(PREVIEW).not.toMatch(/saveMediaToDevice|expo-media-library/)
    expect(ROUTE).toMatch(/saveMediaToDevice\(/)
  })

  it('tells the person when a save is refused, and confirms one that worked', () => {
    expect(ROUTE).toMatch(
      /=== 'denied'\) \{\s*void showAlert\(t\('photo\.saveFailed'\), t\('photo\.saveDenied'\)\)/,
    )
    expect(ROUTE).toContain("showToast(t('photo.saved'))")
  })
})
