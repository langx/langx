import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'
import { deliverOfficialMessage } from './deliver'

/**
 * The hello for somebody who was here in v1, in place of the one in
 * `welcome.ts` that they have never been sent.
 *
 * Returning users were skipped there on the grounds that the welcome-back
 * screen says more — which is true of that screen and not true of this thread,
 * where they arrive to find @langx at the top of an otherwise empty chat list
 * and nothing in it. This is what is in it.
 *
 * `clientId` makes it exactly-once by index rather than by a flag, which is
 * what lets the session hook, onboarding and the backfill script all call it
 * without knowing about each other.
 */
export async function sendWelcomeBackMessage(db: Db, userId: string): Promise<void> {
  /*
   * No profile yet, no message. `localeFor` answers English when it has no
   * languages to read, and an account seconds old has none — so sending here
   * would write an English greeting to somebody who picks Turkish two minutes
   * later. Onboarding calls this again once the languages exist, and the
   * `clientId` means whichever call gets there first is the only one that
   * writes.
   */
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { _id: 1 } })
  if (!profile) return

  const locale = await localeFor(db, userId)
  const t = translator(locale)

  /*
   * Three parts, in the same order as the ordinary welcome: what this badge
   * is, what has changed since they were last here, and the sign-off last.
   *
   * Nothing about tokens carried over or a frozen streak, deliberately. Half
   * this cohort is a `precreatedFromV1` row with nothing staged behind it —
   * they carried neither — and one message has to be true for both halves.
   */
  await deliverOfficialMessage(db, {
    fromHandle: 'langx',
    toUserId: userId,
    body: [
      t('official.welcomeBack'),
      t('official.welcomeBackWhatsNew'),
      t('official.welcomeBackClosing'),
    ].join('\n\n'),
    clientId: `welcomeback:${userId}`,
  })

  /*
   * No `fanOutMessage`, and this is the one place where the obvious code is
   * wrong rather than merely unnecessary.
   *
   * The caller in `auth.ts` runs on **every** session, not just the first, and
   * `deliverOfficialMessage` answers a repeated `clientId` with the message it
   * already wrote rather than an error. A caller that fanned that out would
   * push this greeting again on every sign-in, forever. A `claimOnce` guard
   * does not save it either: `notificationLedger` rows expire after thirty
   * days, so sign-in number four hundred pushes again.
   *
   * Nothing is lost by leaving it out. `recordMessage` has already bumped the
   * unread count, so the thread is waiting with a dot on it, and the person is
   * opening the app at this exact moment — a push for a message that appears
   * while you are looking at the screen is noise. The one push this feature
   * sends is the badge's, from the evening round-up.
   */
}
