import { resolveLocale, type Locale } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from './profiles'

/**
 * What language to write to somebody in, when there is no request to read it
 * off — every notification email, and the campaign sender.
 *
 * Their **native** languages decide it, not the language their phone is set
 * to. In an app for practising a language, the interface is something people
 * deliberately put into the one they are learning; mail is not part of that
 * exercise. A nudge that arrives in a language somebody is still working on is
 * a nudge they may not act on, so this asks the one question whose answer is
 * never a study choice: which language do you already have.
 *
 * The whole ordered list goes to `resolveLocale`, not just the first entry, so
 * a Japanese-and-Turkish speaker gets Turkish rather than the English that
 * `ja` alone would fall back to. Somebody whose languages we ship no
 * catalogue for still gets English — eight locales is the promise, and a
 * half-translated ninth would be worse.
 *
 * Push is deliberately not this: `tokensByLocale` words a notification in the
 * locale of the device it is going to, which is a fact about that screen.
 */
export async function localeFor(db: Db, userId: string): Promise<Locale> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { nativeLanguages: 1 } })
  return resolveLocale((profile?.nativeLanguages ?? []).map((language) => language.code))
}
