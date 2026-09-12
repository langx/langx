import {
  postUrl,
  profileUrl,
  REPORTS_TO_FREEZE_XP,
  webUrl,
  type FeedbackKind,
  type Locale,
  type ReportReason,
} from '@langx/shared'
import { translator } from '../i18n'
import { facesRow, type AvatarFace } from './avatars'
import type { InlineAsset } from './inlineAssets'
import { inlineSrc, LOGO_SRC } from './logo'
import type { NewsletterNote } from './newsletters'
import type { MonthlyRecap } from '../modules/notifications/newsletter'
import type { FeedDigestItem } from '../modules/notifications/feedDigest'

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
 * uses for it. An `<img>` rather than the inline SVG the header uses on
 * `website/src/lib/components/atoms/Logo.svelte` — Gmail strips `<svg>` from
 * mail bodies outright, and drops `data:` image sources too. It pointed at a
 * hosted file for a while, and a hosted file is what Outlook and a
 * remote-content-off Apple Mail refuse to load; the bytes travel with the
 * mail now, see `inlineAssets.ts`.
 *
 * The same header row the campaign bodies in `apps/api/campaigns/` open
 * with, so a verification link and a broadcast read as one sender.
 */
function logo(dir: 'ltr' | 'rtl'): string {
  const gap = dir === 'rtl' ? 'padding-left' : 'padding-right'
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="${dir}">
            <tr>
              <td style="${gap}:12px;">
                <img src="${LOGO_SRC}" width="40" height="40" alt="LangX" border="0" style="display:block; width:40px; height:40px; border-radius:10px;" />
              </td>
              <td style="font-family:${TITLE_FONT}; font-size:22px; line-height:40px; font-weight:800; color:#17191c; letter-spacing:-0.02em;">LangX</td>
            </tr>
          </table>`
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f5f7;">
    <span style="display:none; overflow:hidden; line-height:0; max-height:0; opacity:0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f7" style="background-color:#f4f5f7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px; background-color:#ffffff; border-radius:16px;">
            <tr>
              <td style="padding:28px 32px 8px; text-align:${align};">
                ${logo(dir)}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 36px; text-align:${align}; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:25px; color:#17191c;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 36px;">
                ${getApp(locale, dir)}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px; border-top:1px solid #e8eaec; text-align:${align}; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px; color:#9aa1a7;">
                ${footerHtml}<br />
                LangX &middot; New Chapter Technology LLC &middot; Open source, no ads
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/**
 * The "get the app" panel every mail ends with — the campaign bodies' dark
 * one, with the QR travelling inline like the logo. On transactional mail
 * too, by request: a verification link is read on whichever device signed
 * up, which for the web is not the phone.
 */
function getApp(locale: Locale, dir: 'ltr' | 'rtl'): string {
  const t = translator(locale)
  const align = dir === 'rtl' ? 'right' : 'left'
  const textPad = dir === 'rtl' ? 'padding:24px 24px 24px 16px;' : 'padding:24px 16px 24px 24px;'
  const qrPad = dir === 'rtl' ? 'padding:24px 0 24px 24px;' : 'padding:24px 24px 24px 0;'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#17191c" dir="${dir}" style="background-color:#17191c; border-radius:16px;">
            <tr>
              <td valign="middle" style="${textPad} text-align:${align}; font-family:${TITLE_FONT}; font-size:20px; line-height:26px; font-weight:800; color:#f2f3f5;">
                ${t('email.getApp')}<br /><span style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; font-weight:400; color:#9aa1a9;">${t('email.getAppScan')} <a href="https://get.langx.io" target="_blank" style="color:#ffc409; text-decoration:none;">get.langx.io</a><br />${t('email.getAppPlatforms')}</span>
              </td>
              <td width="132" align="${dir === 'rtl' ? 'left' : 'right'}" valign="middle" style="${qrPad}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="#ffffff" style="background-color:#ffffff; border-radius:12px; padding:8px;">
                      <img src="${inlineSrc('langx-qr-get-langx-io')}" width="108" height="108" alt="QR code to get.langx.io" border="0" style="display:block; width:108px; height:108px;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`
}

