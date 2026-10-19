import type { CopilotStatus } from '@langx/shared'

/**
 * What the app does when somebody reaches for Copilot.
 *
 * - `off` — say Copilot is off, and nothing else. The operator's switch is
 *   off, there is no key, the account is under Copilot's age, or the API
 *   predates Copilot. Nothing breaks and nothing is asked.
 * - `consent` — show the consent sheet first. Nothing is sent before it.
 * - `ready` — ask.
 *
 * Two inputs rather than one, because they answer different questions:
 * `/app-config`'s `copilotService` is the deployment, and arrives before
 * anybody signs in; `GET /copilot` is this person. Either saying no is off,
 * and a missing answer is a no — an API that has never heard of Copilot
 * sends neither.
 */
export type CopilotGate = 'off' | 'consent' | 'ready'

export function copilotGate(
  service: boolean | undefined,
  status: Pick<CopilotStatus, 'available' | 'consented'> | undefined,
): CopilotGate {
  if (service !== true || status?.available !== true) return 'off'
  return status.consented ? 'ready' : 'consent'
}
