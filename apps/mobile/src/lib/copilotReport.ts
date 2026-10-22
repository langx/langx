import {
  COPILOT_OWN_QUESTION_ACTIONS,
  COPILOT_REPORT_MAX_ANSWER_CHARS,
  type CopilotReportRequest,
  type CopilotResult,
} from '@langx/shared'

/**
 * One answer as the operators read it: the words the card showed, one item
 * a line. The server keeps no copy of an answer tied to anybody, so this is
 * the only record of what the person saw.
 */
export function copilotAnswerText(result: CopilotResult): string {
  switch (result.action) {
    case 'check':
      return result.changed
        ? [result.corrected, result.reason].filter(Boolean).join('\n')
        : `${result.corrected}\n(no change)`
    case 'sayIt':
      return result.options
        .map((option) => (option.gloss ? `${option.text} — ${option.gloss}` : option.text))
        .join('\n')
    case 'replyIdeas':
      return result.ideas.join('\n')
    case 'explain':
      return result.explanation
  }
}

/**
 * Whether the confirm sheet may offer to send the question: only for Check
 * and Say it, whose question is the person's own draft. Explain and Reply
 * ideas were asked about the other person's words, which are not theirs to
 * send — the server refuses them too.
 */
export function copilotReportOffersQuestion(result: CopilotResult, asked: string): boolean {
  return COPILOT_OWN_QUESTION_ACTIONS.includes(result.action) && asked.trim().length > 0
}

/** What `POST /copilot/report` is sent, with the draft only when the box was ticked. */
export function copilotReportRequest(
  result: CopilotResult,
  asked: string,
  includeQuestion: boolean,
): CopilotReportRequest {
  const question =
    includeQuestion && copilotReportOffersQuestion(result, asked) ? asked.trim() : undefined
  return {
    action: result.action,
    answer: copilotAnswerText(result).slice(0, COPILOT_REPORT_MAX_ANSWER_CHARS),
    ...(question !== undefined ? { question } : {}),
  }
}
