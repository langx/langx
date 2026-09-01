import { inviteHandleFromUrl } from '@langx/shared'
import { HANDLE_PATTERN } from '@langx/shared'

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
