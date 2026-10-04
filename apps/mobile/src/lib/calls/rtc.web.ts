import type { CallIceCandidate, IceConfig } from '@langx/shared'
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
 * Enough for a face in a chat window, and a ceiling on what the relay carries:
 * every byte of a call goes through it, and it is billed by the byte.
 */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 24 },
  facingMode: 'user',
}
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}
const MAX_VIDEO_BITRATE = 1_000_000

function asStream(media: LocalMedia): MediaStream {
  return media.stream as MediaStream
}

function toWire(candidate: RTCIceCandidate): CallIceCandidate {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  }
}

async function openCamera(facingMode: 'user' | 'environment' = 'user'): Promise<MediaStreamTrack> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { ...VIDEO_CONSTRAINTS, facingMode },
    })
    const [track] = stream.getVideoTracks()
    if (!track) throw new MediaAccessError('camera')
    return track
  } catch {
    throw new MediaAccessError('camera')
  }
}

/**
 * The browser's own WebRTC.
 *
 * **Both people always negotiate one audio and one video line**, whatever kind
 * of call it is. A voice call is simply a video line with nothing on it. That
 * is what makes everything after the answer cheap: turning the camera on,
 * answering a video call without one, turning it off again — each is a track
 * swapped onto a line that already exists, with no second round of
 * negotiation and no moment in which the two sides disagree about what the
 * call contains. The only thing ever renegotiated is the path itself, when a
 * network changes, and the caller is always the one who offers, so two offers
 * can never cross.
 */
export const engine: CallEngine = {
  supported: () =>
    typeof RTCPeerConnection !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function',

  async acquire({ video }) {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS })
    } catch {
      throw new MediaAccessError('microphone')
    }
    let hasVideo = false
    if (video) {
      /*
       * Asked for separately, after the microphone, so that a refused camera
       * costs the camera and not the call: somebody who denies it can still
       * talk, and the caller of this decides what to say about that.
       */
      try {
        stream.addTrack(await openCamera())
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
      },
    }
  },

  open(config: IceConfig, local: LocalMedia, handlers: EngineHandlers): EngineSession {
    const stream = asStream(local)
    const { iceServers, iceTransportPolicy } = iceConfigFor(config, 'web')
    const connection = new RTCPeerConnection({
      // Rebuilt field by field: the wire shape allows an absent credential to
      // be spelled `undefined`, and the browser's own type does not.
      iceServers: iceServers.map((server) => ({
        urls: server.urls,
        ...(server.username === undefined ? {} : { username: server.username }),
        ...(server.credential === undefined ? {} : { credential: server.credential }),
      })),
      iceTransportPolicy,
    })

    /*
     * The other person's voice, played by an element that is on no screen.
     *
     * Not left to whichever view draws their picture: a voice call draws no
     * picture, and a call that is put away behind the small bar draws nothing
     * at all. The sound has to carry on through both.
     */
    const remote = new MediaStream()
    const speaker = new Audio()
    speaker.autoplay = true
    speaker.srcObject = remote

    let audioSender: RTCRtpSender | null = null
    let videoSender: RTCRtpSender | null = null
    let facing: 'user' | 'environment' = 'user'
    let hasRemoteDescription = false
    /** Candidates that arrived before the description they belong to. */
    let early: CallIceCandidate[] = []
    let closed = false

    connection.onicecandidate = (event) => {
      handlers.onCandidate(event.candidate ? toWire(event.candidate) : null)
    }
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === 'connected' || state === 'disconnected' || state === 'failed') {
        handlers.onConnection(state)
      }
    }
    connection.ontrack = (event) => {
      if (!remote.getTracks().includes(event.track)) remote.addTrack(event.track)
      handlers.onRemoteStream(remote)
      // A browser may refuse to start sound it was not asked for by a tap.
      // Both ways into a call are a tap, so this is belt and braces.
      void speaker.play().catch(() => undefined)
    }

    /** The caller's two lines, in a fixed order the other side can rely on. */
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

    /** The same two lines, as the callee finds them in the offer. */
    async function adoptLines(): Promise<void> {
      for (const transceiver of connection.getTransceivers()) {
        const kind = transceiver.receiver.track.kind
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
        // A browser that will not take the cap sends what it likes. The call
        // is worth more than the ceiling.
      }
    }

    async function drainEarly(): Promise<void> {
      hasRemoteDescription = true
      const waiting = early
      early = []
      for (const candidate of waiting) await addOne(candidate)
    }

    async function addOne(candidate: CallIceCandidate): Promise<void> {
      try {
        await connection.addIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          usernameFragment: candidate.usernameFragment ?? null,
        })
      } catch {
        // One bad candidate out of a dozen is not the call's problem.
      }
    }

    return {
      async createOffer(options) {
        if (!audioSender) addLines()
        if (options?.iceRestart) connection.restartIce()
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        return { type: 'offer', sdp: offer.sdp ?? '' }
      },

      async acceptOffer(offer: SessionDescription) {
        await connection.setRemoteDescription(offer)
        // Only the first offer brings the lines. A later one is the path being
        // rebuilt, and the tracks are already where they belong.
        if (!audioSender) await adoptLines()
        await drainEarly()
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        void capVideo()
        return { type: 'answer', sdp: answer.sdp ?? '' }
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
        const next = facing === 'user' ? 'environment' : 'user'
        try {
          const track = await openCamera(next)
          facing = next
          current.stop()
          stream.removeTrack(current)
          stream.addTrack(track)
          await videoSender?.replaceTrack(track)
        } catch {
          // No second camera: a desktop, mostly. The one in use stays.
        }
      },

      close() {
        closed = true
        connection.onicecandidate = null
        connection.onconnectionstatechange = null
        connection.ontrack = null
        connection.close()
        speaker.pause()
        speaker.srcObject = null
        local.release()
      },
    }
  },
}
