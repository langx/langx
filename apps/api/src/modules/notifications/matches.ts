import { MATCH_SUGGESTIONS, discoveryQuerySchema, profileUrl, type Locale } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { fetchAvatarAsset, type AvatarFace } from '../../email/avatars'
import { matchSuggestionsSection } from '../../email/templates'
import type { Conversation } from '../chat/conversations'
import { discoverProfiles } from '../discovery/discovery'
import type { Profile } from '../profiles/profiles'
import type { DigestCandidate } from './digest'
import { alreadyClaimed, claimOnce } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "People you could practise with" — the digest's one passenger.
 *
 * **It is never a reason to send.** Everything else in the evening mail is
 * something that happened; this is the app volunteering strangers, and a
 * letter whose only content is a list of them is the letter people mean when
 * they say an app mails too much. So it rides along when the mail is already
 * going and is silent otherwise, which also means a dormant account — the one
 * with nothing happening by definition — is never sent it at all.
 *
 * Who may appear is not decided here. `discoverProfiles` is the same matching
 * the Discover screen uses, so a profile that has made itself undiscoverable,
 * a guest, a suspended account and anybody blocked in either direction are all
 * excluded by the same rule in the same place. That was the condition for
 * putting names and faces in front of somebody who never opened their profile:
 * one definition, not two.
 */
export async function matchSuggestionsSectionFor(
  db: Db,
  profile: Profile,
  now: Date,
  storagePublicBaseUrl?: string,
): Promise<DigestCandidate | null> {
  // Long enough to have finished onboarding and scrolled Discover once. An
  // account with no `createdAt` at all is not given the benefit of the doubt:
  // the only rows like that are imports, and an import is somebody who has
  // never seen this app.
  if (!profile.createdAt) return null
  if (
    now.getTime() - new Date(profile.createdAt).getTime() <
    MATCH_SUGGESTIONS.minAccountDays * DAY_MS
  )
    return null

  const lastActiveAt = profile.stats?.lastActiveAt
  if (!lastActiveAt) return null
  // Past this, `promo.away30` has already said "this is the last we will say
  // about it". Suggestions arriving on day forty would make that a lie.
  const away = now.getTime() - new Date(lastActiveAt).getTime()
  if (away > MATCH_SUGGESTIONS.maxAwayDays * DAY_MS) return null

  const period = fortnight(now)
  // The cheap look before the expensive one: discovery is an aggregate per
  // reader, and most evenings this has already been said this fortnight.
  if (await alreadyClaimed(db, 'promo.matches', profile._id, period)) return null

  const page = await discoverProfiles(
    db,
    profile._id,
    discoveryQuerySchema.parse({ limit: MATCH_SUGGESTIONS.candidates }),
  )

  // Somebody they have already written to is not a suggestion. This is also
  // what keeps the list moving as the app grows: the pool a reader has not
  // met shrinks as they meet it.
  const known = await knownPartners(db, profile._id)
  const fresh = page.items.filter((item) => !known.has(item._id))
  /*
   * Below the floor the mail would stop being a suggestion and start being an
   * admission of how few people are here. Silence is the better answer, and
   * the fix for it is more members rather than a shorter list.
   */
  if (fresh.length < MATCH_SUGGESTIONS.minCandidates) return null

  const shown = fresh.slice(0, MATCH_SUGGESTIONS.faces)
  const faces: AvatarFace[] = []
  for (const item of shown) {
    const asset = item.avatarUrl
      ? await fetchAvatarAsset(item.avatarUrl, `match-${item._id}`, storagePublicBaseUrl)
      : null
    faces.push({
      name: item.displayName,
      seed: item._id,
      ...(asset ? { asset } : {}),
      url: profileUrl(item.handle),
    })
  }

  return {
    trigger: false,
    claim: () => claimOnce(db, 'promo.matches', profile._id, period),
    build: (locale: Locale) =>
      matchSuggestionsSection(locale, { faces, more: fresh.length - shown.length }),
  }
}

/** Everybody this person already has a conversation with, in either direction. */
async function knownPartners(db: Db, userId: string): Promise<Set<string>> {
  const conversations = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: userId }, { projection: { participants: 1 } })
    .toArray()
  const known = new Set<string>()
  for (const conversation of conversations) {
    for (const id of conversation.participants) if (id !== userId) known.add(id)
  }
  return known
}

/**
 * Which fortnight it is, counted off a fixed epoch rather than off the
 * reader's join date — so the answer is the same at every tick of the two
 * weeks and needs nothing stored to work it out.
 *
 * Fourteen days is a claim about the size of the pool, not about attention.
 * The section is three faces out of everybody whose languages fit; while the
 * app is small that set barely moves from one week to the next, and a weekly
 * suggestion would be the same three people with a new date on it. It also
 * sits under the ledger's thirty-day expiry, which a monthly key would not.
 */
function fortnight(now: Date): string {
  return `f${Math.floor(now.getTime() / (MATCH_SUGGESTIONS.everyDays * DAY_MS))}`
}
