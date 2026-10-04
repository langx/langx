import type { CallIceCandidate, IceConfig } from '@langx/shared'

/**
 * The part of a call that carries sound and picture, as the rest of the app
 * sees it.
 *
 * An interface because there are two of them and they share no code: a browser
 * has `RTCPeerConnection` built in, and a phone needs a native module that is
 * not in every build. `rtc.web.ts` is the first; `rtc.ts` is the second, and
 * until that module ships it is a stub that says it cannot. Metro picks by
 * platform, so neither is ever bundled where it does not belong.
 *
 * Nothing here knows about the socket, the server or the screen. A session is
 * handed a relay configuration and told what the other side said; it says
 * what to tell the other side, and whether the media path is up.
 */
export interface SessionDescription {
  type: 'offer' | 'answer'
  sdp: string
}

/** How the media path is doing, reduced to what the call needs to act on. */
export type EngineConnection = 'connected' | 'disconnected' | 'failed'

export interface EngineHandlers {
  /** A candidate this device found, or `null` once it has found them all. */
  onCandidate: (candidate: CallIceCandidate | null) => void
  onConnection: (state: EngineConnection) => void
  /** The other side's media arrived, or changed. Opaque: only the view reads it. */
  onRemoteStream: (stream: unknown) => void
}

/** The microphone, and the camera when asked for, held before anything rings. */
export interface LocalMedia {
  /** Opaque to everything but the engine and the view that draws it. */
  stream: unknown
  hasVideo: boolean
  release: () => void
}

export interface EngineSession {
  /** The caller's opening move, and its move again when the path needs rebuilding. */
  createOffer: (options?: { iceRestart?: boolean }) => Promise<SessionDescription>
  /** Takes the caller's offer and returns the answer to send back. */
  acceptOffer: (offer: SessionDescription) => Promise<SessionDescription>
  acceptAnswer: (answer: SessionDescription) => Promise<void>
  addCandidates: (candidates: readonly CallIceCandidate[]) => Promise<void>
  setMicrophone: (on: boolean) => void
  /** Resolves to whether the camera is on afterwards — a refused permission leaves it off. */
  setCamera: (on: boolean) => Promise<boolean>
  flipCamera: () => Promise<void>
  close: () => void
}

/**
 * Asking for a device was refused, or there is none. Carries which, because
 * the sentences differ: no microphone means no call, no camera means a call
 * without one.
 */
export class MediaAccessError extends Error {
  readonly device: 'microphone' | 'camera'

  constructor(device: 'microphone' | 'camera') {
    super(`${device} unavailable`)
    this.name = 'MediaAccessError'
    this.device = device
  }
}

export interface CallEngine {
  /**
   * Whether this build can carry a call at all. Everything else about calling
   * is gated on it: a build that says no declares no capability to the
   * server, is never rung, and draws no call button.
   */
  supported: () => boolean
  /**
   * Takes the microphone — and the camera for a video call — *before* the call
   * is placed or answered. A permission prompt that appeared after the other
   * person's phone had started ringing would be a ring nobody could answer
   * into.
   */
  acquire: (want: { video: boolean }) => Promise<LocalMedia>
  open: (config: IceConfig, local: LocalMedia, handlers: EngineHandlers) => EngineSession
}
