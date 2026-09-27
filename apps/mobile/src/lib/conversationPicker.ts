import { OFFICIAL_WRITABLE, isOfficialHandle } from '@langx/shared'

/** What the picker knows about the person on the other side of a row. */
export interface PickerPartner {
  displayName: string
  handle?: string
  official?: boolean
  accountStatus?: 'active' | 'suspended' | 'deleted'
}

/**
 * Whether anything sent to this person would arrive.
 *
 * The same refusals the server makes, read off what the chat list already
 * carries, so the picker never offers a row whose send is certain to fail:
 * a channel (`OFFICIAL_WRITABLE` is in shared for exactly this), a suspended
 * account and one in its deletion grace. An official handle the app does not
 * know is let through — the server still decides, and hiding a thread
 * somebody can write to is the worse mistake.
 */
export function acceptsSends(partner: PickerPartner): boolean {
  if ((partner.accountStatus ?? 'active') !== 'active') return false
  if (partner.official && partner.handle && isOfficialHandle(partner.handle)) {
    return OFFICIAL_WRITABLE[partner.handle.trim().toLowerCase() as keyof typeof OFFICIAL_WRITABLE]
  }
  return true
}

/**
 * Case- and accent-blind, so "jose" finds "José" and "@Ada" finds `ada`.
 * Accents rather than letters: the decomposition only drops combining marks,
 * so a name in a script without them is compared exactly as written.
 */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}

/**
 * The rows the picker shows, in the order given, for what has been typed.
 *
 * A row whose partner has not resolved yet is kept while nothing is typed —
 * its name is on the way — and dropped from a search, which it cannot match.
 */
export function pickableConversations<T extends { partner: PickerPartner | undefined }>(
  rows: readonly T[],
  query: string,
): T[] {
  const needle = fold(query.trim().replace(/^@/, ''))
  return rows.filter(({ partner }) => {
    if (!partner) return needle.length === 0
    if (!acceptsSends(partner)) return false
    if (needle.length === 0) return true
    return fold(partner.displayName).includes(needle) || fold(partner.handle ?? '').includes(needle)
  })
}
