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
    faces,
    moreThreads,
    url,
    unsubscribe,
  }: {
    count: number
    /** Who wrote, in the order the threads came back. */
    faces: AvatarFace[]
    moreThreads: number
    url: string
    unsubscribe: string
  },
): Email {
  const t = translator(locale)
  const subject = t('email.digestSubject', { count })
  // `Intl.ListFormat` because "Ada, Bo and Cy" is not "Ada, Bo, Cy" in most of
  // the eight languages, and joining with a comma is wrong in all of them.
  const names = faces.map((face) => face.name)
  const joined = formatList(locale, names)
  const body = t('email.digestBody', { count, names: joined })
  const more = moreThreads > 0 ? t('email.digestMore', { count: moreThreads }) : ''
  const cta = { url, label: t('email.digestButton') }

  return {
    subject,
    html: notificationEmail(locale, {
      preheader: t('email.digestPreheader'),
      bodyHtml: `<p>${body}</p>`,
      // The faces stand in for the "and N more" sentence rather than
      // repeating it: a grey +N disc says the same thing in less room.
      extraHtml: facesRow(faces, moreThreads, locale === 'ar' ? 'rtl' : 'ltr'),
      cta,
      unsubscribeUrl: unsubscribe,
      manageUrl: webUrl('/settings'),
    }).html,
    text: notificationText(locale, [body, ...(more ? [more] : []), '', cta.url], unsubscribe),
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
      bodyHtml: `<p>${body}</p><p style="color:#62676d;">${detail}</p>`,
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

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, system-ui, sans-serif; color: #111;">
    <h1 style="font-size: 18px;">${escapeHtml(subject)}</h1>
    ${frozenLine}
    <p><strong>Reason</strong> ${escapeHtml(reason)}</p>
    ${details}
    ${partyHtml('Reported', input.reported)}
    ${partyHtml('Reporter', input.reporter)}
    ${pointers.length ? `<p><strong>Raised from</strong></p><ul>${pointers.join('')}</ul>` : ''}
    <p style="color: #888; font-size: 12px;">Report ${escapeHtml(
      input.reportId,
    )}, stored in <code>reports</code> with status <code>open</code>. Nothing changes it yet.</p>
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
      ...partyText('Reported', input.reported),
      ...partyText('Reporter', input.reporter),
      '',
      ...(input.context.conversationId ? [`Conversation: ${input.context.conversationId}`] : []),
      ...(input.context.messageId ? [`Message: ${input.context.messageId}`] : []),
      ...(input.context.postId ? [`Post: ${postUrl(input.context.postId)}`] : []),
      '',
      `Report ${input.reportId} — reports collection, status open.`,
    ].join('\n'),
  }
}
