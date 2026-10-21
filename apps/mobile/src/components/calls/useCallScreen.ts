import type { FeedbackKind } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { useCallClock, useCallStreams } from '../../hooks/useCalls'
import { useT } from '../../i18n'
import type { TranslateFn } from '../../i18n/runtime'
import { askAlert, showAlert } from '../../lib/alert'
import { callStatusKey } from '../../lib/calls/callLabels'
import type { CallState } from '../../lib/calls/machine'
import {
  answerCall,
  CallRefusal,
  dismissCall,
  flipCamera,
  setCallMinimized,
  toggleCamera,
} from '../../lib/calls/session'
import { setSpeakerphone } from '../../../modules/calls'

/**
 * Whether this device plausibly has a second camera to switch to. A phone
 * does; a laptop asked to "flip" hands back the one it has, after a flicker.
 * Read once — it cannot change for the life of the page, and `navigator` is
 * absent while the web bundle is being exported.
 */
export const CAN_FLIP =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)

/**
 * Everything the call screen knows and does, apart from how it is drawn.
 *
 * One hook for both looks — the current `CallScreen` and v3's — so that what
 * a press does, what fills the stage and which line sits under the name are
 * decided once. Two copies of a call's behaviour would be two places for a
 * mute or an answer to drift, and only one of them would be in the build a
 * given person runs.
 */
export function useCallScreen(call: CallState) {
  const t = useT()
  const streams = useCallStreams()
  const clock = useCallClock(call)
  /*
   * Their picture fills a tall window, cropped at the sides, the way every
   * phone draws a call; a wide one shows all of it with bars, because a laptop
   * camera's frame cropped to a desktop window loses the face.
   */
  const window = useWindowDimensions()
  const remoteFit: 'cover' | 'contain' = window.height > window.width ? 'cover' : 'contain'
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

  function flip(): void {
    setFront((current) => !current)
    void flipCamera()
  }

  function toggleSpeaker(): void {
    setSpeakerphone(!speaker)
    setSpeaker(!speaker)
  }

  return {
    streams,
    clock,
    remoteFit,
    answering,
    front,
    speaker,
    name,
    status,
    up,
    video,
    theirs,
    mineOnStage,
    mineInTile,
    picture,
    answer,
    camera,
    flip,
    toggleSpeaker,
  }
}

/**
 * Off to the feedback screen, from a call.
 *
 * The feedback screen is under the call's `Modal`, so a call that is up is put
 * away first (the strip keeps it running) and a closing line is closed.
 */
export function goToCallFeedback(kind: FeedbackKind, ended: boolean): void {
  if (ended) dismissCall()
  else setCallMinimized(true)
  router.push(`/(app)/settings/feedback?kind=${kind}`)
}

/** The Beta · Feedback pill's press: which kind, then there. */
export async function askCallFeedback(t: TranslateFn, ended: boolean): Promise<void> {
  const kind = await askAlert<FeedbackKind | null>(t('calls.feedback'), t('calls.feedbackBody'), [
    { label: t('feedback.bugTitle'), value: 'bug', icon: 'alert-circle' },
    { label: t('feedback.featureTitle'), value: 'feature', icon: 'zap' },
    { label: t('common.cancel'), value: null, style: 'cancel' },
  ])
  if (!kind) return
  goToCallFeedback(kind, ended)
}
