import type { FastifyInstance } from 'fastify'
import { translator } from '../../i18n'
import { fanOutMessage } from '../../ws/fanOut'
import { localeFor } from '../profiles/localeFor'
import { deliverOfficialMessage } from './deliver'

/**
 * The first thing in a new account's chat list: @langx, saying hello.
 *
 * A message rather than a screen, because it has to still be there tomorrow.
 * An onboarding card is read once and dismissed; this sits in the list beside
 * every other conversation, and the reply box under it is the point — "you can
 * write to me" is only true if writing back is the obvious next thing.
 *
 * `clientId` makes it exactly-once by index rather than by a flag, so a retry
 * of the request that triggered it cannot produce a second hello.
 */
export async function sendWelcomeMessage(app: FastifyInstance, userId: string): Promise<void> {
  const locale = await localeFor(app.mongo.db, userId)
  const t = translator(locale)

  const delivered = await deliverOfficialMessage(app.mongo.db, {
    fromHandle: 'langx',
    toUserId: userId,
    body: t('official.welcome'),
    clientId: `welcome:${userId}`,
  })
  // No account, because a real user holds the handle. Onboarding is not the
  // place to find that out.
  if (!delivered) return

  await fanOutMessage(app, app.io, delivered.conversation, delivered.message, {
    pushWhenAway: true,
  })
}
