import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  type MediaStreamTrack,
  type RTCRtpSender,
} from '@livekit/react-native-webrtc'
import type { CallIceCandidate, IceConfig } from '@langx/shared'
import { NativeModules, Platform } from 'react-native'
import {
  MediaAccessError,
  type CallEngine,
  type EngineHandlers,
  type EngineSession,
  type LocalMedia,
  type SessionDescription,
} from './engine'
import { iceConfigFor } from './iceConfig'

/**
 * The media engine on a phone: LiveKit's build of react-native-webrtc.
 *
 * The same shape as the browser's (`rtc.web.ts`), on purpose and in detail —
 * both people always negotiate one audio and one video line, the caller always
 * offers, a camera is a track swapped onto a line that exists — because a call
 * is between a phone and a browser as often as between two phones, and the
 * two ends must agree about what a call contains without either knowing what
 * the other is.
 *
 * Why this binding rather than react-native-webrtc itself: both ship 16 KB
 * aligned Android libraries, and this one carries WebRTC M144 against M124 —
 * two and a half years of fixes in the code that parses packets from a
 * stranger's device. `docs/decisions.md` → _Calls_ has the comparison.
 */

/** Enough for a face on a phone, and a ceiling on what the relay carries. */
const VIDEO_CONSTRAINTS = {
  width: 640,
  height: 480,
  frameRate: 24,
}
const MAX_VIDEO_BITRATE = 1_000_000

type Facing = 'user' | 'environment'

function asStream(media: LocalMedia): MediaStream {
  return media.stream as MediaStream
}

async function openCamera(facingMode: Facing): Promise<MediaStreamTrack> {
  try {
    const stream = await mediaDevices.getUserMedia({
      video: { ...VIDEO_CONSTRAINTS, facingMode },
    })
    const [track] = stream.getVideoTracks()
    if (!track) throw new MediaAccessError('camera')
    return track
  } catch {
    throw new MediaAccessError('camera')
  }
}

