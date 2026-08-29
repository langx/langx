import type { Locale } from '@langx/shared'
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
