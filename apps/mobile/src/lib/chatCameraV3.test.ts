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

  it('ends the press only when the finger lifts, however far it slides', () => {
    // A `Pressable` ends the press when the finger leaves it, and a gesture-handler
    // pan was seen to on an iPhone: either stopped the clip as the finger rose.
    expect(V3).not.toMatch(/GestureDetector/)
    expect(V3).toMatch(/onResponderTerminationRequest=\{\(\) => false\}/)
    expect(V3).toMatch(/onResponderRelease=\{release\}/)
    expect(V3).toMatch(/onSlide\(event\.nativeEvent\.pageY - startY\.current, startY\.current\)/)
    expect(ROUTE).toMatch(/onSlide=\{zoom\.slide\}/)
    expect(ROUTE).toMatch(/holding\.current = false\s*zoom\.endSlide\(\)/)
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
      /=== 'denied'\) \{\s*void notification\('error'\)\s*void showAlert\(t\('photo\.saveFailed'\), t\('photo\.saveDenied'\)\)/,
    )
    expect(ROUTE).toContain("showToast(t('photo.saved'))")
  })
})

const ZOOM_HOOK = readFileSync(path.resolve(__dirname, '../screens/chat/useCameraZoom.ts'), 'utf8')
const EN = readFileSync(path.resolve(__dirname, '../i18n/messages/en.ts'), 'utf8')
const HOOK = readFileSync(path.resolve(__dirname, '../screens/chat/useCameraZoom.ts'), 'utf8')

/*
 * Story-camera gestures: pinch the picture to zoom, double-tap it to flip.
 * The zoom maths is tested in `cameraZoom.test.ts`; these hold the wiring a
 * redraw could quietly lose.
 */
