import { webUrl } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { publicApiUrl, unsubscribeSecret } from '../env'
import { localeFromHeader, translator } from '../i18n'
import { removeDeletedContact } from '../modules/notifications/v1DeletedContacts'
import { setEmailNotifications } from '../modules/profiles/profiles'
import {
  signUnsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from '../email/unsubscribeToken'
import type { Locale } from '@langx/shared'

/** Enough of a page to read on a phone, with no stylesheet to fetch. */
function page(locale: Locale, title: string, bodyHtml: string): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>LangX</title></head>
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111; background: #f7f7f7; margin: 0; padding: 24px;">
    <div style="max-width: 420px; margin: 48px auto; background: #fff; border-radius: 12px; padding: 32px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
    </div>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * The way out of every notification email, and the only route in this app that
 * acts for somebody holding no session.
 *
 * That is not a gap. An unsubscribe link is followed months after the app was
 * deleted, by someone who cannot sign in and should not have to — and RFC
 * 8058's one-click is a mail server, which has no way to sign in at all. The
 * signed token is the authority; see `unsubscribeToken.ts`.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const emailRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * One-click sends `application/x-www-form-urlencoded`, which Fastify rejects
   * with a 415 before any handler runs unless something can read it. Scoped to
   * this plugin and written with `URLSearchParams` rather than pulling in
   * `@fastify/formbody` for two routes that read at most one field.
   */
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(body as string)))
      } catch {
        done(null, {})
      }
    },
  )

  /**
   * Link previewers, spam scanners and "protect the click" proxies all follow
   * a GET before any human sees the message. So the GET only asks — the change
   * is on the POST below, which nothing follows by accident.
   */
  app.get('/email/unsubscribe', async (request, reply) => {
    const locale = localeFromHeader(request.headers['accept-language'])
    const t = translator(locale)
    const token = (request.query as { token?: string }).token
    const claim = verifyUnsubscribeToken(unsubscribeSecret(app.env), token)

    if (!claim) {
      return reply
        .code(400)
        .type('text/html; charset=utf-8')
        .send(page(locale, 'LangX', `<p>${t('email.unsubscribeInvalid')}</p>`))
    }

    const kind = t(`email.kind.${claim.scope}` as never)
    const allToken = signUnsubscribeToken(unsubscribeSecret(app.env), claim.userId, 'all')
    const allUrl = unsubscribeUrl(publicApiUrl(app.env), allToken)
    return reply.type('text/html; charset=utf-8').send(
      page(
        locale,
        t('email.unsubscribeTitle'),
        `<p>${escapeHtml(t('email.unsubscribeBody', { kind }))}</p>
         <form method="post" action="/email/unsubscribe?token=${encodeURIComponent(token ?? '')}">
           <button type="submit" style="background:#111;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;cursor:pointer;">
             ${escapeHtml(t('email.unsubscribeConfirm'))}
           </button>
         </form>
         ${claim.scope === 'all' ? '' : `<p style="margin-top:24px;"><a href="${allUrl}" style="color:#888;font-size:13px;">${escapeHtml(t('email.unsubscribeAll'))}</a></p>`}`,
      ),
    )
  })

  /**
   * The one-click target. A client honouring `List-Unsubscribe-Post` sends an
   * empty form body here, so the token that matters is the one in the URL —
   * the body is parsed only because a POST with a content-type Fastify cannot
   * read is a 415 before any handler runs.
   */
  app.post(
    '/email/unsubscribe',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const locale = localeFromHeader(request.headers['accept-language'])
      const t = translator(locale)
      const fromQuery = (request.query as { token?: string }).token
      const fromBody = (request.body as { token?: string } | undefined)?.token
      const claim = verifyUnsubscribeToken(unsubscribeSecret(app.env), fromQuery ?? fromBody)

      if (!claim) {
        return reply
          .code(400)
          .type('text/html; charset=utf-8')
          .send(page(locale, 'LangX', `<p>${t('email.unsubscribeInvalid')}</p>`))
      }

      // Idempotent on purpose: a mail client may retry, and a second press of
      // the button must not be an error page for something already done.
      if (claim.scope === 'v1contact') {
        // No account, so no preference to switch off: the address itself is
        // what goes. See `v1DeletedContacts.ts`.
        await removeDeletedContact(app.mongo.db, claim.userId)
      } else {
        await setEmailNotifications(app.mongo.db, claim.userId, claim.scope, false)
      }
      request.log.info({ scope: claim.scope }, 'unsubscribed from notification email')

      return reply.type('text/html; charset=utf-8').send(
        page(
          locale,
          t('email.unsubscribedTitle'),
          `<p>${escapeHtml(t('email.unsubscribedBody'))}</p>
         <p style="margin-top:24px;"><a href="${webUrl('/settings')}" style="color:#888;font-size:13px;">${escapeHtml(t('email.managePrefs'))}</a></p>`,
        ),
      )
    },
  )
}
