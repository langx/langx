import { inviteHandleFromUrl, HANDLE_PATTERN } from '@langx/shared'
import type { ReferralSource } from '@langx/shared'

export { inviteHandleFromUrl }

/**
 * What somebody typed or pasted into the invite-code field, as a handle.
 *
 * Accepts a whole invite URL, because pasting the link is the single most
 * likely thing a person does with a link — and supporting it costs one branch.
 * Also strips a leading `@` and lower-cases, since a handle is lower-case and
 * this field is typed by hand from something read on another screen.
 *
 * Returns null rather than throwing, and null means "not a code", not "no such
 * person" — whether the handle exists is the server's question, and the field
 * is advisory either way.
 */
export function normalizeInviteCode(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  const fromUrl = inviteHandleFromUrl(trimmed)
  if (fromUrl) return fromUrl

  // A bare profile link with no marker is still a deliberate paste into a box
  // labelled "invite code", so unlike a link *arriving* from outside, the
  // intent here is not in doubt.
  const pathish = trimmed.match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?[^/\s]*\/([^/?#\s]+)/i)?.[1]
  const candidate = (pathish ?? trimmed).replace(/^@/, '').toLowerCase()
  return HANDLE_PATTERN.test(candidate) ? candidate : null
}

/**
 * Which referrer onboarding should carry, given what the draft already holds
 * and what an invite link left on the device.
 *
 * A pure function rather than a branch inside `hydrateDraft`, because that
 * store cannot be reached by `vitest` — it only covers `src/lib` — and this is
 * the part with a rule in it. The rule shipped once already as a flag that was
 * written in two places and read in none, which is a link that silently
 * attributes nobody; the point of pulling it out is that the next such gap
 * fails a test instead.
 *
 * A code already in the draft wins. It was either typed, which is a more
 * deliberate answer than a link, or it is this same flag from an earlier
 * launch — and re-labelling that one `link` would overwrite a `manual` the
 * reader chose.
 */
export function resolveReferrer(
  draftHandle: string,
  pending: string | null | undefined,
): { handle: string; source: ReferralSource } | null {
  if (draftHandle) return null
  const handle = normalizeInviteCode(pending)
  return handle ? { handle, source: 'link' } : null
}