describe('the chat camera zooms and flips from the picture', () => {
  it('wraps the camera in a gesture detector, in both looks', () => {
    // Built in the route, so the legacy look and v3 share it.
    expect(ROUTE).toMatch(/const cameraView = \(\s*<GestureDetector gesture=\{gestures\}>/)
    // The zoom's pinch and double-tap, raced against the filter swipe.
    expect(ROUTE).toContain('Gesture.Race(zoom.gesture, swipe)')
  })

  it('races the pinch against a double-tap, and flips only when not recording', () => {
    expect(ZOOM_HOOK).toContain('Gesture.Race(pinch, doubleTap)')
    expect(ZOOM_HOOK).toContain('Gesture.Pinch()')
    expect(ZOOM_HOOK).toContain('.numberOfTaps(2)')
    expect(ZOOM_HOOK).toContain('.enabled(flipEnabled)')
    expect(ROUTE).toMatch(/useCameraZoom\(\{\s*flipEnabled: !recording,/)
  })

  it('zooms on the UI thread, with no render per frame', () => {
    expect(ZOOM_HOOK).toMatch(/useAnimatedProps\(/)
    expect(ZOOM_HOOK).toMatch(/\.onChange\(\(event\) => \{\s*if \(moveTo\(pinchFactor/)
    expect(ZOOM_HOOK).toMatch(/moveTo\(next\)\) buzz\(\)/)
    // React hears only where a pinch came to rest.
    expect(ZOOM_HOOK).toMatch(/\.onEnd\(\(\) => \{[^}]*runOnJS\(setSettled\)/)
    expect(ROUTE).toContain('animatedProps={zoom.animatedProps}')
    expect(ROUTE).toContain('zoom={zoom.zoom}')
    expect(ROUTE).not.toMatch(/zoom=\{0\}/)
  })

  it('puts the zoom back to 1 on a flip, from the button or the double-tap', () => {
    expect(ROUTE).toMatch(/function flip\(\): void \{\s*zoom\.reset\(\)/)
    expect(ROUTE).toContain('onDoubleTap: () => flip()')
    expect(ROUTE).toContain('onFlip={flip}')
    expect(ROUTE).not.toMatch(/onFlip=\{\(\) => setFacing/)
  })

  it('applies the zoom again on every switch between photo and video, both ways', () => {
    expect(ROUTE).toMatch(
      /useEffect\(\(\) => \{\s*zoom\.resend\(\)[\s\S]{0,120}\}, \[cameraMode\]\)/,
    )
  })

  it('rests in video on iOS, so the first hold does not rebuild the session', () => {
    // A picture-to-video switch adds the movie output and the microphone to a
    // running iPhone session, which blanks the preview: the first-hold flicker.
    expect(ROUTE).toContain(
      "const RESTING_MODE: 'picture' | 'video' = Platform.OS === 'ios' ? 'video' : 'picture'",
    )
    expect(ROUTE).toContain("useState<'picture' | 'video'>(RESTING_MODE)")
    expect(ROUTE).toMatch(
      /if \(cameraMode === 'video'\) void record\(\)\s*else setCameraMode\('video'\)/,
    )
    expect(ROUTE).not.toContain("setCameraMode('picture')")
    // Never unmuted before the microphone is allowed, nor built before that is known.
    expect(ROUTE).toContain('mute={!microphone.granted}')
    expect(ROUTE).toContain('if (!permission || !microphone) {')
  })

  it('builds the gestures once, not on every tick of the recording clock', () => {
    expect(HOOK).toMatch(/const gesture = useMemo\(\(\) => \{/)
    expect(HOOK).toContain('}, [flipEnabled, armed, factor])')
  })

  it('makes Android back on the preview a Retake, not a lost shot', () => {
    expect(ROUTE).toMatch(
      /if \(!captured\) return\s*const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\s*retake\(\)\s*return true/,
    )
  })

  it('offers no Save for a pick from the library', () => {
    expect(ROUTE).toContain('onSave={fromLibrary ? undefined : () => void save()}')
    expect(PREVIEW).toMatch(/\{onSave \? \(\s*<IconButton\s*icon="download"/)
  })

  it('lets a screen reader zoom without pinching', () => {
    expect(ROUTE).toContain('accessibilityRole="adjustable"')
    expect(ROUTE).toContain("accessibilityLabel={t('viewOnce.viewfinder')}")
    expect(ROUTE).toContain("accessibilityHint={t('viewOnce.viewfinderHint')}")
    expect(ROUTE).toMatch(/t\('viewOnce\.zoomedIn'\) : t\('viewOnce\.notZoomed'\)/)
    expect(ROUTE).toMatch(/'increment'\) zoom\.step\(1\)/)
    expect(ROUTE).toMatch(/'decrement'\) zoom\.step\(-1\)/)
    for (const key of ['viewfinder', 'viewfinderHint', 'zoomedIn', 'notZoomed']) {
      expect(EN).toMatch(new RegExp(`\\n    ${key}: '`))
    }
  })

  it('lets a pinch start anywhere on the picture, beside the shutter included', () => {
    expect(V3).toMatch(/styles\.foot,[^\n]*\]\}\s*pointerEvents="box-none"/)
    expect(V3).toContain('<View style={styles.shutterRow} pointerEvents="box-none">')
  })
})

describe('the v3 preview discards from the corner too', () => {
  it('puts ✕ back at the top start, doing what Retake does', () => {
    expect(PREVIEW).toContain("<StageTopBar onClose={onRetake} closeLabel={t('viewOnce.retake')}>")
    expect(PREVIEW).toMatch(/onPress=\{onRetake\} style=\{styles\.retake\}/)
  })
})

/*
 * Filters: a tint on the live viewfinder, the exact matrix on the preview and
 * in the file that leaves. The matrices and the swipe are tested in
 * `cameraFilters.test.ts`; these hold the wiring.
 */
describe('the chat camera filters a photo', () => {
  it('sends and saves what `outgoing` returns, never the raw shot', () => {
    expect(ROUTE).toContain('const item = await outgoing()')
    expect(ROUTE).toContain('sendSnap({ conversationId, item, viewOnce: viewOnceForMode(mode) })')
    expect(ROUTE).not.toContain('item: captured,')
    expect(ROUTE).toContain('url: item.uri,')
  })

  it('bakes only a JPEG, only with a filter on, and never sends unfiltered on failure', () => {
    expect(ROUTE).toContain("captured?.kind === 'image' && captured.contentType === 'image/jpeg'")
    expect(ROUTE).toContain('if (!filterable || isOriginal(filter)) return captured')
    expect(ROUTE).toContain('bakeCameraFilter(from, matrix)')
    expect(ROUTE).toMatch(/showToast\(t\('viewOnce\.filterFailed'\)\)\s*return null/)
  })

  it('holds the shot and its mode still while a bake is under way', () => {
    expect(ROUTE).toMatch(/function retake\(\): void \{[^}]*if \(sending\) return/)
    expect(ROUTE).toMatch(/function pickMode\(next: SnapMode\): void \{[^}]*if \(sending\) return/)
    expect(ROUTE).toContain('enabled: filterable && !sending && !saving,')
  })

  it('is v3 and native only, and keeps the tint while recording only where a clip takes it', () => {
    expect(ROUTE).toContain("const filtersOn = v3Look && Platform.OS !== 'web'")
    expect(ROUTE).toMatch(
      /const tint =\s*onFilter && \(!recording \|\| canFilterVideo\(\)\) \? cameraFilter\(filter\)\.tint : null/,
    )
    expect(ROUTE).toContain('enabled: onFilter !== undefined && !recording,')
  })
})

describe('the chat camera filters a clip', () => {
  it('filters only a clip this camera recorded, in a build with the module', () => {
    expect(ROUTE).toMatch(
      /filtersOn && captured\?\.kind === 'video' && !fromLibrary && canFilterVideo\(\)/,
    )
  })

  it('bakes the clip natively at the camera bitrate and previews it with the same matrix', () => {
    expect(ROUTE).toContain('filterVideo(from, matrix, VIDEO_BITRATE)')
    expect(ROUTE).toContain(
      '<FilteredVideoV3 uri={captured.uri} matrix={cameraFilter(filter).matrix} />',
    )
  })
})

describe('the first hold to record keeps the picture still on iOS', () => {
  it('leaves stabilization off, so starting a recording does not rebuild the session', () => {
    expect(ROUTE).toContain('videoStabilizationMode="off"')
  })
})
