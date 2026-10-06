import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef, useState, type ComponentProps } from 'react'
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCallClock, useCallState, useCallStreams } from '../../hooks/useCalls'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { callStatusKey } from '../../lib/calls/callLabels'
import type { CallState } from '../../lib/calls/machine'
import {
  answerCall,
  CallRefusal,
  declineCall,
  dismissCall,
  flipCamera,
  hangUp,
  setCallMinimized,
  toggleCamera,
  toggleMicrophone,
} from '../../lib/calls/session'
import { setSpeakerphone } from '../../../modules/calls'
import { makeStyles, useTheme } from '../../lib/theme'
import { Avatar } from '../ui/Avatar'
import { CallVideoView } from './CallVideoView'

type IconName = ComponentProps<typeof Feather>['name']

/**
 * Whether this device plausibly has a second camera to switch to. A phone
 * does; a laptop asked to "flip" hands back the one it has, after a flicker.
 * Read once — it cannot change for the life of the page, and `navigator` is
 * absent while the web bundle is being exported.
 */
const CAN_FLIP =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)

/**
 * The call, whenever there is one and it is not put away.
 *
 * At the root, beside the dialogs, because a call belongs to no screen: it
 * arrives while somebody is reading their settings, and it has to stay up
 * through every navigation underneath it. A `Modal` for `AlertHost`'s reason —
 * its own native window paints over the navigator without an `OVERLAY_LAYER`
 * — and because this one *should* take every touch: a ringing call is not
 * something to work around.
 *
 * Put away, it draws nothing and `CallBar` is the call instead.
 */
export function CallHost() {
  const call = useCallState()
  if (!call || call.minimized) return null

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // The back button, and Escape in a browser. Neither may end a call or
      // turn one down by accident: a call that is up is put away, a closing
      // line is closed, and a ringing one stays where it is.
      onRequestClose={() => {
        if (call.phase === 'ended') dismissCall()
        else if (call.phase === 'connecting' || call.phase === 'active') setCallMinimized(true)
      }}
    >
      <CallScreen call={call} />
    </Modal>
  )
}

