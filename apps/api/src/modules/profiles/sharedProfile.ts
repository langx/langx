import { type LanguageLevel, type SharedProfile } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from './profiles'

/**
 * The profile behind a shared link, for somebody who is not signed in.
 *
 * A second, smaller allow-list rather than a flag on `toPublicProfile`. That
 * one answers "what may another *member* see", and this one answers "what may
 * the open internet see" — different questions, and a boolean parameter is how
 * two different answers end up one edit away from each other.
 *
 * What is deliberately absent, and why:
 *
 *   - **Age, city, photos.** Individually mild; together they are the set that
 *     makes a link somebody did not expect to be public feel like one. The
 *     card exists to say "this is a real person on LangX, open the app" — none
 *     of these help it do that. The gallery stays out; the *avatar* is the one
 *     picture somebody picked to be their face, and it is here.
 *   - **Online status and last-active.** A presence beacon addressable by
 *     guessing a handle, with no account needed to watch it.
 *   - **Streak, tokens, tier, follower counts.** Numbers about someone,
 *     readable by anyone, with nothing gained.
 *
 * What is here is what a link has to carry to be worth following: who they
 * are, and what they are here to practise.
 *
 * The account id is here, and used to not be. It is what `/public/avatar/:seed`
 * draws a face from, and without it the one page strangers reach was the only
 * place an account with no avatar fell all the way through to its initials
 * while every screen inside the app drew it a face. The id buys nothing on its
 * own — every route that takes one asks for a session first, and the avatar
 * route answers for ids nobody holds precisely so it cannot be asked whether
 * an account exists.
 */
export async function getSharedProfile(db: Db, handle: string): Promise<SharedProfile> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne(
    {
      handle: handle.toLowerCase(),
      deletedAt: { $exists: false },
      // A guest handle is `guest:<id>`, which `handleSchema` can never produce
      // and no route can pass — but this read is the app's only unauthenticated
      // one, so it says so rather than relying on that.
      guest: { $exists: false },
    },
    {
      projection: {
        handle: 1,
        displayName: 1,
        avatarUrl: 1,
        bio: 1,
        pronouns: 1,
        birthDate: 1,
        country: 1,
        nativeLanguages: 1,
        learning: 1,
        official: 1,
      },
    },
  )

  /*
   * `settings.discoverable` is not consulted, and that is the same decision
   * `GET /profiles/:handleOrId` already makes: opting out of *being found* is
   * not the same as opting out of a link you handed somebody yourself.
   */
  if (!profile) throw new ApiError('NOT_FOUND', 'Profile not found')

  return {
    _id: profile._id,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    ...(profile.bio ? { bio: profile.bio } : {}),
    // Here although `gender` is not — see `sharedProfileSchema`. This page
    // goes to strangers, which makes it the worst one to get wrong.
    ...(profile.pronouns ? { pronouns: profile.pronouns } : {}),
    ...(profile.country ? { country: profile.country } : {}),
    ...(profile.official ? { official: true as const } : {}),
    nativeLanguages: (profile.nativeLanguages ?? []).map((l) => ({ code: l.code })),
    learning: (profile.learning ?? []).map((l) => ({
      code: l.code,
      level: l.level as LanguageLevel,
    })),
  }
}
