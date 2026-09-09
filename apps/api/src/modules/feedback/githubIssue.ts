import type { FeedbackKind } from '@langx/shared'

/**
 * Opening an issue on the repository for a report that came from the app.
 *
 * **The issue is public, and what goes in it is chosen with that in mind.** It
 * carries the words somebody typed, because without those it is not a report —
 * and nothing else. No handle, no user id, no address, and *not the proof
 * files*: those live under `feedback/<userId>/`, so their URLs carry the
 * account id, and `GET /profiles/:handleOrId` turns an account id into a
 * handle. A link that looks anonymous and names somebody two requests later is
 * worse than no link. The email keeps the sender and the screenshots, and the
 * email is what links the two.
 *
 * Somebody reporting a crash did not ask to have their name on a public
 * tracker. The screen that posts here says so before they send.
 *
 * Optional, like every other outside service here: with no token the report is
 * still mailed and this simply does not happen. It never throws — a tracker
 * that is down, a revoked token or a rate limit must not turn into a person
 * being told their report failed, when it did not.
 */
export interface GitHubIssueConfig {
  token: string | undefined
  /** `owner/name`. */
  repo: string
}

/** Which label the two kinds carry; both exist on `langx/langx`. */
const LABELS: Record<FeedbackKind, string> = { bug: 'bug', feature: 'feature' }

/** Long enough for a slow API, short enough that nobody waits on it. */
const TIMEOUT_MS = 10_000

export async function openFeedbackIssue(
  config: GitHubIssueConfig,
  input: { kind: FeedbackKind; body: string; attachmentCount: number },
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!config.token) return null

  const proof =
    input.attachmentCount > 0
      ? `${input.attachmentCount} file(s) attached — in the email this came with.`
      : 'No files attached.'
  const body = [
    input.body,
    '',
    '---',
    `_Sent from the app. ${proof} The sender is named in the email, not here._`,
  ].join('\n')

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${config.repo}/issues`, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        'user-agent': 'langx-api',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({
        title: issueTitle(input.kind, input.body),
        body,
        labels: [LABELS[input.kind]],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return null

    const created: unknown = await response.json()
    const url = (created as { html_url?: unknown }).html_url
    return typeof url === 'string' ? url : null
  } catch {
    return null
  }
}

/**
 * The first line of what they wrote, which is nearly always the sentence that
 * names the problem — trimmed to something a list of issues can read, and
 * prefixed so the tracker's search separates the two kinds without a filter.
 */
export function issueTitle(kind: FeedbackKind, body: string): string {
  const firstLine = body.trim().split('\n')[0]?.trim() ?? ''
  const short = firstLine.length > 80 ? `${firstLine.slice(0, 79).trimEnd()}…` : firstLine
  const prefix = kind === 'bug' ? 'Bug' : 'Feature'
  return `${prefix}: ${short || 'from the app'}`
}