function CallScreen({ call }: { call: CallState }) {
  const t = useT()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const streams = useCallStreams()
  const clock = useCallClock(call)
  /*
   * Their picture fills a tall window, cropped at the sides, the way every
   * phone draws a call; a wide one shows all of it with bars, because a laptop
   * camera's frame cropped to a desktop window loses the face.
   */
  const window = useWindowDimensions()
  const remoteFit = window.height > window.width ? 'cover' : 'contain'
  /** One answer at a time: the permission prompt can sit open for a while. */
  const [answering, setAnswering] = useState(false)
  /** Which way the camera faces. Only the front one is drawn as a mirror. */
  const [front, setFront] = useState(true)
  /**
   * Where the sound comes out, on a phone. A browser has no say — it plays
   * through whatever the computer is set to — so there is no button there.
   * Starts where every dialer starts it: the speaker for video, held in front
   * of the face; the earpiece for voice, held to the ear.
   */
  const [speaker, setSpeaker] = useState(call.media === 'video')

  const name = call.peer.displayName
  const statusKey = callStatusKey(call)
  const status = statusKey ? t(statusKey, { name }) : (clock ?? '')
  const up = call.phase === 'connecting' || call.phase === 'active'
  const video = call.media === 'video'

  /*
   * What fills the stage. Their picture once the call is up and their camera
   * is on; before that, on a video call the caller placed, the caller's own —
   * what they are about to be seen as. Otherwise a face and a name, which is
   * all a voice call ever is.
   */
  const theirs = video && call.phase === 'active' && call.remoteCameraOn && streams.remote !== null
  const mineOnStage =
    !theirs &&
    call.cameraOn &&
    streams.local !== null &&
    (call.phase === 'outgoing' || call.phase === 'connecting')
  const mineInTile = call.phase === 'active' && call.cameraOn && streams.local !== null
  const picture = theirs || mineOnStage

  async function answer(camera: boolean): Promise<void> {
    if (answering) return
    setAnswering(true)
    try {
      await answerCall({ camera })
    } catch (error) {
      // The call is still ringing: they can allow the device and try again,
      // or take a video call without the camera.
      if (error instanceof CallRefusal) {
        void showAlert(
          t(video ? 'calls.videoCall' : 'calls.voiceCall'),
          t(error.code === 'CAMERA_DENIED' ? 'calls.cameraNeeded' : 'calls.micNeeded'),
        )
      }
    } finally {
      setAnswering(false)
    }
  }

  async function camera(): Promise<void> {
    const wanted = !call.cameraOn
    const on = await toggleCamera()
    if (wanted && !on) void showAlert(t('calls.videoCall'), t('calls.cameraBlocked'))
  }

  return (
    <View style={styles.backdrop}>
      {theirs ? (
        <View style={styles.fill}>
          <CallVideoView stream={streams.remote} revision={streams.revision} fit={remoteFit} />
        </View>
      ) : mineOnStage ? (
        <View style={styles.fill}>
          <CallVideoView
            stream={streams.local}
            revision={streams.revision}
            fit="cover"
            mirrored={front}
          />
        </View>
      ) : null}

      <View
        style={[styles.chrome, { paddingBottom: insets.bottom + 28, paddingTop: insets.top + 12 }]}
      >
        <View style={styles.topBar}>
          {up ? (
            <Disc
              icon="chevron-down"
              label={t('calls.minimize')}
              size={40}
              onPress={() => setCallMinimized(true)}
            />
          ) : null}
        </View>

        {picture ? (
          // Over a picture the name is a caption, on a scrim so a bright room
          // behind it cannot wash it out.
          <View style={styles.caption}>
            <Text style={styles.captionName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.captionStatus} numberOfLines={1}>
              {status}
            </Text>
          </View>
        ) : (
          <View style={styles.identity}>
            <RingingAvatar call={call} />
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[styles.status, call.phase === 'ended' && styles.statusClosing]}
              accessibilityLiveRegion="polite"
            >
              {status}
            </Text>
          </View>
        )}

        <View style={styles.notes}>
          {up && !call.remoteMicOn ? (
            <Note icon="mic-off" text={t('calls.peerMuted', { name })} />
          ) : null}
          {video && call.phase === 'active' && !call.remoteCameraOn ? (
            <Note icon="video-off" text={t('calls.peerCameraOff')} />
          ) : null}
        </View>

        <View style={styles.spacer} />

        {mineInTile ? (
          <View style={styles.tile}>
            <CallVideoView
              stream={streams.local}
              revision={streams.revision}
              fit="cover"
              mirrored={front}
            />
          </View>
        ) : null}

        {call.phase === 'incoming' ? (
          <View style={styles.controls}>
            <View style={styles.row}>
              <Disc
                icon="phone-off"
                label={t('calls.decline')}
                tone="danger"
                size={64}
                caption
                onPress={declineCall}
              />
              <Disc
                icon={video ? 'video' : 'phone'}
                label={t('calls.answer')}
                tone="success"
                size={64}
                caption
                disabled={answering}
                onPress={() => void answer(true)}
              />
            </View>
            {video ? (
              <Pressable
                accessibilityRole="button"
                disabled={answering}
                hitSlop={8}
                onPress={() => void answer(false)}
              >
                <Text style={styles.link}>{t('calls.answerNoCamera')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : call.phase === 'outgoing' ? (
          <View style={styles.controls}>
            <Disc
              icon="phone-off"
              label={t('calls.cancel')}
              tone="danger"
              size={64}
              caption
              onPress={hangUp}
            />
          </View>
        ) : up ? (
          <View style={styles.controls}>
            <View style={styles.row}>
              <Disc
                icon={call.micOn ? 'mic' : 'mic-off'}
                label={t(call.micOn ? 'calls.mute' : 'calls.unmute')}
                lit={!call.micOn}
                onPress={toggleMicrophone}
              />
              {video ? (
                <Disc
                  icon={call.cameraOn ? 'video' : 'video-off'}
                  label={t(call.cameraOn ? 'calls.cameraOff' : 'calls.cameraOn')}
                  lit={!call.cameraOn}
                  onPress={() => void camera()}
                />
              ) : null}
              {video && call.cameraOn && CAN_FLIP ? (
                <Disc
                  icon="refresh-cw"
                  label={t('calls.flipCamera')}
                  onPress={() => {
                    setFront((current) => !current)
                    void flipCamera()
                  }}
                />
              ) : null}
              {Platform.OS !== 'web' ? (
                <Disc
                  icon="volume-2"
                  label={t('calls.speaker')}
                  lit={speaker}
                  onPress={() => {
                    setSpeakerphone(!speaker)
                    setSpeaker(!speaker)
                  }}
                />
              ) : null}
              <Disc
                icon="phone-off"
                label={t('calls.hangUp')}
                tone="danger"
                size={64}
                onPress={hangUp}
              />
            </View>
          </View>
        ) : (
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={dismissCall}>
              <Text style={styles.link}>{t('common.ok')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

/**
 * The other person's face, with a ring that breathes while the call is
 * waiting on somebody — and stands still once it is not. The motion says
 * "this is still happening" for the forty-five seconds a ring can last;
 * anybody who asked for less motion gets the face alone.
 */
function RingingAvatar({ call }: { call: CallState }) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const waiting = call.phase === 'incoming' || call.phase === 'outgoing'
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!waiting || reduceMotion) {
      pulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [waiting, reduceMotion, pulse])

  return (
    <View style={styles.avatarBox}>
      {waiting && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) },
              ],
            },
          ]}
        />
      ) : null}
      <Avatar
        url={call.peer.avatarUrl}
        name={call.peer.displayName}
        seed={call.peer._id}
        size={AVATAR_SIZE}
      />
    </View>
  )
}

