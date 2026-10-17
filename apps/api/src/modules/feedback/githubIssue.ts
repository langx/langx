import type { FeedbackKind } from '@langx/shared'

/**
 * Turning a report from the app into an issue on the repository.
 *
 * **It is opened for us, with a token, when there is one** — `openIssue`
 * below, labelled `triage` so that nothing filed this way reads as accepted
 * work until somebody has looked at it. The prefilled `/issues/new` link is
 * still built every time and is what the report falls back to: no token, an
 * expired one, GitHub having a bad minute. The token used to be the only path
 * and failed silently when it expired (see _The tracker gets a link, not a
 * token_ in `docs/decisions.md`); now a failure lands on the link, is logged
 * as an error, and the support mail says the issue was *not* opened.
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
 */

/** Which label the two kinds carry; both exist on `langx/langx`. */
const LABELS: Record<FeedbackKind, string> = { bug: 'bug', feature: 'feature' }

/**
 * On everything filed from the app, beside the kind. The words are a
 * stranger's and went public without anybody reading them first, so the
 * tracker shows them as not yet looked at until somebody removes this.
 */
const TRIAGE_LABEL = 'triage'

function labelsFor(kind: FeedbackKind): string[] {
  return [LABELS[kind], TRIAGE_LABEL]
}

/**
 * GitHub answers 414 to a long enough URL, and a 2000-character report plus
 * percent-encoding gets within sight of whatever the real ceiling is. Past
 * this the body is dropped from the link: the title and the label still land,
 * and the words are in the email the link arrived in, to paste.
 */
const MAX_URL_LENGTH = 6000

export interface FeedbackIssue {
  kind: FeedbackKind
  body: string
  attachmentCount: number
}

/** What the issue would say, and the only place the wording lives. */
export function issueBody(input: FeedbackIssue): string {
  const proof =
    input.attachmentCount > 0
      ? `${input.attachmentCount} file(s) attached — in the email this came with.`
      : 'No files attached.'
  return [
    input.body,
    '',
    '---',
    `_Sent from the app. ${proof} The sender is named in the email, not here._`,
  ].join('\n')
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

/** `repo` is `owner/name`. */
export function newIssueUrl(repo: string, input: FeedbackIssue): string {
  const base = `https://github.com/${repo}/issues/new`
  const fields = {
    title: issueTitle(input.kind, input.body),
    labels: labelsFor(input.kind).join(','),
  }

  const withBody = `${base}?${new URLSearchParams({ ...fields, body: issueBody(input) }).toString()}`
  if (withBody.length <= MAX_URL_LENGTH) return withBody
  return `${base}?${new URLSearchParams(fields).toString()}`
}

/** True for an issue that exists, false for the prefilled form that would open one. */
export function isFiledIssue(url: string | undefined): url is string {
  return !!url && /\/issues\/\d+$/.test(url)
}

/**
 * Opens the issue on GitHub and answers its page's URL.
 *
 * Throws on anything but a created issue, deliberately: the caller is the one
 * that decides a failure must not fail somebody's report, and it can only log
 * what it is told about. Answering `null` here is how the old version hid an
 * expired token for a day.
 */
export async function openIssue(
  token: string,
  repo: string,
  input: FeedbackIssue,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'langx-api',
    },
    body: JSON.stringify({
      title: issueTitle(input.kind, input.body),
      body: issueBody(input),
      labels: labelsFor(input.kind),
    }),
    // A report waits on this; a tracker that hangs must not hold it.
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status !== 201) {
    throw new Error(`GitHub answered ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }
  const issue = (await response.json()) as { html_url?: unknown }
  if (typeof issue.html_url !== 'string') throw new Error('GitHub answered without an issue URL')
  return issue.html_url
}