/** The one button a mail has — the campaign bodies' yellow one, exactly. */
function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
            <tr>
              <td bgcolor="#ffc409" style="background-color:#ffc409; border-radius:12px; border-bottom:3px solid #e0ac08;">
                <a href="${url}" target="_blank" style="display:inline-block; padding:15px 28px; font-family:${TITLE_FONT}; font-size:16px; line-height:20px; font-weight:800; color:#201900; text-decoration:none;">${label}</a>
              </td>
            </tr>
          </table>`
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
  /**
   * Images this one mail carries that are not in `INLINE_ASSETS` — today only
   * the faces in the unread digest, which are per recipient and so cannot be
   * a build-time constant. Merged with the shared ones by the sender.
   */
  attachments?: InlineAsset[]
}

/**
 * One thing worth saying, on its way into the evening's single mail.
 *
 * Nothing here is a letter. A section is a heading, a paragraph or two and one
 * link, and the mail is however many of them the day produced — which is the
 * whole point of the rewrite: five senders that each used to post their own
 * envelope now hand their contents to one.
 *
 * `subject` and `preheader` belong to the section rather than to the mail
 * because the mail has no words of its own. The section that leads lends the
 * envelope its subject, and that is deliberately a real sentence about
 * something that happened — "3 unread messages" — rather than a
 * "Your day on LangX" that says nothing and gets opened accordingly.
 */
export interface DigestSection {
  /** The mail's subject, if this section leads it. */
  subject: string
  /** And its preheader. */
  preheader: string
  /** The section's own paragraphs. The heading is drawn by the composer. */
  html: string
  /** The same, as plain-text lines. */
  text: string[]
  /** Where this section's link goes. */
  cta: { url: string; label: string }
  /** Faces, for the two sections that carry any. */
  attachments?: InlineAsset[]
}

/** Between two sections. Light enough not to read as the end of the mail. */
const SECTION_RULE = '<hr style="border:none; border-top:1px solid #e8eaec; margin:28px 0 0;" />'

function sectionHeading(text: string): string {
  return `<p style="margin:20px 0 0;"><strong style="font-family:${TITLE_FONT}; font-size:18px; line-height:24px; color:#17191c;">${text}</strong></p>`
}

/**
 * The one notification email of the day.
 *
 * The lead section gets the button; every other one gets an inline link under
 * its own heading. One button rather than five is not a style choice — a mail
 * with five equal buttons has no primary action, and the lead section is by
 * construction the most urgent thing in it.
 *
 * The caller guarantees at least one section. An empty digest is not a mail
 * with nothing in it, it is a mail that must never be sent, and that decision
 * belongs where the sections are gathered rather than here.
 */
export function dailyDigestEmail(
  locale: Locale,
  { sections, unsubscribe }: { sections: DigestSection[]; unsubscribe: string },
): Email {
  const [lead, ...rest] = sections
  if (!lead) throw new Error('a digest with no sections must not be built')

  const bodyHtml = [
    sectionHeading(lead.subject),
    lead.html,
    ...rest.flatMap((section) => [
      SECTION_RULE,
      sectionHeading(section.subject),
      section.html,
      `<p style="margin:12px 0 0;"><a href="${section.cta.url}" style="color:#3b6cf6; text-decoration:none; font-weight:600;">${section.cta.label}</a></p>`,
    ]),
  ].join('\n      ')

  return {
    subject: lead.subject,
    html: notificationEmail(locale, {
      preheader: lead.preheader,
      bodyHtml,
      cta: lead.cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(
      locale,
      [
        lead.subject,
        ...lead.text,
        '',
        lead.cta.url,
        ...rest.flatMap((section) => ['', '—', section.subject, ...section.text, section.cta.url]),
      ],
      unsubscribe,
    ),
    attachments: sections.flatMap((section) => section.attachments ?? []),
  }
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
    /** Between the body and the button — the digest's row of faces. */
    extraHtml?: string
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
        <a href="${options.unsubscribeUrl}" style="color:#62676d; text-decoration:underline;">${t('email.unsubscribeLink')}</a>
        &nbsp;&middot;&nbsp;
        <a href="${options.manageUrl}" style="color:#62676d; text-decoration:underline;">${t('email.managePrefs')}</a>`
  return {
    html: shell(
      locale,
      options.preheader,
      `${options.bodyHtml}${options.extraHtml ?? ''}${cta}`,
      footer,
    ),
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
 * "Welcome to LangX", the moment onboarding finishes.
 *
 * Transactional, not a notification: it answers something somebody just did,
 * the way the verification mail does, and it goes once in an account's life.
 * `wrap`, therefore, and no unsubscribe — the mail carries no preference to
 * withdraw.
 *
 * Three lines of what to do next rather than a tour. The app is open on the
 * other screen; this is the copy somebody reads on the bus tomorrow.
 */
export function welcomeEmail(locale: Locale, input: { name: string; handle: string }): Email {
  const t = translator(locale)
  const url = webUrl('/discover')
  const steps = [t('email.welcomeStep1'), t('email.welcomeStep2'), t('email.welcomeStep3')]
  /*
   * The handle is the link, `@` included — which is why the catalogue says
   * `{handle}` rather than `@{handle}`: a link that starts one character
   * after the thing it points at is a smaller target and reads as a typo.
   * The text half gets the address written out instead, since a plain-text
   * mail cannot hide a URL behind a word.
   */
  const profile = profileUrl(input.handle)
  const handleLink = `<a href="${encodeURI(profile)}" style="color:#3b6cf6; text-decoration:underline;">@${escapeHtml(input.handle)}</a>`
  return {
    subject: t('email.welcomeSubject'),
    html: wrap(
      locale,
      t('email.welcomePreheader'),
      `<p><strong style="font-family:${TITLE_FONT}; font-size:20px; line-height:26px;">${t('email.welcomeTitle', { name: escapeHtml(input.name) })}</strong></p>
       <p>${t('email.welcomeBody', { handle: handleLink })}</p>
       <ul style="margin:20px 0 0; padding-left:20px; color:#17191c;">
         ${steps.map((step) => `<li style="margin-bottom:8px;">${step}</li>`).join('\n         ')}
       </ul>
       <p style="margin:24px 0 0;">${button(url, t('email.welcomeButton'))}</p>`,
    ),
    text: [
      t('email.welcomeTitle', { name: input.name }),
      '',
      t('email.welcomeBody', { handle: `@${input.handle}` }),
      profile,
      '',
      ...steps.map((step) => `- ${step}`),
      '',
      url,
    ].join('\n'),
  }
}

/**
 * "You still need to confirm your address", a day after signing up.
 *
 * The same link as the first mail, because it is the same job — and the
 * first one is the mail most likely to have landed in a spam folder, since
 * it arrives before this domain has ever written to that address before.
 */
export function verifyReminderEmail(url: string, locale: Locale): Email {
  const t = translator(locale)
  return {
    subject: t('email.verifyReminderSubject'),
    html: wrap(
      locale,
      t('email.verifyReminderPreheader'),
      `<p>${t('email.verifyReminderBody')}</p>
       <p>${button(url, t('email.verifyButton'))}</p>
       <p style="font-size: 12px; color: #62676d;">${t('email.orPaste', { url })}</p>`,
    ),
    text: t('email.verifyReminderText', { url }),
  }
}

/**
 * The two things billing says out loud: a payment that failed, and a plan
 * that has ended.
 *
 * Transactional for the same reason the bounty receipt is — this is money,
 * and "do not tell me my payment failed" is not a preference worth offering.
 * A renewal that succeeds says nothing: the store already mails a receipt,
 * and a second one from us is the noise that gets a sender filtered.
 */
export function billingEmail(
  locale: Locale,
  event: 'paymentFailed' | 'planEnded',
  input: { tier: string },
): Email {
  const t = translator(locale)
  const url = webUrl('/settings/plan')
  const title = t(`email.billing.${event}Title` as never)
  return {
    subject: title,
    html: wrap(
      locale,
      t(`email.billing.${event}Body` as never),
      `<p><strong style="font-family:${TITLE_FONT}; font-size:20px; line-height:26px;">${title}</strong></p>
       <p>${t(`email.billing.${event}Body` as never)}</p>
       <p style="color:#62676d;">${t('email.billingPlan', { tier: escapeHtml(input.tier) })}</p>
       <p style="margin:24px 0 0;">${button(url, t(`email.billing.${event}Button` as never))}</p>`,
    ),
    text: [title, '', t(`email.billing.${event}Body` as never), '', url].join('\n'),
  }
}

/**
 * "Your month on LangX": four numbers that are yours, three that are
 * everybody's, and whatever shipped.
 *
 * The two halves are deliberate. A personal recap alone is thin in a quiet
 * month and reads as an accusation; the community numbers say the place is
 * alive whether or not the reader was there, which is the argument for coming
 * back. A **quiet month** swaps the personal half for one sentence rather
 * than printing three zeroes at somebody.
 *
 * The editorial block is optional and comes from `email/newsletters/` —
 * written by a routine, reviewed as a pull request, merged. No note, no
 * block; the numbers are the part that is always true.
 */
export function newsletterEmail(
  locale: Locale,
  recap: MonthlyRecap,
  note: NewsletterNote | null,
  unsubscribe: string,
): Email {
  const t = translator(locale)
  const monthName = monthLabel(locale, recap.month)
  const subject = t('email.newsletterSubject', { month: monthName })

  const stat = (label: string, value: number): string =>
    `<tr><td style="padding:6px 16px 6px 0; font-size:15px; line-height:23px; color:#62676d;">${label}</td><td style="padding:6px 0; font-size:15px; line-height:23px; color:#17191c;"><strong>${value.toLocaleString(locale)}</strong></td></tr>`

  const yours = recap.quiet
    ? `<p style="color:#62676d;">${t('email.newsletterQuiet')}</p>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;">
        ${[
          stat(t('email.newsletterMessages'), recap.personal.messages),
          stat(t('email.newsletterCorrections'), recap.personal.corrections),
          stat(t('email.newsletterTokens'), recap.personal.tokens),
          stat(t('email.newsletterStreak'), recap.personal.streak),
        ].join('\n        ')}
      </table>`

  const everybody = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0;">
        ${[
          stat(t('email.newsletterNewMembers'), recap.community.members),
          stat(t('email.newsletterMessagesSent'), recap.community.messages),
          stat(t('email.newsletterCorrectionsMade'), recap.community.corrections),
        ].join('\n        ')}
      </table>`

  const editorial = note
    ? `<h2 style="font-family:${TITLE_FONT}; font-size:18px; line-height:24px; font-weight:800; color:#17191c; margin:32px 0 0;">${escapeHtml(note.headline)}</h2>
       ${note.items
         .map(
           (item) =>
             `<p style="margin:12px 0 0;"><strong>${escapeHtml(item.title)}</strong><br /><span style="color:#62676d;">${escapeHtml(item.body)}</span></p>`,
         )
         .join('\n       ')}
       ${note.note ? `<p style="margin:16px 0 0; color:#62676d;">${escapeHtml(note.note)}</p>` : ''}`
    : ''

  const cta = { url: webUrl('/discover'), label: t('email.newsletterButton') }
  return {
    subject,
    html: notificationEmail(locale, {
      preheader: t('email.newsletterPreheader'),
      bodyHtml: `<p><strong style="font-family:${TITLE_FONT}; font-size:20px; line-height:26px;">${subject}</strong></p>
       <h2 style="font-family:${TITLE_FONT}; font-size:18px; line-height:24px; font-weight:800; color:#17191c; margin:24px 0 0;">${t('email.newsletterYours')}</h2>
       ${yours}
       <h2 style="font-family:${TITLE_FONT}; font-size:18px; line-height:24px; font-weight:800; color:#17191c; margin:32px 0 0;">${t('email.newsletterEverybody')}</h2>
       ${everybody}
       ${editorial}`,
      cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(
      locale,
      [
        subject,
        '',
        t('email.newsletterYours'),
        ...(recap.quiet
          ? [t('email.newsletterQuiet')]
          : [
              `${t('email.newsletterMessages')}: ${recap.personal.messages}`,
              `${t('email.newsletterCorrections')}: ${recap.personal.corrections}`,
              `${t('email.newsletterTokens')}: ${recap.personal.tokens}`,
              `${t('email.newsletterStreak')}: ${recap.personal.streak}`,
            ]),
        '',
        t('email.newsletterEverybody'),
        `${t('email.newsletterNewMembers')}: ${recap.community.members}`,
        `${t('email.newsletterMessagesSent')}: ${recap.community.messages}`,
        `${t('email.newsletterCorrectionsMade')}: ${recap.community.corrections}`,
        ...(note
          ? [
              '',
              note.headline,
              ...note.items.map((item) => `- ${item.title}: ${item.body}`),
              ...(note.note ? [note.note] : []),
            ]
          : []),
        '',
        cta.url,
      ],
      unsubscribe,
    ),
  }
}

/** "September 2026", in the reader's language, falling back to the key. */
function monthLabel(locale: Locale, month: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${month}-01T00:00:00Z`))
  } catch {
    return month
  }
}

