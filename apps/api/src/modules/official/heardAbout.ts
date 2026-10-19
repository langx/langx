import { HEARD_ABOUT_OPTIONS, HEARD_ABOUT_POLL_ID, type HeardAboutOption } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { translator, type ServerMessageKey } from '../../i18n'
import { fanOutMessage } from '../../ws/fanOut'
import { localeFor } from '../profiles/localeFor'
import { deliverOfficialMessage } from './deliver'

const LABEL_KEYS: Record<HeardAboutOption, ServerMessageKey> = {
  store: 'official.heardAbout.store',
  search: 'official.heardAbout.search',
  ai: 'official.heardAbout.ai',
  friend: 'official.heardAbout.friend',
  'tiktok-instagram': 'official.heardAbout.tiktokInstagram',
  youtube: 'official.heardAbout.youtube',
  'app-list': 'official.heardAbout.appList',
  other: 'official.heardAbout.other',
}

/**
 * "How did you hear about LangX?", as a poll from @langx, right under the
 * welcome.
 *
 * Its own message rather than chips on the welcome, because the welcome is
 * long and the chips belong under the question they answer. The body is the
 * question alone: a build that cannot draw a poll shows a question it cannot
 * answer, which is harmless, while writing the options into the body as well
 * would print them twice on every build that can.
 *
 * Never a push of its own. The welcome has just pushed, and two notifications
 * a second apart for one hello is the kind of thing people turn notifications
 * off over.
 *
 * Only for new accounts — `sendWelcomeBackMessage` does not call this. Someone
 * back from v1 already knows where they heard of us, and their answer would
 * only dilute the one we are asking for.
 */
export async function sendHeardAboutPoll(app: FastifyInstance, userId: string): Promise<void> {
  const locale = await localeFor(app.mongo.db, userId)
  const t = translator(locale)

  const delivered = await deliverOfficialMessage(app.mongo.db, {
    fromHandle: 'langx',
    toUserId: userId,
    body: t('official.heardAbout.question'),
    clientId: `heard-about:${userId}`,
    interactive: {
      kind: 'poll',
      pollId: HEARD_ABOUT_POLL_ID,
      options: HEARD_ABOUT_OPTIONS.map((id) => ({ id, label: t(LABEL_KEYS[id]) })),
    },
  })
  if (!delivered) return

  await fanOutMessage(app, app.io, delivered.conversation, delivered.message, {
    pushWhenAway: false,
  })
}
