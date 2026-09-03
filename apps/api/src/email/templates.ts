import { webUrl, type Locale } from '@langx/shared'
import { translator } from '../i18n'

/**
 * Plain HTML, no @react-email dependency — Resend's `react` option is only
 * needed if you hand it a component, and one extra rendering dependency buys
 * nothing for two short transactional emails.
 */
function wrap(locale: Locale, preheader: string, bodyHtml: string): string {
  const t = translator(locale)
  // `dir` matters more here than anywhere in the app: an email client has no
  // layout engine of ours to fall back on, and an Arabic paragraph laid out
  // left to right is unreadable rather than merely wrong.
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111; background: #f7f7f7; padding: 24px;">
    <span style="display:none">${preheader}</span>
    <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">LangX</h1>
      ${bodyHtml}
      <p style="color: #888; font-size: 12px; margin-top: 32px;">
        ${t('email.ignore')}
      </p>
    </div>
  </body>
</html>`
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block; background:#111; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">${label}</a>`
}

export interface Email {
  subject: string
  html: string
  text: string
}

/**
 * The shell for mail somebody *chose* to receive, as opposed to the two above,
 * which answer something they just did.
 *
 * The difference is the footer, and it is not decoration. A notification email
 * has to say why it arrived and how to stop it — the law's floor, and the
 * thing that keeps a mailbox provider delivering the rest. `wrap`'s footer
 * says "ignore this if you didn't ask for it", which is exactly wrong here:
 * they did ask, once, and want the way back out.
 */
export function notificationEmail(
  locale: Locale,
  options: {
    preheader: string
    bodyHtml: string
    cta?: { url: string; label: string }
    unsubscribeUrl: string
    manageUrl: string
  },
): { html: string } {
  const t = translator(locale)
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const cta = options.cta ? `<p>${button(options.cta.url, options.cta.label)}</p>` : ''
  return {
    html: `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111; background: #f7f7f7; padding: 24px;">
    <span style="display:none">${options.preheader}</span>
    <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">LangX</h1>
      ${options.bodyHtml}
      ${cta}
      <p style="color: #888; font-size: 12px; margin-top: 32px;">
        ${t('email.whyThisMail')}<br />
        <a href="${options.unsubscribeUrl}" style="color:#888;">${t('email.unsubscribeLink')}</a>
        &middot;
        <a href="${options.manageUrl}" style="color:#888;">${t('email.managePrefs')}</a>
      </p>
    </div>
  </body>
</html>`,
  }
}

/**
 * The plain-text half, which carries the unsubscribe URL in full.
 *
 * Not a nicety: a client that strips HTML would otherwise show mail with no
 * way out of it, and the way out is the part that has to survive.
 */
export function notificationText(locale: Locale, lines: string[], unsubscribeUrl: string): string {
  const t = translator(locale)
  return [...lines, '', t('email.unsubscribeText', { url: unsubscribeUrl })].join('\n')
}

export function verificationEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.verifySubject'),
    html: wrap(
      locale,
      t('email.verifyPreheader'),
      `<p>${t('email.verifyBody')}</p>
       <p>${button(url, t('email.verifyButton'))}</p>
       <p style="font-size: 12px; color: #888;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.verifyText', { url }),
  }
}

export function resetPasswordEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.resetSubject'),
    html: wrap(
      locale,
      t('email.resetPreheader'),
      `<p>${t('email.resetBody')}</p>
       <p>${button(url, t('email.resetButton'))}</p>
       <p style="font-size: 12px; color: #888;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.resetText', { url }),
  }
}

/**
 * The streak nudge, for somebody with no phone signed in.
 *
 * Deliberately the same two sentences as the push — `push.streakTitle` and
 * `push.streakBody`, not a second wording. One person may have a phone this
 * month and only the web the next, and a reminder that changes its voice
 * depending on how it arrived reads as two different features.
 */