/**
 * The day's replies to somebody's posts, in one letter.
 *
 * Counts and the opening words of their own sentence — never the correction
 * itself. The same rule the unread digest follows, for a different reason:
 * there the text is somebody else's private message, here it is the thing
 * the reader is being asked to come and read. A mail that already contains
 * the answer is a mail nobody clicks, and the correction is worth seeing
 * beside the sentence it corrects.
 */
export function feedDigestSection(
  locale: Locale,
  { items, morePosts }: { items: FeedDigestItem[]; morePosts: number },
): DigestSection {
  const t = translator(locale)
  const total = items.reduce(
    (sum, item) => sum + item.corrections + item.answers + item.comments,
    0,
  )
  const subject = t('email.feedDigestSubject', { count: total })
  const rows = items
    .map((item) => {
      const parts = [
        item.corrections > 0 ? t('email.feedDigestCorrections', { count: item.corrections }) : '',
        item.answers > 0 ? t('email.feedDigestAnswers', { count: item.answers }) : '',
        item.comments > 0 ? t('email.feedDigestComments', { count: item.comments }) : '',
      ].filter(Boolean)
      return `<p style="margin:16px 0 0;"><a href="${postUrl(item.postId)}" style="color:#17191c; text-decoration:none;"><strong>&ldquo;${escapeHtml(item.excerpt)}&rdquo;</strong></a><br /><span style="color:#62676d;">${formatList(locale, parts)}</span></p>`
    })
    .join('\n       ')
  const more = morePosts > 0 ? t('email.feedDigestMore', { count: morePosts }) : ''

  return {
    subject,
    preheader: t('email.feedDigestPreheader'),
    html: `<p>${t('email.feedDigestBody', { count: total })}</p>
       ${rows}
       ${more ? `<p style="margin:16px 0 0; color:#62676d;">${more}</p>` : ''}`,
    text: [
      t('email.feedDigestBody', { count: total }),
      '',
      ...items.map((item) => `"${item.excerpt}" — ${postUrl(item.postId)}`),
      ...(more ? ['', more] : []),
    ],
    cta: { url: webUrl('/me'), label: t('email.feedDigestButton') },
  }
}

