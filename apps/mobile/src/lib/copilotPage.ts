import { PLAN_LIMITS, type CopilotAction, type CopilotStatus } from '@langx/shared'
import { copilotGate } from './copilotGate'

/**
 * Copilot answers a day on each plan, as the page says them: the same beta on
 * both, and Pro is more answers rather than access (`PlanLimits.copilot`).
 *
 * `null` if either plan were unlimited, which `PlanLimits.copilotPer24h` says
 * must never happen — and then the page says no number rather than a wrong
 * one. `copilotPage.test.ts` holds both to finite, and Pro's to the larger.
 */
export function copilotAllowances(): { free: number; pro: number } | null {
  const free = PLAN_LIMITS.free.copilotPer24h
  const pro = PLAN_LIMITS.pro.copilotPer24h
  return free === null || pro === null ? null : { free, pro }
}

/**
 * The order the Copilot page lists the four helps in: the order a person
 * meets them while writing — whether what they wrote is right, how to say
 * what they cannot yet, then what arrives from the other side: what it
 * means, and what to answer. copilot.langx.io lists them in the same order.
 *
 * `COPILOT_ACTIONS` is the API's order, which is not this one, so the page
 * keeps its own and `copilotPage.test.ts` holds it to the same four.
 */
export const COPILOT_PAGE_HELPS = [
  'check',
  'sayIt',
  'explain',
  'replyIdeas',
] as const satisfies readonly CopilotAction[]

/**
 * The one thing the Copilot page offers to do, or nothing.
 *
 * - `tryInChat` — Copilot answers this person (`copilotGate` is `ready` or
 *   `consent`), so the page sends them to their chats, where it lives. The
 *   consent sheet is the thread's to show, at the first tap, as it always is.
 * - `signUp` — a guest, on a deployment where Copilot is on: a quota and a
 *   consent need an account, so the way to it is an account.
 * - `null` — Copilot is off for this person, or the thread they would land in
 *   draws none of it. The page still describes it; it only has no button.
 *
 * `v3` is `flags.v3Home`: only the redesign's thread draws Copilot
 * (`ChatScreen` passes `enabled: v3Thread && !readOnly`), so sending somebody
 * on the current look to a chat to try it would send them to a chat without it.
 */
export type CopilotPageAction = 'tryInChat' | 'signUp' | null

export function copilotPageAction({
  v3,
  session,
  service,
  status,
}: {
  v3: boolean
  /** A signed-in account, a guest, or not known yet. */
  session: 'member' | 'guest' | 'none'
  /** `/app-config`'s `copilotService`: the deployment has a key and the switch is on. */
  service: boolean | undefined
  /** `GET /copilot`, asked only for a member. */
  status: Pick<CopilotStatus, 'available' | 'consented'> | undefined
}): CopilotPageAction {
  if (!v3) return null
  if (session === 'member') return copilotGate(service, status) === 'off' ? null : 'tryInChat'
  if (session === 'guest') return service === true ? 'signUp' : null
  return null
}
