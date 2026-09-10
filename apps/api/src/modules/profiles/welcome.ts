import type { FastifyInstance } from 'fastify'
import { welcomeEmail } from '../../email/templates'
import { emailFor } from './emailFor'
import { localeFor } from './localeFor'

/**
 * "Welcome to LangX", sent the moment onboarding finishes.
 *
 * Transactional, like the verification mail it follows: it answers something
 * somebody just did, it goes once in an account's life, and it carries no
 * unsubscribe because there is no preference behind it. `createProfile`
 * refuses a second profile, so "once" is enforced by the thing that already
 * enforced it rather than by a ledger row.
 *
 * Deliberately not awaited by its caller — see the call site. An address that
 * is somehow unverified gets nothing: onboarding is behind
 * `requireVerifiedEmail`, so that case is a contradiction rather than a
 * scenario, and the check costs one comparison.
 */
export async function sendWelcome(
  app: FastifyInstance,
  userId: string,
  name: string,
  handle: string,
): Promise<void> {
  const address = await emailFor(app.mongo.db, userId)
  if (!address?.verified) return
  const locale = await localeFor(app.mongo.db, userId)
  await app.email.send({ to: address.email, ...welcomeEmail(locale, { name, handle }) })
}