/** The six nudges `modules/notifications/promotions.ts` offers, in its order. */
export type PromotionScenario =
  | 'addPhoto'
  | 'streakBroke'
  | 'away'
  | 'awayLong'
  | 'trialEnding'
  | 'limitReached'
  | 'winBack'
  | 'tokensWaiting'
  | 'inviteFriend'

/**
 * One nudge, worded from the catalogue rather than assembled here.
 *
 * `notificationEmail`, so it carries the footer that says why it arrived and
 * how to stop — which for this class of mail is not a nicety but the thing
 * that keeps a mailbox provider delivering the verification links.
 *
 * The scenario decides the strings *and* the destination; a nudge whose
 * button goes somewhere unrelated to its sentence is the kind that gets
 * marked as spam by somebody who meant to act on it.
 */
export function promotionEmail(
  locale: Locale,
  scenario: PromotionScenario,
  input: { count?: number; unsubscribe: string },
): Email {
  const t = translator(locale)
  const params = input.count === undefined ? {} : { count: input.count }
  const subject = t(`email.promo.${scenario}Subject` as never, params)
  const body = t(`email.promo.${scenario}Body` as never, params)
  const cta = {
    url: PROMOTION_DESTINATIONS[scenario],
    label: t(`email.promo.${scenario}Button` as never),
  }
  return {
    subject,
    html: notificationEmail(locale, {
      preheader: body,
      bodyHtml: `<p><strong style="font-family:${TITLE_FONT}; font-size:20px; line-height:26px;">${subject}</strong></p><p>${body}</p>`,
      cta,
      unsubscribeUrl: input.unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(locale, [subject, '', body, '', cta.url], input.unsubscribe),
  }
}

/**
 * Where each nudge lands. Beside the copy rather than beside the trigger,
 * because the sentence and the button have to agree and they are written
 * together.
 */
const PROMOTION_DESTINATIONS: Record<PromotionScenario, string> = {
  addPhoto: webUrl('/me/edit'),
  streakBroke: webUrl('/wallet'),
  away: webUrl('/discover'),
  awayLong: webUrl('/discover'),
  trialEnding: webUrl('/settings/plan'),
  limitReached: webUrl('/settings/plan'),
  winBack: webUrl('/settings/plan'),
  tokensWaiting: webUrl('/wallet'),
  inviteFriend: webUrl('/settings/share'),
}

/** The four things this app tells somebody about their own account. */
export type SecurityEvent = 'newSignIn' | 'passwordChanged' | 'methodLinked' | 'methodUnlinked'

/**
 * A security notice: a new device, a changed password, a sign-in method
 * connected or disconnected.
 *
 * `wrap`, not `notificationEmail`, and the difference is the whole point. A
 * notification mail's footer says how to stop it arriving; this one has no
 * way to stop, because there is no switch behind it — see
 * `modules/security/notify.ts`. What it carries instead is the detail
 * somebody needs to recognise their own action, and one button for when they
 * do not.
 *
 * The time is written in UTC and says so. Guessing a timezone from an IP is
 * how a mail tells somebody in Toronto that they signed in at 09:00 when
 * their clock said 04:00, and the reader is checking this line against their
 * memory of the last ten minutes.
 */
export function securityEmail(
  locale: Locale,
  event: SecurityEvent,
  detail: { device?: string; place?: string; at: Date },
): Email {
  const t = translator(locale)
  const when = `${detail.at.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  const rows: [string, string][] = [
    ...(detail.device ? ([[t('email.securityDevice'), detail.device]] as [string, string][]) : []),
    ...(detail.place ? ([[t('email.securityPlace'), detail.place]] as [string, string][]) : []),
    [t('email.securityWhen'), when],
  ]
  const table = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
        ${rows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:4px 16px 4px 0; font-size:14px; line-height:22px; color:#62676d;">${label}</td><td style="padding:4px 0; font-size:14px; line-height:22px; color:#17191c;"><strong>${escapeHtml(value)}</strong></td></tr>`,
          )
          .join('\n        ')}
      </table>`

  const title = t(`email.security.${event}Title` as never)
  const body = t(`email.security.${event}Body` as never)
  const url = webUrl('/settings/password')
  return {
    subject: title,
    html: wrap(
      locale,
      body,
      `<p><strong style="font-family:${TITLE_FONT}; font-size:20px; line-height:26px;">${title}</strong></p>
       <p>${body}</p>
       ${table}
       <p style="margin:24px 0 0;">${t('email.securityNotYou')}</p>
       <p>${button(url, t('email.securityButton'))}</p>`,
    ),
    text: [
      title,
      '',
      body,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      t('email.securityNotYou'),
      url,
    ].join('\n'),
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
export function streakReminderSection(locale: Locale, { count }: { count: number }): DigestSection {
  const t = translator(locale)
  const title = t('push.streakTitle', { count })
  const body = t('push.streakBody')
  return {
    subject: title,
    preheader: body,
    html: `<p>${body}</p>`,
    text: [body],
    cta: { url: webUrl('/chats'), label: t('email.openChats') },
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
export function unreadDigestSection(
  locale: Locale,
  {
    count,
    faces,
    moreThreads,
    url,
  }: {
    count: number
    /** Who wrote, in the order the threads came back. */
    faces: AvatarFace[]
    moreThreads: number
    url: string
  },
): DigestSection {
  const t = translator(locale)
  // `Intl.ListFormat` because "Ada, Bo and Cy" is not "Ada, Bo, Cy" in most of
  // the eight languages, and joining with a comma is wrong in all of them.
  const joined = formatList(
    locale,
    faces.map((face) => face.name),
  )
  const body = t('email.digestBody', { count, names: joined })
  const more = moreThreads > 0 ? t('email.digestMore', { count: moreThreads }) : ''

  return {
    subject: t('email.digestSubject', { count }),
    preheader: t('email.digestPreheader'),
    // The faces stand in for the "and N more" sentence rather than repeating
    // it: a grey +N disc says the same thing in less room.
    html: `<p>${body}</p>${facesRow(faces, moreThreads, locale === 'ar' ? 'rtl' : 'ltr')}`,
    text: [body, ...(more ? [more] : [])],
    cta: { url, label: t('email.digestButton') },
    attachments: faces.flatMap((face) => (face.asset ? [face.asset] : [])),
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
 * "People you could practise with" — the same faces the digest draws, for
 * people the reader has never met rather than ones who wrote to them.
 *
 * Names and photos only, and nothing about why each one was picked. The
 * matching is mutual language fit and the body says so in general terms; a
 * line reading "she is learning your native language at B1" would be a
 * profile field sent to somebody who never opened that profile, which is a
 * different disclosure than the one a discoverable account agreed to.
 */
export function matchSuggestionsSection(
  locale: Locale,
  {
    faces,
    more,
  }: {
    /** Who to show, already ordered by fit. */
    faces: AvatarFace[]
    /** How many further matches there were, for the grey disc. */
    more: number
  },
): DigestSection {
  const t = translator(locale)
  const body = t('email.matchesBody', {
    names: formatList(
      locale,
      faces.map((face) => face.name),
    ),
  })

  return {
    subject: t('email.matchesSubject'),
    preheader: t('email.matchesPreheader'),
    html: `<p>${body}</p>${facesRow(faces, more, locale === 'ar' ? 'rtl' : 'ltr')}`,
    text: [body],
    cta: { url: webUrl('/discover'), label: t('email.matchesButton') },
    attachments: faces.flatMap((face) => (face.asset ? [face.asset] : [])),
  }
}

/**
 * "Yesterday's pool paid you N tokens", which used to be a push and nothing
 * else.
 *
 * It is still not worth a letter of its own — a mail whose entire content is a
 * number going up is how a sending domain gets filtered — but it is worth a
 * paragraph in one that was going out anyway, because the pool is the part of
 * the wallet nobody can see happening.
 */
export function walletPoolSection(locale: Locale, { count }: { count: number }): DigestSection {
  const t = translator(locale)
  const title = t('push.wallet.poolTitle', { count })
  const body = t('email.walletBody')

  return {
    subject: title,
    preheader: title,
    html: `<p>${body}</p>`,
    text: [body],
    cta: { url: webUrl('/wallet'), label: t('email.walletButton') },
  }
}

/** One call in the diary: when it starts, on the reader's clock, and with whom. */
export interface DigestMeeting {
  /** Already formatted in the reader's zone — this file has no clock. */
  time: string
  name: string
  conversationId: string
}

/**
 * "Tomorrow you have a call with Ada at 18:00."
 *
 * Not the hour-before reminder, which stays a push: an email an hour before a
 * call is either too late to read or a copy of the buzz that already worked.
 * This answers the question an hour's notice cannot — what is in the diary
 * tomorrow — which is the only form of this the evening mail can honestly
 * carry.
 */
export function meetingsSection(
  locale: Locale,
  { meetings }: { meetings: DigestMeeting[] },
): DigestSection {
  const t = translator(locale)
  const title = t('email.meetingsSubject', { count: meetings.length })
  const rows = meetings
    .map(
      (meeting) =>
        `<p style="margin:12px 0 0;"><a href="${webUrl(`/chat/${meeting.conversationId}`)}" style="color:#17191c; text-decoration:none;"><strong>${escapeHtml(meeting.time)}</strong> &nbsp;${escapeHtml(meeting.name)}</a></p>`,
    )
    .join('\n       ')

  return {
    subject: title,
    preheader: t('email.meetingsPreheader'),
    html: `<p>${t('email.meetingsBody', { count: meetings.length })}</p>\n       ${rows}`,
    text: [
      t('email.meetingsBody', { count: meetings.length }),
      '',
      ...meetings.map((meeting) => `${meeting.time} ${meeting.name}`),
    ],
    cta: { url: webUrl('/chats'), label: t('email.meetingsButton') },
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
export function profileVisitsSection(
  locale: Locale,
  { count, names }: { count: number; names: string[] | null },
): DigestSection {
  const t = translator(locale)
  const body = t('email.visitsBody', { count })
  const detail =
    names && names.length > 0
      ? t('email.visitsNames', { names: formatList(locale, names) })
      : t('email.visitsLocked')

  return {
    subject: t('email.visitsSubject', { count }),
    preheader: t('email.visitsPreheader'),
    html: `<p>${body}</p><p style="color:#62676d;">${detail}</p>`,
    text: [body, detail],
    cta: { url: webUrl('/viewers'), label: t('email.visitsButton') },
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
export function badgeEarnedSection(
  locale: Locale,
  { count, label }: { count: number; label: string | null },
): DigestSection {
  const t = translator(locale)
  const title = label
    ? t('email.badgeOneSubject', { label })
    : t('email.badgeManySubject', { count })
  const body = t('email.badgeBody')

  return {
    subject: title,
    preheader: title,
    html: `<p>${body}</p>`,
    text: [body],
    cta: { url: webUrl('/me'), label: t('email.badgeButton') },
  }
}

/**
 * The receipt for a report that turned out to be worth paying for.
 *
 * Sent whether or not the person has notification email switched on, and this
 * is the one place in the file that says so: it is a receipt for tokens that
 * have already landed in their wallet, the same kind of mail as the
 * account-deletion confirmation, not a nudge they can be tired of. So it goes
 * out through `app.email.send` rather than `sendNotificationEmail`, and
 * carries no unsubscribe footer — there is nothing here to unsubscribe from.
 *
 * `shell` directly rather than `wrap`, because `wrap`'s footer says to ignore
 * the mail if you did not ask for it, which is the wrong sentence under a
 * payment somebody earned.
 */
export function bountyPaidEmail(locale: Locale, input: { amount: number; url: string }): Email {
  const t = translator(locale)
  const count = input.amount
  return {
    subject: t('email.bountySubject', { count }),
    html: shell(
      locale,
      t('email.bountyPreheader'),
      `<p>${t('email.bountyBody', { count })}</p>
       <p>${button(encodeURI(input.url), t('email.bountyButton'))}</p>`,
      '',
    ),
    text: t('email.bountyText', { count, url: input.url }),
  }
}

/** User-typed text goes into an HTML body, so it is escaped before it does. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * A bug report or a feature request, on its way to `SUPPORT_EMAIL`.
 *
 * The one email in this file with no locale. Every other one is read by the
 * person it is about; this one is read by us, and the repo is English.
 *
 * It is also where the whole thing is decided: nothing is stored, so this mail
 * is the report. `Reply-To` is set to the sender by the route, the issue link
 * is where the work is tracked, and the award link is where they are paid.
 */
export function feedbackEmail(input: {
  kind: FeedbackKind
  body: string
  /** Public URLs of whatever was attached as proof, already in our own bucket. */
  attachmentUrls: readonly string[]
  sender: { userId: string; handle: string | null; email: string | null }
  /** Where the reward is decided and sent — see `bountyToken.ts`. */
  awardUrl: string
  /** GitHub's own new-issue form, prefilled — see `githubIssue.ts`. */
  newIssueUrl: string
}): Email {
  const who = input.sender.handle ? `@${input.sender.handle}` : input.sender.userId
  const subject = `${input.kind === 'bug' ? 'Bug report' : 'Feature request'} from ${who}`
  const from = [
    `From: ${who}`,
    `User id: ${input.sender.userId}`,
    ...(input.sender.email ? [`Email: ${input.sender.email}`] : []),
  ]

  const links = input.attachmentUrls.map(
    (url) => `<li><a href="${encodeURI(url)}">${escapeHtml(url)}</a></li>`,
  )
  // Already percent-encoded, so `encodeURI` would double-encode it; the
  // ampersands between the query fields are what needs escaping in an href.
  const issueLine = `<p>${button(escapeHtml(input.newIssueUrl), 'Open this as a GitHub issue')}</p>
    <p style="color: #888; font-size: 12px;">Opens GitHub's own form with the title, body and label already in it. Nothing is posted until you press Submit, and you can edit it first.</p>`

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111;">
    <h1 style="font-size: 18px;">${escapeHtml(subject)}</h1>
    <p style="white-space: pre-wrap;">${escapeHtml(input.body)}</p>
    ${links.length ? `<p><strong>Proof</strong></p><ul>${links.join('')}</ul>` : ''}
    ${issueLine}
    <p>${button(encodeURI(input.awardUrl), 'Confirm and set the reward')}</p>
    <p style="color: #888; font-size: 12px;">Opens a page where you set the amount and pay the sender. One payment per report.</p>
    <p style="color: #888; font-size: 12px;">${from.map(escapeHtml).join('<br />')}</p>
  </body>
</html>`,
    text: [
      input.body,
      '',
      ...input.attachmentUrls,
      '',
      `Open this as a GitHub issue: ${input.newIssueUrl}`,
      `Confirm and set the reward: ${input.awardUrl}`,
      '',
      ...from,
    ].join('\n'),
  }
}
/** Either party to a report, as much of them as the profile row has. */
interface ReportedParty {
  userId: string
  handle: string | null
  displayName: string | null
}

function partyName(party: ReportedParty): string {
  return party.handle ? `@${party.handle}` : party.userId
}

function partyHtml(role: string, party: ReportedParty): string {
  const lines = [
    ...(party.displayName ? [escapeHtml(party.displayName)] : []),
    party.handle
      ? `<a href="${encodeURI(profileUrl(party.handle))}">@${escapeHtml(party.handle)}</a>`
      : '<em>no handle — never finished onboarding, or the profile is gone</em>',
    `<code>${escapeHtml(party.userId)}</code>`,
  ]
  return `<p><strong>${role}</strong><br />${lines.join('<br />')}</p>`
}

function partyText(role: string, party: ReportedParty): string[] {
  return [
    `${role}: ${partyName(party)}${party.displayName ? ` (${party.displayName})` : ''}`,
    `  user id: ${party.userId}`,
    ...(party.handle ? [`  profile: ${profileUrl(party.handle)}`] : []),
  ]
}

/**
 * A report about somebody, on its way to `SUPPORT_EMAIL`.
 *
 * The second email here with no locale, for `feedbackEmail`'s reason: we are
 * the ones who read it.
 *
 * It exists because `reports` had no reader. The row was written, three
 * distinct reporters could freeze somebody's earning, and nobody was told any
 * of it — a report of harassment sat in a collection until someone thought to
 * look. The moderation console is still ahead of us; this is what stands in
 * for it, and it carries enough to judge a report without opening the
 * database.
 *
 * **The freeze is named here and nowhere else.** `POST /reports` deliberately
 * does not echo it to the reporter, because whether someone else's earning is
 * suspended is not their business and telling them turns the threshold into a
 * game to probe. Telling *us* is the entire point.
 */
export function reportEmail(input: {
  reportId: string
  reason: ReportReason
  details: string | null
  reporter: ReportedParty
  reported: ReportedParty
  /** True only when this report is the one that crossed the threshold. */
  xpFrozen: boolean
  context: { conversationId: string | null; messageId: string | null; postId: string | null }
  /**
   * The reported post's own words, when it was raised from one.
   *
   * Worth the extra read the route makes for it: the alternative is a link
   * that has to be opened, on an account that can see the post, before anyone
   * knows whether the report is serious. Most of them can be judged from the
   * sentence alone.
   */
  postBody: string | null
  /** The signed link that decides this report — see `reviewToken.ts`. */
  reviewUrl: string
}): Email {
  // The enum values are already English words; a lookup table beside them
  // would be one more thing to forget when a reason is added.
  const reason = input.reason.replace(/_/g, ' ')
  const subject = `${input.xpFrozen ? '[XP FROZEN] ' : ''}Report: ${reason} — ${partyName(
    input.reporter,
  )} on ${partyName(input.reported)}`

  const frozenLine = input.xpFrozen
    ? `<p style="background:#fff3cd; padding:12px; border-radius:8px;"><strong>Token earning is now frozen on the reported account.</strong> ${REPORTS_TO_FREEZE_XP} distinct reporters have an open report against them. Messages still send and their activity is still counted, so clearing this can be reconciled.</p>`
    : ''

  /*
   * A conversation and a message are ids, not links: `/chat/<id>` opens only
   * for the two people in it, so a link would send whoever reads this to a
   * 404. A post is public, so that one is a link.
   */
  const pointers = [
    input.context.conversationId
      ? `<li>Conversation <code>${escapeHtml(input.context.conversationId)}</code></li>`
      : '',
    input.context.messageId
      ? `<li>Message <code>${escapeHtml(input.context.messageId)}</code></li>`
      : '',
    input.context.postId
      ? `<li>Post <a href="${encodeURI(postUrl(input.context.postId))}">${escapeHtml(
          input.context.postId,
        )}</a></li>`
      : '',
  ].filter(Boolean)

  const details = input.details
    ? `<p style="white-space: pre-wrap;">${escapeHtml(input.details)}</p>`
    : '<p style="color: #888;">No details were given.</p>'

  const quoted = input.postBody
    ? `<p style="margin:16px 0 8px;"><strong>The post</strong></p><blockquote style="white-space:pre-wrap;border-left:3px solid #ddd;margin:0 0 16px;padding:0 0 0 12px;color:#333;">${escapeHtml(input.postBody)}</blockquote>`
    : ''

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111;">
    <h1 style="font-size: 18px;">${escapeHtml(subject)}</h1>
    ${frozenLine}
    <p><strong>Reason</strong> ${escapeHtml(reason)}</p>
    ${details}
    ${quoted}
    ${partyHtml('Reported', input.reported)}
    ${partyHtml('Reporter', input.reporter)}
    ${pointers.length ? `<p><strong>Raised from</strong></p><ul>${pointers.join('')}</ul>` : ''}
    <p style="margin:24px 0 8px;"><a href="${encodeURI(input.reviewUrl)}" style="display:inline-block;background:#111;color:#fff;border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;text-decoration:none;">Review this report</a></p>
    <p style="color: #888; font-size: 12px;">Report ${escapeHtml(
      input.reportId,
    )}, stored in <code>reports</code> with status <code>open</code>. Nothing changes until somebody decides on that page.</p>
  </body>
</html>`,
    text: [
      subject,
      '',
      ...(input.xpFrozen
        ? [
            `Token earning is now frozen on the reported account (${REPORTS_TO_FREEZE_XP} distinct reporters).`,
            '',
          ]
        : []),
      `Reason: ${reason}`,
      '',
      input.details ?? 'No details were given.',
      '',
      ...(input.postBody ? ['The post:', input.postBody, ''] : []),
      ...partyText('Reported', input.reported),
      ...partyText('Reporter', input.reporter),
      '',
      ...(input.context.conversationId ? [`Conversation: ${input.context.conversationId}`] : []),
      ...(input.context.messageId ? [`Message: ${input.context.messageId}`] : []),
      ...(input.context.postId ? [`Post: ${postUrl(input.context.postId)}`] : []),
      '',
      `Review: ${input.reviewUrl}`,
      '',
      `Report ${input.reportId} — reports collection, status open.`,
    ].join('\n'),
  }
}

