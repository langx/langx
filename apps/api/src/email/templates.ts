import { webUrl, type Locale } from '@langx/shared'
import { translator } from '../i18n'

/**
 * The site's display voice — `--font--title` in `website/src/lib/scss/_variables.scss`,
 * Nunito 800 for the logo and headings, 700 for buttons. The site self-hosts
 * it via `@fontsource`; mail pulls the same family from Google Fonts instead,
 * since there is no built asset to link to here. Gmail ignores web fonts
 * entirely and falls back to the stack that follows, so this only shows up
 * in Apple Mail, Outlook.com and the like — never a downgrade, just an
 * upgrade some clients don't take.
 */
const TITLE_FONT = "'Nunito', -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif"

/**
 * The langx.io mark, next to the wordmark set in the same weight the site
 * uses for it. An `<img>` pointing at the site's own favicon rather than the
 * inline SVG the header uses on `website/src/lib/components/atoms/Logo.svelte`
 * — Gmail strips `<svg>` from mail bodies outright, and drops `data:` image
 * sources too, so a hosted file is the only version that survives. The
 * favicon is square where the site's mark is tall, but it is the same two
 * hooks and it is already live, with no new asset to host.
 */
function logo(dir: 'ltr' | 'rtl'): string {
  const gap = dir === 'rtl' ? 'margin-left' : 'margin-right'
  return `<span style="font-family:${TITLE_FONT}; font-size:20px; font-weight:800; letter-spacing:-0.02em; color:#111827;">
    <img src="https://langx.io/favicons/favicon-32x32.png" width="20" height="20" alt="" style="vertical-align:middle; ${gap}:8px;" />LangX</span>`
}

/**
 * Plain HTML, no @react-email dependency — Resend's `react` option is only
 * needed if you hand it a component, and one extra rendering dependency buys
 * nothing for a handful of short transactional emails.
 *
 * Table-based rather than `<div>`s: Outlook's desktop renderer is Word, not a
 * browser, and a `<table>` is the one layout primitive it doesn't mangle. The
 * button colour is the same the app uses for its one committing action
 * (`primary`, #ffc409).
 */
