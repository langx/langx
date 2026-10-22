import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Button } from '../../components/ui/Button'
import { ICON_BUTTON_TARGET, IconButton } from '../../components/ui/IconButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'

/*
 * Literal colours, as in `chat-camera.tsx` and `SnapPreviewV3`: the camera is
 * black in both schemes, so nothing here follows the app's. The scrim is
 * `V-ViewOnce`'s, the off glyph tile `V-ChatCamera`'s unpicked option.
 */
const ON_STAGE = '#ffffff'
const ON_STAGE_MUTED = 'rgba(255, 255, 255, 0.82)'
const SCRIM = 'rgba(12, 13, 16, 0.62)'
const TILE = 'rgba(255, 255, 255, 0.14)'
const INK = '#14161b'
const RECORDING = '#ff3b30'

/*
 * The camera's states before the shutter, in the redesign's look, behind
 * `flags.v3Home`: the viewfinder, the permission screen and the web's
 * library-only screen. `V-ChatCamera` draws the step after the shutter
 * (`SnapPreviewV3`); these are drawn in its language — the kit's dark discs
 * for the corner controls, `V-ViewOnce`'s scrim pill for words over the
 * picture, the 56pt pills and the one yellow on the step's committing action.
 *
 * Only drawings. The camera itself, the hold-to-record timing, both
 * permission prompts, the remembered mode and the send stay
 * `chat-camera.tsx`'s, which hands every handler in.
 */

/** Close at the top start, and whatever the state puts at the top end. */
export function StageTopBar({
  onClose,
  children,
}: {
  onClose: (() => void) | undefined
  children?: ReactNode
}) {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.topBar} pointerEvents="box-none">
      {onClose ? (
        <IconButton
          icon="x"
          iconSize={22}
          look="hue"
          accessibilityLabel={t('viewOnce.close')}
          onPress={onClose}
          hitSlop={10}
        />
      ) : (
        <View />
      )}
      {children}
    </View>
  )
}

