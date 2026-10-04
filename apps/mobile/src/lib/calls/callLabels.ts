import type { CallEndReason, CallMedia, CallOutcome, MessageCall } from '@langx/shared'
import type { MessageKey } from '../../i18n/runtime'
import type { CallClosing } from './machine'

/**
 * How a call reads, to the person reading.
 *
 * The server stores what happened once, for both people; the words are chosen
 * here, from which side the reader was on. A call nobody answered is "missed"
 * to whoever was called and "no answer" to whoever placed it, and the same row
 * has to say each to each.
 */
export interface CallRowLabel {
  /** What kind of call it was, from this reader's side. */
  title: MessageKey
  /** A second, quieter fact — or `null` when the title says it all. */
  detail: MessageKey | null
  /** Worth drawing in the warning colour: a call this reader did not take. */
  missed: boolean
}

type Direction = 'outgoing' | 'incoming' | 'missed'

const TITLES = {
  outgoing: { audio: 'calls.row.outgoingVoice', video: 'calls.row.outgoingVideo' },
  incoming: { audio: 'calls.row.incomingVoice', video: 'calls.row.incomingVideo' },
  missed: { audio: 'calls.row.missedVoice', video: 'calls.row.missedVideo' },
} as const satisfies Record<Direction, Record<CallMedia, MessageKey>>

/**
 * `mine` is whether the reader placed the call — the row's `senderId`.
 *
 * To the caller every unanswered call is the same "no answer", including one
 * that was declined. That is deliberate: "they turned you down", kept in the
 * thread for good, is a harsher record than the moment deserved, and the
 * person who declined did not agree to have it written under their name.
 */
export function callRowLabel(
  call: Pick<MessageCall, 'media' | 'outcome'>,
  mine: boolean,
): CallRowLabel {
  const answered = call.outcome === 'completed' || call.outcome === 'failed'
  if (mine) {
    return {
      title: TITLES.outgoing[call.media],
      detail: detailFor(call.outcome, true),
      missed: false,
    }
  }
  // A call they declined is one they saw; only the two that happened without
  // them are "missed".
  const missed = call.outcome === 'missed' || call.outcome === 'busy'
  return {
    title: TITLES[missed ? 'missed' : 'incoming'][call.media],
    detail: answered || call.outcome === 'declined' ? detailFor(call.outcome, false) : null,
    missed,
  }
}

function detailFor(outcome: CallOutcome, mine: boolean): MessageKey | null {
  if (outcome === 'failed') return 'calls.row.failed'
  if (outcome === 'completed') return null
  if (mine) return 'calls.row.noAnswer'
  return outcome === 'declined' ? 'calls.row.declined' : null
}

/**
 * A call's length as a clock reads it: `0:07`, `3:12`, `1:02:45`.
 *
 * By hand rather than through `Intl`, which Hermes only half has, and because
 * a duration is not a time of day — it has no locale. Every language on a
 * phone shows a call timer this way.
 */
export function formatCallDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  if (hours === 0) return `${minutes}:${rest}`
  return `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
}

const END_LINES: Record<CallEndReason, MessageKey> = {
  hangup: 'calls.ended',
  cancelled: 'calls.ended',
  // The caller is told "no answer" either way — see `callRowLabel`.
  declined: 'calls.noAnswer',
  timeout: 'calls.noAnswer',
  answeredElsewhere: 'calls.ended',
  busy: 'calls.busy',
  connectFailed: 'calls.failed',
  connectionLost: 'calls.connectionLost',
  maxDuration: 'calls.maxDuration',
  ended: 'calls.ended',
}

/** Error codes the API refuses a call with, and the sentence for each. */
const REFUSAL_LINES: Record<string, MessageKey> = {
  CALL_BUSY: 'calls.busy',
  CALL_UNREACHABLE: 'calls.unreachable',
  CALL_COOLDOWN: 'calls.cooldown',
  CALL_IN_PROGRESS: 'calls.inProgress',
  CALLS_UNAVAILABLE: 'calls.unavailable',
  CALLS_LOCKED: 'calls.lockedShort',
  RECIPIENT_SUSPENDED: 'calls.unavailableThem',
  BLOCKED: 'calls.unavailableThem',
  RATE_LIMITED: 'calls.tooMany',
  MIC_DENIED: 'calls.micNeeded',
  CAMERA_DENIED: 'calls.cameraNeeded',
}

/**
 * The one line a call leaves on screen as it closes.
 *
 * An unknown code gets the plain sentence rather than the code itself: a
 * refusal this build has never heard of is still a call that did not happen.
 */
export function closingLine(closing: CallClosing): MessageKey {
  if (closing.kind === 'ended') return END_LINES[closing.reason]
  if (closing.code === 'CALLS_REFUSED') {
    // Said about them unless the server said it was the reader's own switch:
    // "you have calls off" to somebody who does not is the worse mistake.
    return closing.reason === 'you' ? 'calls.refusedYou' : 'calls.refusedThem'
  }
  return REFUSAL_LINES[closing.code] ?? 'calls.failed'
}
