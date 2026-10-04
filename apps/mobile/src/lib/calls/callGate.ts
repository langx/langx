import { CALL_LIMITS } from '@langx/shared'

/**
 * Whether the chat header offers a call, and what happens when it is pressed.
 *
 * Three answers, and the difference between the first two is the design of
 * the gate. **Hidden** is for a call that cannot happen and that the person
 * can do nothing about from this screen — a deployment with no call service,
 * a build with no media engine, a thread with a channel or a suspended
 * account, or one of the two having switched calls off. A button there would
 * only ever produce an apology.
 *
 * **Locked** is the other kind: the consent gate. The buttons are drawn and a
 * press says how many more messages it takes, for the reason the photo button
 * is disabled rather than hidden — a control that vanishes teaches nothing,
 * and the whole value of this rule is that people know it is there.
 */
export type CallAvailability = 'hidden' | 'locked' | 'ready'

export interface CallGateInput {
  /** `/app-config` says this deployment can place calls. */
  callService: boolean
  /** This build has a media engine. False on a phone until the native module ships. */
  engineSupported: boolean
  /** A channel or a suspended account: nothing sent from here would arrive. */
  readOnly: boolean
  /** The partner's profile has loaded. Until it has, nothing is known. */
  partnerKnown: boolean
  /** `acceptsCalls` on their profile; `false` when they switched calls off. */
  partnerAcceptsCalls: boolean
  /** The viewer's own switch. Off means they place no calls either. */
  viewerRefusesCalls: boolean
  /** How many more messages from them before the gate opens, or 0. */
  lockedFor: number
}

export function callAvailability(input: CallGateInput): CallAvailability {
  if (!input.callService || !input.engineSupported) return 'hidden'
  if (input.readOnly || !input.partnerKnown) return 'hidden'
  if (!input.partnerAcceptsCalls || input.viewerRefusesCalls) return 'hidden'
  return input.lockedFor > 0 ? 'locked' : 'ready'
}

/**
 * Whether an agreed time to talk is close enough to offer "Call now" on its
 * card: from `meetingCallLeadMinutes` before it starts until it was meant to
 * end. Only an accepted one — a proposal nobody said yes to is not a plan to
 * call, and a cancelled one is not a plan at all.
 */
export function meetingCallOpen(
  meeting: { startsAt: string; durationMinutes: number; status: string } | undefined,
  now: number,
): boolean {
  if (meeting?.status !== 'accepted') return false
  const startsAt = Date.parse(meeting.startsAt)
  if (Number.isNaN(startsAt)) return false
  const opens = startsAt - CALL_LIMITS.meetingCallLeadMinutes * 60_000
  const ends = startsAt + meeting.durationMinutes * 60_000
  return now >= opens && now <= ends
}
