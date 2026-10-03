import type { Db } from 'mongodb'
import { officialNoteEmail } from '../../email/templates'
import type { EmailSender } from '../../email/sender'
import { claimOnce } from '../notifications/ledger'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'

export type NoteEmailOutcome = 'sent' | 'noAddress' | 'alreadySent'

/**
 * Mails a note that is already in somebody's @langx thread.
 *
 * For the case the thread cannot cover: a suspended account cannot open the
 * app to read it, and a push is gone once dismissed. So the panel can ask for
 * the same words in the inbox, and the one-off backfill uses this too.
 *
 * Claimed per message in `notificationLedger`, before the send — the same
 * doctrine as every other once-only mail. A send that then fails is one mail
 * nobody got; the opposite order would be the same note twice.
 *
 * A verified address only. An unverified one is whatever was typed at
 * sign-up, and an operator's words about an account are not something to
 * send to an address nobody has proved they own.
 */
export async function emailOfficialNote(
  db: Db,
  sender: EmailSender,
  input: { userId: string; messageId: string; body: string },
): Promise<NoteEmailOutcome> {
  const address = await emailFor(db, input.userId)
  if (!address?.verified) return 'noAddress'
  if (!(await claimOnce(db, 'officialNoteEmail', input.userId, input.messageId))) {
    return 'alreadySent'
  }
  const locale = await localeFor(db, input.userId)
  await sender.send({ to: address.email, ...officialNoteEmail(locale, { body: input.body }) })
  return 'sent'
}