function shell(locale: Locale, preheader: string, contentHtml: string, footerHtml: string): string {
  // `dir` matters more here than anywhere in the app: an email client has no
  // layout engine of ours to fall back on, and an Arabic paragraph laid out
  // left to right is unreadable rather than merely wrong.
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const align = dir === 'rtl' ? 'right' : 'left'
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap" />
  </head>
  <body style="margin:0; padding:32px 16px; background:#f4f5f7; font-family:-apple-system,'Segoe UI',Roboto,system-ui,sans-serif;">
    <span style="display:none; overflow:hidden; line-height:0; max-height:0; opacity:0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
      <tr>
        <td style="padding:0 4px 20px; text-align:${align};">
          ${logo(dir)}
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff; border:1px solid #e7e9ec; border-radius:16px; padding:32px; text-align:${align}; font-size:15px; line-height:1.6; color:#111827;">
          ${contentHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 4px 0; text-align:${align}; font-size:12px; line-height:1.6; color:#9aa1a9;">
          ${footerHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block; background:#ffc409; color:#201900; text-decoration:none; padding:13px 22px; border-radius:10px; font-family:${TITLE_FONT}; font-weight:700; font-size:15px;">${label}</a>`
}

/** The shell for mail answering something somebody just did — sign up, reset, delete. */
function wrap(locale: Locale, preheader: string, bodyHtml: string): string {
  const t = translator(locale)
  return shell(locale, preheader, bodyHtml, t('email.ignore'))
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
  const cta = options.cta
    ? `<p style="margin:20px 0 0;">${button(options.cta.url, options.cta.label)}</p>`
    : ''
  const footer = `${t('email.whyThisMail')}<br />
        <a href="${options.unsubscribeUrl}" style="color:#9aa1a9;">${t('email.unsubscribeLink')}</a>
        &middot;
        <a href="${options.manageUrl}" style="color:#9aa1a9;">${t('email.managePrefs')}</a>`
  return {
    html: shell(locale, options.preheader, `${options.bodyHtml}${cta}`, footer),
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
       <p style="font-size: 12px; color: #9aa1a9;">${t('email.orPaste', { url })}</p>`,
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
       <p style="font-size: 12px; color: #9aa1a9;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.resetText', { url }),
  }
}

/**
 * The one-tap way in. `url` is `magicLinkUrl(token)` — a page on the web
 * host, so a phone with the app opens the app and a mail scanner opens
 * nothing. The token works once and for a quarter of an hour; the body says
 * so, because a link that has stopped working with no explanation reads as
 * the app being broken.
 */
export function magicLinkEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.magicLinkSubject'),
    html: wrap(
      locale,
      t('email.magicLinkPreheader'),
      `<p>${t('email.magicLinkBody')}</p>
       <p>${button(url, t('email.magicLinkButton'))}</p>
       <p style="font-size: 12px; color: #9aa1a9;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.magicLinkText', { url }),
  }
}

/**
 * The confirmation for a deletion somebody asked for in the app.
 *
 * The link starts the existing 30-day grace period rather than wiping
 * anything: `DeletionBanner`, "Keep it" and the purge scheduler all still
 * apply, and the promise in `docs/legal/promise-change.md` stays true. What
 * the second step buys is that ending an account now needs the mailbox as well
 * as the session — a borrowed unlocked phone cannot do it, and neither can a
 * mis-tap.
 */
export function deleteAccountEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.deleteSubject'),
    html: wrap(
      locale,
      t('email.deletePreheader'),
      `<p>${t('email.deleteBody')}</p>
       <p>${button(url, t('email.deleteButton'))}</p>
       <p style="font-size: 12px; color: #9aa1a9;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.deleteText', { url }),
  }
}

/**
 * What a sign-up for an address that already has an account gets instead of
 * an error. Better Auth answers such a sign-up exactly as it answers a new one
 * — so the form cannot be used to learn which addresses are registered — and
 * this mail is the only channel left that can say "you already have an
 * account" to the one person entitled to hear it. The link is the app's own
 * forgot-password screen, not a token: this mail goes to an account that has a
 * password, and pointing at the screen that resets it asks for no more trust
 * than the person already gave. `existingAccountLinkEmail` is the version for
 * an account that has no password to reset.
 */
export function existingAccountEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.existingSubject'),
    html: wrap(
      locale,
      t('email.existingPreheader'),
      `<p>${t('email.existingBody')}</p>
       <p>${button(url, t('email.existingButton'))}</p>
       <p style="font-size: 12px; color: #9aa1a9;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.existingText', { url }),
  }
}

/**
 * The same news, for an account with no password behind it: a v1 row that
 * `legacyPrecreate.ts` opened. Its owner is being told to reset a password
 * that was never set, which is both odd to read and a longer walk than the
 * account needs — so this one carries a magic link and the sign-up ends where
 * it was trying to go.
 *
 * It grants something the mail above does not, and the difference is worth
 * being exact about: the grant goes to an *address*, not to whoever typed it
 * into the form. The link is single-use, expires in a quarter of an hour, and
 * lands only in the inbox entitled to it — the same bargain
 * `requestPasswordReset` already makes with anyone who types an address into
 * the forgot-password screen. What it must never become is a link in the mail
 * to an account that has a password: there, an unasked-for sign-in link is a
 * way past a credential somebody chose, and the reset screen is the answer.
 */
export function existingAccountLinkEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.existingSubject'),
    html: wrap(
      locale,
      t('email.existingPreheader'),
      `<p>${t('email.existingLinkBody')}</p>
       <p>${button(url, t('email.magicLinkButton'))}</p>
       <p style="font-size: 12px; color: #9aa1a9;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.existingLinkText', { url }),
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
      bodyHtml: `<p>${body}</p>${more ? `<p style="color:#9aa1a9;">${more}</p>` : ''}`,
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
      bodyHtml: `<p>${body}</p><p style="color:#9aa1a9;">${detail}</p>`,
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