export const engine: CallEngine = {
  /*
   * The native module, not the package: this file is in every bundle built
   * from this branch on, and an over-the-air update can reach a binary that
   * predates the module. Asking for it by name is what keeps that binary
   * answering "no" — and so never being rung — instead of crashing on the
   * first call.
   */
  supported: () => NativeModules.WebRTCModule != null,

  async acquire({ video }) {
    let stream: MediaStream
    try {
      stream = await mediaDevices.getUserMedia({ audio: true })
    } catch {
      throw new MediaAccessError('microphone')
    }
    let hasVideo = false
    if (video) {
      // Separately, after the microphone: a refused camera costs the camera,
      // not the call. See `rtc.web.ts`.
      try {
        stream.addTrack(await openCamera('user'))
        hasVideo = true
      } catch (error) {
        for (const track of stream.getTracks()) track.stop()
        throw error
      }
    }
    return {
      stream,
      hasVideo,
      release: () => {
        for (const track of stream.getTracks()) track.stop()
        stream.release()
      },
    }
  },

  open(config: IceConfig, local: LocalMedia, handlers: EngineHandlers): EngineSession {
    const stream = asStream(local)
    const { iceServers, iceTransportPolicy } = iceConfigFor(config, Platform.OS)
    const connection = new RTCPeerConnection({
      iceServers: iceServers.map((server) => ({
        urls: server.urls,
        ...(server.username === undefined ? {} : { username: server.username }),
        ...(server.credential === undefined ? {} : { credential: server.credential }),
      })),
      iceTransportPolicy,
    })

    /*
     * The other person's media, gathered into one stream for the view. Their
     * voice needs nothing: on a phone WebRTC plays received audio itself,
     * whether or not anything draws their picture.
     */
    const remote = new MediaStream()
    let audioSender: RTCRtpSender | null = null
    let videoSender: RTCRtpSender | null = null
    let facing: Facing = 'user'
    let hasRemoteDescription = false
    let early: CallIceCandidate[] = []
    let closed = false

    connection.addEventListener('icecandidate', (event) => {
      const candidate = event.candidate
      handlers.onCandidate(
        candidate
          ? {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid ?? null,
              sdpMLineIndex: candidate.sdpMLineIndex ?? null,
            }
          : null,
      )
    })
    connection.addEventListener('connectionstatechange', () => {
      const state = connection.connectionState
      if (state === 'connected' || state === 'disconnected' || state === 'failed') {
        handlers.onConnection(state)
      }
    })
    connection.addEventListener('track', (event) => {
      const track = event.track
      if (track && !remote.getTracks().some((existing) => existing.id === track.id)) {
        remote.addTrack(track)
      }
      handlers.onRemoteStream(remote)
    })

    function addLines(): void {
      const [audio] = stream.getAudioTracks()
      const [video] = stream.getVideoTracks()
      audioSender = connection.addTransceiver(audio ?? 'audio', {
        direction: 'sendrecv',
        streams: [stream],
      }).sender
      videoSender = connection.addTransceiver(video ?? 'video', {
        direction: 'sendrecv',
        streams: [stream],
      }).sender
    }

    async function adoptLines(): Promise<void> {
      for (const transceiver of connection.getTransceivers()) {
        const kind = transceiver.receiver.track?.kind
        transceiver.direction = 'sendrecv'
        if (kind === 'audio') {
          audioSender = transceiver.sender
          await transceiver.sender.replaceTrack(stream.getAudioTracks()[0] ?? null)
        } else if (kind === 'video') {
          videoSender = transceiver.sender
          await transceiver.sender.replaceTrack(stream.getVideoTracks()[0] ?? null)
        }
      }
    }

    async function capVideo(): Promise<void> {
      if (!videoSender) return
      try {
        const parameters = videoSender.getParameters()
        const [encoding] = parameters.encodings
        if (!encoding) return
        encoding.maxBitrate = MAX_VIDEO_BITRATE
        await videoSender.setParameters(parameters)
      } catch {
        // The call is worth more than the ceiling.
      }
    }

    async function addOne(candidate: CallIceCandidate): Promise<void> {
      try {
        await connection.addIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
        })
      } catch {
        // One bad candidate out of a dozen is not the call's problem.
      }
    }

    async function drainEarly(): Promise<void> {
      hasRemoteDescription = true
      const waiting = early
      early = []
      for (const candidate of waiting) await addOne(candidate)
    }

    return {
      async createOffer(options) {
        if (!audioSender) addLines()
        const offer = (await connection.createOffer(
          options?.iceRestart ? { iceRestart: true } : {},
        )) as { type: 'offer'; sdp: string }
        await connection.setLocalDescription(offer)
        return { type: 'offer', sdp: offer.sdp }
      },

      async acceptOffer(offer: SessionDescription) {
        await connection.setRemoteDescription(offer)
        if (!audioSender) await adoptLines()
        await drainEarly()
        const answer = (await connection.createAnswer()) as { type: 'answer'; sdp: string }
        await connection.setLocalDescription(answer)
        void capVideo()
        return { type: 'answer', sdp: answer.sdp }
      },

      async acceptAnswer(answer: SessionDescription) {
        await connection.setRemoteDescription(answer)
        await drainEarly()
        void capVideo()
      },

      async addCandidates(candidates) {
        for (const candidate of candidates) {
          if (hasRemoteDescription) await addOne(candidate)
          else early.push(candidate)
        }
      },

      setMicrophone(on) {
        for (const track of stream.getAudioTracks()) track.enabled = on
      },

      async setCamera(on) {
        const [current] = stream.getVideoTracks()
        if (!on) {
          if (current) {
            current.stop()
            stream.removeTrack(current)
          }
          await videoSender?.replaceTrack(null)
          return false
        }
        if (current) return true
        try {
          const track = await openCamera(facing)
          if (closed) {
            track.stop()
            return false
          }
          stream.addTrack(track)
          await videoSender?.replaceTrack(track)
          void capVideo()
          return true
        } catch {
          return false
        }
      },

      async flipCamera() {
        const [current] = stream.getVideoTracks()
        if (!current) return
        const next: Facing = facing === 'user' ? 'environment' : 'user'
        try {
          // The same track, pointed the other way: nothing to renegotiate.
          await current.applyConstraints({ facingMode: next })
          facing = next
        } catch {
          // One camera only. It stays.
        }
      },

      close() {
        closed = true
        connection.close()
        for (const track of remote.getTracks()) remote.removeTrack(track)
        local.release()
      },
    }
  },
}
