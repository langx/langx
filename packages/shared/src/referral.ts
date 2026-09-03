import { z } from 'zod'
import { profileUrl, profileQrUrl } from './appIdentity'
import { HANDLE_PATTERN } from './handle'

/**
 * The marker that turns a profile link into an invite link.
 *
 * A query parameter on the existing `/<handle>` route rather than a route of
 * its own. The path segment already *is* the code, so a dedicated `/i/<handle>`
 * would need a second signed-out screen doing everything `app/[username].tsx`
 * already does — resolve the handle, render the card, offer sign-up — and that
 * file sitting outside both `Stack.Protected` branches is the hard part of it.
 * Additive also means every profile link ever shared still resolves, and the
 * failure mode when the marker is stripped is today's behaviour rather than a
 * 404.
 *
 * The honest cost: a query string is the part of a URL most likely to be
 * dropped by a messaging app's link preview, or lost when somebody reads the
 * link aloud. That is why the code can also be typed in at onboarding — that
 * is the path that always works, and the link is the convenience on top.
 */
export const INVITE_QUERY_PARAM = 'invite'

/** The link somebody shares to invite a friend. Built on `profileUrl`, so
 *  `WEB_HOST` stays the single line that changes if the web build ever moves
 *  host. */
export function inviteUrl(handle: string): string {
  return `${profileUrl(handle)}?${INVITE_QUERY_PARAM}=1`
}

/** The QR for that link. Mirrors `profileQrUrl`, which the server branches on
 *  the same marker. */
export function inviteQrUrl(apiBaseUrl: string, handle: string): string {
  return `${profileQrUrl(apiBaseUrl, handle)}?${INVITE_QUERY_PARAM}=1`
}

/**
 * The referrer a URL names, or null.
 *
 * Pure, so the app and its tests agree, and total — every unrecognised shape
 * returns null rather than throwing. This runs on a cold start from
 * `Linking.getInitialURL()`, where a throw is a launch that never finishes.
 *
 * Deliberately strict about the marker: an unmarked profile link is not an
 * invite. "Share my profile" says nothing about referrals, and silently
 * turning it into an attribution flow would make copy that already shipped
 * false.
 */
export function inviteHandleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // Not `new URL`: `packages/shared` compiles without the DOM lib, and it is
  // the better parser here anyway. This has to read a custom scheme too —
  // `langx://deniz?invite=1` — and `URL` treats an unknown scheme's authority
  // inconsistently across runtimes, so the handle lands in `hostname` on one
  // and in `pathname` on another.
  const [beforeHash] = url.split('#')
  const [path, query = ''] = (beforeHash ?? '').split('?')
  if (!new RegExp(`(?:^|&)${INVITE_QUERY_PARAM}=1(?:&|$)`).test(query)) return null

  /*
   * Where the handle sits depends on the scheme, which is the whole reason
   * this is hand-rolled. Under `https` the authority is our host and the
   * handle is the first path segment. Under the app's own scheme there is no
   * host at all, so in `langx://deniz` the handle *is* what looks like the
   * authority — and `langx:///deniz` puts the same handle one slash further
   * along. Stripping every leading slash after the scheme collapses all three.
   */
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(path ?? '')?.[1]?.toLowerCase()
  const afterScheme = (path ?? '').replace(/^[a-z][a-z0-9+.-]*:/i, '')
  const rest =
    scheme === 'http' || scheme === 'https'
      ? afterScheme.replace(/^\/\//, '').replace(/^[^/]*/, '')
      : afterScheme
  const segment = rest.split('/').filter(Boolean)[0]
  if (!segment) return null
  const bare = (segment.startsWith('@') ? segment.slice(1) : segment).toLowerCase()
  return HANDLE_PATTERN.test(bare) ? bare : null
}

/**
 * How many invitees the status endpoint lists.
 *
 * Capped rather than paged: the totals are what people come for, and a cursor
 * would be a second contract to keep for a list nobody scrolls. The totals are
 * counted over the whole group, so they stay right past this.
 */
export const REFERRAL_LIST_LIMIT = 50

/**
 * Where an invite code came from.
 *
 * `link` means a marked invite URL put it there; `manual` means somebody typed
 * or pasted it into onboarding. The distinction exists to answer a question
 * the product will ask — whether an unmarked profile link should count as an
 * invitation too — with data rather than a guess. The server cannot infer it,
 * so the client says.
 */
export const REFERRAL_SOURCES = ['link', 'manual'] as const
export type ReferralSource = (typeof REFERRAL_SOURCES)[number]
export const referralSourceSchema = z.enum(REFERRAL_SOURCES)

export const REFERRAL_STATUSES = ['pending', 'activated', 'subscribed'] as const
export type ReferralInviteeStatus = (typeof REFERRAL_STATUSES)[number]

export const referralInviteeSchema = z.object({
  /** For the generated avatar; without it this row falls back to initials. */
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  status: z.enum(REFERRAL_STATUSES),
  invitedAt: z.string(),
  /** What this one invitee has paid so far — 0, activation, or maxPerInvitee. */
  earned: z.number().int(),
})
export type ReferralInvitee = z.infer<typeof referralInviteeSchema>

/**
 * Deliberately not in here: the invite code and URL, which the client already
 * has from `me.handle` and `inviteUrl`, and the award amounts, which it reads
 * straight from `TOKEN_RULES` exactly as the token screen reads the pool
 * numbers. Two fewer things to keep in step.
 */
export const referralStatusSchema = z.object({
  /**
   * Counted over the whole `referrerId` group rather than from `invitees`
   * below, which is capped. The number is the headline; the list is detail.
   */
  totals: z.object({
    invited: z.number().int(),
    activated: z.number().int(),
    subscribed: z.number().int(),
    tokensEarned: z.number().int(),
  }),
  /** Newest first, capped at `REFERRAL_LIST_LIMIT`. */
  invitees: z.array(referralInviteeSchema),
  /** Who invited *me*, if anyone. The invite screen says so out loud. */
  referredBy: z.object({ handle: z.string(), displayName: z.string() }).nullable(),
})
export type ReferralStatus = z.infer<typeof referralStatusSchema>
