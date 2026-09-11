import type { FastifyInstance } from 'fastify'
import { translator } from '../../i18n'
import { deviceIdentity } from '../security/deviceLabel'
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
/**
 * Which store this person could rate LangX in, read off the request that
 * finished their onboarding.
 *
 * The user agent rather than a registered device: a device row appears when
 * somebody agrees to notifications, which is later than this and may never
 * happen at all. `deviceIdentity` already tells the app's own traffic from a
 * browser's — see `deviceLabel.ts`, where the same question is asked for the
 * security mail.
 *
 * `null` for a browser, and the ask is simply left out. Asking somebody on the
 * web to rate an app they reach at a URL is asking for something they cannot
 * do, which is a worse first impression than not asking.
 */
function storeFor(userAgent: string | undefined): string | null {
  const { fingerprint } = deviceIdentity(userAgent)
  if (fingerprint === 'ios-app') return 'App Store'
  if (fingerprint === 'android-app') return 'Google Play'
  return null
}

export async function sendWelcomeMessage(
  app: FastifyInstance,
  userId: string,
  userAgent: string | undefined,
): Promise<void> {
  const locale = await localeFor(app.mongo.db, userId)
  const t = translator(locale)
  const store = storeFor(userAgent)

  const delivered = await deliverOfficialMessage(app.mongo.db, {
    fromHandle: 'langx',
    toUserId: userId,
    /*
     * Three parts, in this order: what LangX is, the store ask when there is a
     * store to ask about, and the sign-off last. The ask reads as a postscript
     * and the sign-off as the end, which is the wrong way round if they swap.
     */
    body: [
      t('official.welcome'),
      ...(store ? [t('official.welcomeRate', { store })] : []),
      t('official.welcomeClosing'),
    ].join('\n\n'),
    clientId: `welcome:${userId}`,
  })
  // No account, because a real user holds the handle. Onboarding is not the
  // place to find that out.
  if (!delivered) return

  await fanOutMessage(app, app.io, delivered.conversation, delivered.message, {
    pushWhenAway: true,
  })
}
