import { inviteUrl, postUrl, profileUrl, type PeriodType } from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n/runtime'

/**
 * The sentences that go out through the share sheet, and nothing else.
 *
 * Pure on purpose: `share.ts` reaches for `react-native`, which vitest cannot
 * load, so everything worth a test — the wording, which link each thing
 * carries, how a post is cut down — lives here and is handed to it.
 *
 * Two rules shape every builder:
 *
 *   - **An achievement carries the invite link.** A streak, a rank and a badge
 *     are things somebody is proud of, and "look at mine" is the moment a
 *     friend is most likely to try the app. `inviteUrl` is a profile link with
 *     a marker, so the brag and the referral are one sentence.
 *   - **No balances.** `docs/token-messaging-brief.md`: say it as an
 *     achievement, never as money. A streak count and a rank are achievements;
 *     a token total is a number about money and stays off the sheet.
 */
export interface ShareContent {
  message: string
  /**
   * Absent when there is nothing to link — a chat message goes out as its own
   * text. Present, it is also what the clipboard receives when the sheet
   * cannot open.
   */
  url?: string
}

/**
 * How much of a post travels with its link. `MAX_POST_LENGTH` is 300, so most
 * posts fit whole; the cut is for the ones that would turn a share into a
 * wall of text above the link.
 */
export const SHARE_EXCERPT_LENGTH = 140

export function postExcerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  if (flat.length <= SHARE_EXCERPT_LENGTH) return flat
  // One short of the limit leaves room for the ellipsis, so the result never
  // exceeds what the constant promises.
  const cut = flat.slice(0, SHARE_EXCERPT_LENGTH - 1)
  const space = cut.lastIndexOf(' ')
  // A word boundary, unless honouring it would throw away half the excerpt —
  // a single very long token is cut mid-way rather than dropped.
  const kept = space > SHARE_EXCERPT_LENGTH / 2 ? cut.slice(0, space) : cut
  return `${kept.trimEnd()}…`
}

/**
 * Whether a rejected share was the person closing the sheet.
 *
 * Only the web rejects on cancel — `navigator.share` throws a DOMException
 * named `AbortError`; native resolves with `dismissedAction` instead. Named
 * here so the fallback in `share.ts` has one tested line to branch on, and so
 * no DOM type is needed to read it.
 */
export function isShareCancel(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

export function profileShareText(
  t: TranslateFn,
  { name, handle }: { name: string; handle: string },
): ShareContent {
  const url = profileUrl(handle)
  return { message: t('share.profileMessage', { name, url }), url }
}

export function postShareText(
  t: TranslateFn,
  { id, body, languageName }: { id: string; body: string; languageName: string },
): ShareContent {
  const url = postUrl(id)
  return {
    message: t('share.postMessage', { excerpt: postExcerpt(body), language: languageName, url }),
    url,
  }
}

export function streakShareText(
  t: TranslateFn,
  { count, handle }: { count: number; handle: string },
): ShareContent {
  const url = inviteUrl(handle)
  return { message: t('share.streakMessage', { count, url }), url }
}

/**
 * One whole sentence per period rather than `periodLabel` dropped into a
 * template: "This week" cannot be bent into "on this week's leaderboard" in
 * English, let alone in seven other languages. Same reasoning as
 * `lastSeenLabel` in `labels.ts`.
 */
export function leaderboardShareText(
  t: TranslateFn,
  { rank, period, handle }: { rank: number; period: PeriodType; handle: string },
): ShareContent {
  const url = inviteUrl(handle)
  return { message: t(`share.leaderboardMessage.${period}` as MessageKey, { rank, url }), url }
}

export function badgeShareText(
  t: TranslateFn,
  { label, handle }: { label: string; handle: string },
): ShareContent {
  const url = inviteUrl(handle)
  return { message: t('share.badgeMessage', { label, url }), url }
}
