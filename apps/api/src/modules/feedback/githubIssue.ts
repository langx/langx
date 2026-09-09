import type { FeedbackKind } from '@langx/shared'

/**
 * The link that turns a report from the app into an issue on the repository.
 *
 * **Nothing here talks to GitHub.** The email carries a prefilled
 * `/issues/new` link and a person presses Submit on GitHub's own form, signed
 * in as themselves. That is the point: this service holds no credential that
 * can write to the tracker, so there is none to leak, to rotate, or to quietly
 * expire — which is the failure this replaces. A token that had reached its
 * organisation's maximum lifetime turned every report into a silent `null`,
 * and because opening an issue must never fail a person's report, nothing
 * logged it either. A link cannot go stale that way.
 *
 * It also puts a person between a stranger's words and a public issue: the
 * form opens with the text in it and can be edited, or closed.
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
  const fields = { title: issueTitle(input.kind, input.body), labels: LABELS[input.kind] }

  const withBody = `${base}?${new URLSearchParams({ ...fields, body: issueBody(input) }).toString()}`
  if (withBody.length <= MAX_URL_LENGTH) return withBody
  return `${base}?${new URLSearchParams(fields).toString()}`
}