/**
 * `hate_speech` → `hateSpeech`, which is how the catalogue keys them.
 *
 * The enum values are snake_case because they are stored; a lookup table
 * beside `REPORT_REASONS` would be one more thing to forget when a reason is
 * added, and this cannot fall out of step because the key is derived.
 */
function reasonLabel(t: ReturnType<typeof translator>, reason: string): string {
  const key = reason.replace(/_(.)/g, (_, c: string) => c.toUpperCase())
  return t(`reportReason.${key}` as Parameters<typeof t>[0])
}

/**
 * What the suspended person is told, in their own language.
 *
 * A receipt, not a notification: sent directly rather than through
 * `notify.ts`, with no unsubscribe footer, because there is no preference
 * under which somebody could decline to be told their account is closed.
 *
 * It never says who reported them — `docs/community-guidelines.md` — and the
 * reporter is never told the outcome either. Those are the same rule read
 * from both ends.
 */
export function suspendedEmail(
  locale: Locale,
  input: { until: Date | null; reason: string },
): Email {
  const t = translator(locale)
  const until = input.until ? input.until.toLocaleDateString(locale) : null
  const detail = until
    ? t('email.suspendedUntilBody', { until })
    : t('email.suspendedPermanentBody')
  const reason = t('email.suspendedReason', { reason: reasonLabel(t, input.reason) })
  return {
    subject: t('email.suspendedSubject'),
    html: wrap(
      locale,
      t('email.suspendedPreheader'),
      `<p>${escapeHtml(detail)}</p>
       <p>${escapeHtml(reason)}</p>
       <p style="color:#62676d;">${escapeHtml(t('email.suspendedAppeal'))}</p>`,
    ),
    text: t('email.suspendedText', { detail, reason }),
  }
}