function Note({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles()
  const { colors } = useTheme()
  return (
    <View style={styles.note}>
      <Feather name={icon} size={13} color={colors.onScrim} />
      <Text style={styles.noteText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

/**
 * One round control. `lit` is a switch that is off — a muted microphone, a
 * camera turned away — drawn inverted, because on a call the state that needs
 * noticing is the one in which the other person cannot hear or see you.
 */
function Disc({
  icon,
  label,
  onPress,
  tone = 'plain',
  lit = false,
  size = 56,
  caption = false,
  disabled = false,
}: {
  icon: IconName
  label: string
  onPress: () => void
  tone?: 'plain' | 'danger' | 'success'
  lit?: boolean
  size?: number
  /** Draws the label under the disc: the two choices of a ringing call. */
  caption?: boolean
  disabled?: boolean
}) {
  const styles = useStyles()
  const { colors } = useTheme()
  const face =
    tone === 'danger' ? styles.discDanger : tone === 'success' ? styles.discSuccess : null

  return (
    <View style={styles.discBox}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.disc,
          { borderRadius: size / 2, height: size, width: size },
          face,
          lit && styles.discLit,
          pressed && styles.discPressed,
        ]}
      >
        <Feather
          name={icon}
          size={Math.round(size * 0.4)}
          color={lit ? colors.scrimStrong : colors.onScrim}
        />
      </Pressable>
      {caption ? <Text style={styles.discCaption}>{label}</Text> : null}
    </View>
  )
}

const AVATAR_SIZE = 120

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // Dark in both schemes, like the photo viewer and for its reason: this is a
  // stage with somebody's picture on it, not a sheet of the app's own. And
  // opaque, unlike the viewer — see `stage` in the tokens.
  backdrop: { backgroundColor: colors.stage, flex: 1 },
  fill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  chrome: { alignItems: 'center', flex: 1, paddingHorizontal: spacing.xl },
  topBar: { alignSelf: 'stretch', flexDirection: 'row', minHeight: 40 },
  identity: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxxl, maxWidth: 420 },
  avatarBox: {
    alignItems: 'center',
    height: AVATAR_SIZE,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: AVATAR_SIZE,
  },
  ring: {
    borderColor: colors.onScrim,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    height: AVATAR_SIZE,
    position: 'absolute',
    width: AVATAR_SIZE,
  },
  name: { ...font.title, color: colors.onScrim, fontSize: 28, textAlign: 'center' },
  status: { ...font.body, color: colors.onScrim, fontSize: 16, opacity: 0.72, textAlign: 'center' },
  // The closing line is the one thing on the screen then, so it is read at
  // full strength rather than as the meta it was a moment ago.
  statusClosing: { lineHeight: 23, opacity: 1 },
  caption: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.lg,
    gap: 2,
    maxWidth: 420,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  captionName: { ...font.heading, color: colors.onScrim, fontSize: 18 },
  captionStatus: { ...font.label, color: colors.onScrim, fontVariant: ['tabular-nums'] },
  notes: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  note: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    maxWidth: 320,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  noteText: { ...font.label, color: colors.onScrim, flexShrink: 1 },
  spacer: { flex: 1 },
  // The viewer's own picture, small, above the controls and out of the way
  // of the face it is drawn over.
  tile: {
    alignSelf: 'flex-end',
    backgroundColor: colors.scrim,
    borderColor: colors.onInkMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 152,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    width: 108,
  },
  controls: { alignItems: 'center', gap: spacing.xl },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
  },
  link: { ...font.label, color: colors.onScrim, fontSize: 15, opacity: 0.85 },
  discBox: { alignItems: 'center', gap: spacing.sm },
  disc: { alignItems: 'center', backgroundColor: colors.onInkMuted, justifyContent: 'center' },
  discDanger: { backgroundColor: colors.danger },
  discSuccess: { backgroundColor: colors.success },
  discLit: { backgroundColor: colors.onScrim },
  discPressed: { opacity: 0.7 },
  discCaption: { ...font.label, color: colors.onScrim, opacity: 0.85 },
}))