/** The live viewfinder's chrome, laid over the camera the route draws. */
export function SnapViewfinderV3({
  camera,
  recording,
  elapsed,
  flashOn,
  bottomInset,
  onClose,
  onFlash,
  onLibrary,
  onFlip,
  onPressIn,
  onPressOut,
}: {
  /** The route's `CameraView`, filling the frame. */
  camera: ReactNode
  recording: boolean
  /** Whole seconds since recording began. */
  elapsed: number
  flashOn: boolean
  bottomInset: number
  onClose: () => void
  onFlash: () => void
  onLibrary: () => void
  onFlip: () => void
  onPressIn: () => void
  onPressOut: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()

  return (
    <>
      {camera}

      {/* Close goes while recording: letting go of the shutter is the way out. */}
      <StageTopBar onClose={recording ? undefined : onClose}>
        {recording ? (
          <View style={styles.timer} accessibilityLabel={t('viewOnce.recording')}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : (
          // The kit's disc, drawn here because a toggle needs `selected`,
          // which `IconButton` does not carry. On, it turns white, as a
          // picked option does on the next step.
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.flash')}
            accessibilityState={{ selected: flashOn }}
            onPress={onFlash}
            hitSlop={10}
            scaleTo={0.88}
            style={[styles.disc, flashOn && styles.discOn]}
          >
            <Feather
              name={flashOn ? 'zap' : 'zap-off'}
              size={v3.icon.md}
              color={flashOn ? INK : ON_STAGE}
            />
          </PressableScale>
        )}
      </StageTopBar>

      <View style={[styles.foot, { paddingBottom: v3.space[24] + bottomInset }]}>
        {recording ? null : (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{t('viewOnce.hint')}</Text>
          </View>
        )}
        <View style={styles.shutterRow}>
          <IconButton
            icon="image"
            iconSize={v3.icon.lg}
            look="hue"
            accessibilityLabel={t('viewOnce.gallery')}
            onPress={onLibrary}
            disabled={recording}
            hitSlop={10}
            style={recording && styles.hidden}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.shutter')}
            accessibilityHint={t('viewOnce.hint')}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            scaleTo={0.92}
            style={[styles.shutter, recording && styles.shutterRecording]}
          >
            <View style={[styles.shutterCore, recording && styles.shutterCoreRecording]} />
          </PressableScale>
          <IconButton
            icon="refresh-cw"
            iconSize={v3.icon.md}
            look="hue"
            accessibilityLabel={t('viewOnce.flip')}
            onPress={onFlip}
            disabled={recording}
            hitSlop={10}
            style={recording && styles.hidden}
          />
        </View>
      </View>
    </>
  )
}

/**
 * A glyph, a heading and a line in the middle of the stage, and the step's
 * buttons at its foot: the permission screen and the web's library screen.
 */
function StageNote({
  icon,
  title,
  body,
  bottomInset,
  onClose,
  children,
}: {
  icon: keyof typeof Feather.glyphMap
  title?: string
  body: string
  bottomInset: number
  onClose: () => void
  children: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.note}>
      <StageTopBar onClose={onClose} />
      <View style={styles.noteMiddle}>
        <View style={styles.noteGlyph}>
          <Feather name={icon} size={40} color={ON_STAGE} />
        </View>
        {title ? (
          <Text accessibilityRole="header" style={styles.noteTitle}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.noteBody}>{body}</Text>
      </View>
      <View style={[styles.noteActions, { paddingBottom: v3.space[16] + bottomInset }]}>
        {children}
      </View>
    </View>
  )
}

/** No camera permission: allow it (or go to Settings), or take one from the library. */
export function CameraPermissionV3({
  canAskAgain,
  bottomInset,
  onAllow,
  onLibrary,
  onClose,
}: {
  /** False once the phone has stopped asking; the button then opens Settings. */
  canAskAgain: boolean
  bottomInset: number
  onAllow: () => void
  onLibrary: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <StageNote
      icon="camera"
      title={t('scan.permissionTitle')}
      body={t('viewOnce.cameraPermission')}
      bottomInset={bottomInset}
      onClose={onClose}
    >
      <Button label={canAskAgain ? t('scan.allow') : t('scan.openSettings')} onPress={onAllow} />
      {/*
        The outline in the stage's white, by hand, as `SnapPreviewV3`'s Retake
        is: the kit's outline takes the scheme's text colour, which is dark on
        a light phone and would vanish on the black stage.
      */}
      <PressableScale accessibilityRole="button" onPress={onLibrary} style={styles.outline}>
        <Feather name="image" size={v3.icon.lg} color={ON_STAGE} />
        <Text style={styles.outlineLabel}>{t('viewOnce.gallery')}</Text>
      </PressableScale>
    </StageNote>
  )
}

/** The web: no capture here, as there is none in the attach sheet — the library instead. */
export function LibraryOnlyV3({
  bottomInset,
  onLibrary,
  onClose,
}: {
  bottomInset: number
  onLibrary: () => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <StageNote
      icon="image"
      body={t('viewOnce.cameraUnavailable')}
      bottomInset={bottomInset}
      onClose={onClose}
    >
      <Button label={t('viewOnce.gallery')} icon="image" onPress={onLibrary} />
    </StageNote>
  )
}

const SHUTTER = 80
const SHUTTER_RECORDING = 92

const useStyles = makeStyles(({ v3 }) => ({
  topBar: {
    alignItems: 'center',
    end: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: v3.space[16],
    position: 'absolute',
    start: 0,
    top: 0,
  },
  disc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  discOn: { backgroundColor: ON_STAGE },
  timer: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[14],
  },
  timerDot: { backgroundColor: RECORDING, borderRadius: 5, height: 10, width: 10 },
  timerText: { ...v3.type.buttonSmall, color: ON_STAGE, fontVariant: ['tabular-nums'] },
  hidden: { opacity: 0 },
  foot: {
    alignItems: 'center',
    bottom: 0,
    end: 0,
    gap: v3.space[16],
    paddingHorizontal: v3.space[16],
    position: 'absolute',
    start: 0,
  },
  hint: {
    backgroundColor: SCRIM,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[6],
  },
  hintText: { ...v3.type.caption, color: ON_STAGE, textAlign: 'center' },
  shutterRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shutter: {
    alignItems: 'center',
    borderColor: ON_STAGE,
    borderRadius: v3.radius.pill,
    borderWidth: 5,
    height: SHUTTER,
    justifyContent: 'center',
    width: SHUTTER,
  },
  shutterRecording: { borderColor: RECORDING, height: SHUTTER_RECORDING, width: SHUTTER_RECORDING },
  shutterCore: { backgroundColor: ON_STAGE, borderRadius: v3.radius.pill, height: 62, width: 62 },
  shutterCoreRecording: { backgroundColor: RECORDING, borderRadius: 8, height: 30, width: 30 },
  note: { flex: 1 },
  noteMiddle: {
    alignItems: 'center',
    flex: 1,
    gap: v3.space[16],
    justifyContent: 'center',
    paddingHorizontal: v3.space[24],
  },
  noteGlyph: {
    alignItems: 'center',
    backgroundColor: TILE,
    borderRadius: v3.radius.block,
    height: 88,
    justifyContent: 'center',
    marginBottom: v3.space[4],
    width: 88,
  },
  noteTitle: { ...v3.type.headline, color: ON_STAGE, textAlign: 'center' },
  noteBody: { ...v3.type.body, color: ON_STAGE_MUTED, maxWidth: 320, textAlign: 'center' },
  noteActions: { gap: v3.space[8], paddingHorizontal: v3.space[16] },
  outline: {
    alignItems: 'center',
    borderColor: ON_STAGE,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: v3.space[20],
  },
  outlineLabel: { ...v3.type.button, color: ON_STAGE },
}))