export function streakReminderEmail(
  locale: Locale,
  { count, unsubscribe }: { count: number; unsubscribe: string },
): Email {
  const t = translator(locale)
  const title = t('push.streakTitle', { count })
  const body = t('push.streakBody')
  const cta = { url: webUrl('/chats'), label: t('email.openChats') }
  return {
    subject: title,
    html: notificationEmail(locale, {
      preheader: body,
      bodyHtml: `<p><strong>${title}</strong></p><p>${body}</p>`,
      cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(locale, [title, body, '', cta.url], unsubscribe),
  }
}

/**
 * "You have unread messages", naming who wrote and how many — and nothing
 * they said.
 *
 * That restriction is the design. The privacy sheet describes notification
 * mail as counts and display names; a line of somebody's message sitting in
 * Resend's logs, and in an inbox that may not be private, is a different
 * disclosure than the one anyone agreed to.
 */
export function unreadDigestEmail(
  locale: Locale,
  {
    count,
    names,
    moreThreads,
    url,
    unsubscribe,
  }: { count: number; names: string[]; moreThreads: number; url: string; unsubscribe: string },
): Email {
  const t = translator(locale)
  const subject = t('email.digestSubject', { count })
  // `Intl.ListFormat` because "Ada, Bo and Cy" is not "Ada, Bo, Cy" in most of
  // the eight languages, and joining with a comma is wrong in all of them.
  const joined = formatList(locale, names)
  const body = t('email.digestBody', { count, names: joined })
  const more = moreThreads > 0 ? t('email.digestMore', { count: moreThreads }) : ''
  const cta = { url, label: t('email.digestButton') }

  return {
    subject,
    html: notificationEmail(locale, {
      preheader: t('email.digestPreheader'),
      bodyHtml: `<p>${body}</p>${more ? `<p style="color:#888;">${more}</p>` : ''}`,
      cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(locale, [body, ...(more ? [more] : []), '', cta.url], unsubscribe),
  }
}

/** Falls back to a comma join where the runtime has no list formatter. */
function formatList(locale: Locale, items: string[]): string {
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

/**
 * "People looked at your profile this week."
 *
 * `names` is `null` for a free account — not empty, which would read as
 * nobody. The count is the free half of the feature and the names are the Pro
 * half, so this says how many either way and adds the line about upgrading
 * only when it has something to withhold.
 */
export function profileVisitsEmail(
  locale: Locale,
  { count, names, unsubscribe }: { count: number; names: string[] | null; unsubscribe: string },
): Email {
  const t = translator(locale)
  const subject = t('email.visitsSubject', { count })
  const body = t('email.visitsBody', { count })
  const detail =
    names && names.length > 0
      ? t('email.visitsNames', { names: formatList(locale, names) })
      : t('email.visitsLocked')
  const cta = { url: webUrl('/viewers'), label: t('email.visitsButton') }

  return {
    subject,
    html: notificationEmail(locale, {
      preheader: t('email.visitsPreheader'),
      bodyHtml: `<p>${body}</p><p style="color:#888;">${detail}</p>`,
      cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(locale, [body, detail, '', cta.url], unsubscribe),
  }
}

/**
 * "You earned a badge", for somebody with no phone signed in.
 *
 * `label` is the badge's own name and comes from the catalogue in English —
 * `BADGES` builds it from the threshold. So it is used only when exactly one
 * badge is new; several become a count, because five English labels inside an
 * Arabic sentence read worse than a number does.
 */
export function badgeEarnedEmail(
  locale: Locale,
  { count, label, unsubscribe }: { count: number; label: string | null; unsubscribe: string },
): Email {
  const t = translator(locale)
  const title = label
    ? t('email.badgeOneSubject', { label })
    : t('email.badgeManySubject', { count })
  const body = t('email.badgeBody')
  const cta = { url: webUrl('/me'), label: t('email.badgeButton') }

  return {
    subject: title,
    html: notificationEmail(locale, {
      preheader: title,
      bodyHtml: `<p><strong>${title}</strong></p><p>${body}</p>`,
      cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(locale, [title, body, '', cta.url], unsubscribe),
  }
}