/** Sent after an appeal is decided — shortened, or lifted. Never after "keep". */
export function suspensionUpdatedEmail(locale: Locale, input: { until: Date | null }): Email {
  const t = translator(locale)
  const detail = input.until
    ? t('email.suspensionUpdatedShortened', { until: input.until.toLocaleDateString(locale) })
    : t('email.suspensionUpdatedLifted')
  return {
    subject: t('email.suspensionUpdatedSubject'),
    html: wrap(locale, t('email.suspensionUpdatedPreheader'), `<p>${escapeHtml(detail)}</p>`),
    text: t('email.suspensionUpdatedText', { detail }),
  }
}

/**
 * The operator's copy of an appeal — English, like every other mail in this
 * file that is read by us rather than about us.
 */
export function appealEmail(input: {
  text: string
  user: ReportedParty
  until: Date | null
  reason: string
  reviewUrl: string
}): Email {
  const subject = `Appeal from ${partyName(input.user)}`
  const ends = input.until ? input.until.toISOString() : 'permanent'
  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111;">
    <h1 style="font-size: 18px;">${escapeHtml(subject)}</h1>
    ${partyHtml('Suspended', input.user)}
    <p><strong>Suspended for</strong> ${escapeHtml(input.reason)} &middot; <strong>ends</strong> ${escapeHtml(ends)}</p>
    <p style="white-space: pre-wrap;">${escapeHtml(input.text)}</p>
    <p style="margin:24px 0 8px;"><a href="${encodeURI(input.reviewUrl)}" style="display:inline-block;background:#111;color:#fff;border-radius:8px;padding:12px 20px;font-weight:600;font-size:15px;text-decoration:none;">Decide this appeal</a></p>
    <p style="color: #888; font-size: 12px;">One appeal per suspension; there will not be another.</p>
  </body>
</html>`,
    text: [
      subject,
      '',
      ...partyText('Suspended', input.user),
      `Suspended for: ${input.reason}`,
      `Ends: ${ends}`,
      '',
      input.text,
      '',
      `Decide: ${input.reviewUrl}`,
    ].join('\n'),
  }
}
