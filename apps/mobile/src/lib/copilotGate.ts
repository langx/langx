import { COPILOT_RULES, type CopilotStatus } from '@langx/shared'

/**
 * What the app does when somebody reaches for Copilot.
 *
 * - `off` — say Copilot is off, and nothing else. The operator's switch is
 *   off, there is no key, the account is not on the operator's allow-list,
 *   it is under Copilot's age, or the API predates Copilot. Nothing breaks
 *   and nothing is asked; the v3 thread draws no Copilot control at all.
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

/**
 * Which of the composer's two questions the draft can be asked.
 *
 * Neither while writing a correction: that draft starts as the other
 * person's sentence, and Check and Say it send only the asker's own text —
 * which is why the partner-age guard leaves them alone on the server.
 * Sending their words through either would show the model the one thing that
 * guard keeps from it. Over a question's cap its row is not offered, since
 * the server would refuse it; Say it also needs a language to say it in.
 */
export function copilotOffers(
  draft: string,
  correcting: boolean,
  targetLanguage: string | undefined,
): { check: boolean; sayIt: boolean } {
  const text = draft.trim()
  const open = !correcting && text.length > 0
  return {
    check: open && text.length <= COPILOT_RULES.maxCheckChars,
    sayIt: open && targetLanguage !== undefined && text.length <= COPILOT_RULES.maxSayItChars,
  }
}

/**
 * The language Say it answers in: the first one the person is learning that
 * the other person speaks natively — the one this chat is most likely in —
 * or else the first one they are learning. None for somebody learning
 * nothing, and then the row is not offered.
 */
export function copilotTargetLanguage(
  learning: readonly { code: string }[] | undefined,
  partnerNative: readonly { code: string }[] | undefined,
): string | undefined {
  const theirs = new Set((partnerNative ?? []).map((language) => language.code))
  return learning?.find((language) => theirs.has(language.code))?.code ?? learning?.[0]?.code
}
