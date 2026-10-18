import { PLAN_LIMITS, SUPPORTED_LOCALES, type Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import { feedbackEmail, lifetimeGiftEmail, promotionEmail } from './templates'

describe('feedbackEmail', () => {
  const sender = { userId: 'user-1', handle: 'bugfinder', email: 'finder@example.com' }
  const awardUrl = 'https://api.langx.io/feedback/award?token=v1.user-1.report-1.1.sig'
  const newIssueUrl = 'https://github.com/langx/langx/issues/new?title=Bug%3A+the+wallet&labels=bug'

  const mail = (overrides: Partial<Parameters<typeof feedbackEmail>[0]> = {}) =>
    feedbackEmail({
      kind: 'bug',
      body: 'The wallet shows a negative balance after a refused gift.',
      attachmentUrls: [],
      sender,
      awardUrl,
      newIssueUrl,
      ...overrides,
    })

  it('says which kind it is, and who sent it', () => {
    expect(mail().subject).toBe('Bug report from @bugfinder')
    expect(mail({ kind: 'feature' }).subject).toBe('Feature request from @bugfinder')
  })

  it('falls back to the user id when the account has no handle yet', () => {
    const built = mail({ sender: { userId: 'user-2', handle: null, email: null } })
    expect(built.subject).toBe('Bug report from user-2')
    expect(built.html).not.toContain('Proof')
  })

  it('carries the proof, the issue link and the link that pays, in both bodies', () => {
    const built = mail({
      attachmentUrls: ['https://media.example.test/feedback/user-1/proof.jpg'],
    })

    for (const body of [built.html, built.text]) {
      expect(body).toContain('https://media.example.test/feedback/user-1/proof.jpg')
      expect(body).toContain('issues/new')
      expect(body).toContain(awardUrl)
    }
    // The `&` between the query fields is escaped in the href, so only the
    // plain-text body carries the URL character for character.
    expect(built.text).toContain(newIssueUrl)
  })

  it('names the filed issue instead of offering the form', () => {
    const built = mail({ filedIssueUrl: 'https://github.com/langx/langx/issues/7' })
    for (const body of [built.html, built.text]) {
      expect(body).toContain('https://github.com/langx/langx/issues/7')
      expect(body).not.toContain('issues/new')
    }
  })

  it('says so when opening the issue failed, and still offers the form', () => {
    const built = mail({ issueFailed: true })
    for (const body of [built.html, built.text]) {
      expect(body).toContain('Opening the issue automatically failed')
      expect(body).toContain('issues/new')
    }
  })

  it('offers to open the issue rather than opening one', () => {
    const built = mail()
    expect(built.html).toContain('Open this as a GitHub issue')
    expect(built.html).toContain('Nothing is posted until you press Submit')
  })

  it('escapes what the sender typed', () => {
    // A report is user-typed text landing in an HTML body, and the one that
    // closes the tag it is inside is the one worth a test.
    const built = mail({ body: '<img src=x onerror="alert(1)"> breaks the profile screen.' })

    expect(built.html).not.toContain('<img')
    expect(built.html).toContain('&#60;img')
  })
})

describe('lifetimeGiftEmail', () => {
  /** `@gerard`'s real numbers: the v1 total, a hundredth of it, and a bigger wallet. */
  const mail = (locale: Parameters<typeof lifetimeGiftEmail>[0] = 'en') =>
    lifetimeGiftEmail(locale, {
      plan: 'Pro',
      legacyTokens: 11_579,
      legacyTokensText: '11,579',
      carriedText: '115',
      balance: 615,
      balanceText: '615',
      url: 'https://app.langx.io/settings/plan',
    })

  it('names the plan in the subject and all three numbers in both bodies', () => {
    const built = mail()
    expect(built.subject).toBe('Pro, for life')
    for (const body of [built.html, built.text]) {
      expect(body).toContain('11,579')
      expect(body).toContain('115')
      expect(body).toContain('615')
      expect(body).toContain('https://app.langx.io/settings/plan')
    }
  })

  /**
   * A receipt, not a list — the same rule the bounty mail follows, and the
   * reason this one is built on `shell` with an empty footer rather than
   * `wrap`, whose footer offers to be ignored.
   */
  it('carries no unsubscribe and does not offer to be ignored', () => {
    const built = mail()
    expect(built.html).not.toContain('unsubscribe')
    expect(built.html).not.toContain('ignore')
  })

  it('is written in the reader’s language', () => {
    expect(mail('tr').subject).toBe('Pro, ömür boyu')
    expect(mail('tr').text).toContain('Tebrikler')
  })
})

describe('promotionEmail: limitReached', () => {
  /**
   * "More attachments" was in the mail's promise and not in Pro: photos, video
   * and voice messages have the same daily ceiling on both plans, a fair-use
   * limit that refuses with a plain alert rather than the paywall. Each
   * locale's word for it, so a translator re-adding the claim in one language
   * is caught as well as the English.
   */
  const ATTACHMENTS: Record<Locale, RegExp> = {
    en: /attachment/i,
    tr: /\bek(ler)?\b/i,
    es: /adjunto/i,
    'pt-BR': /anexo/i,
    fr: /pièces? jointes?/i,
    de: /anh[aä]ng/i,
    ru: /вложени/i,
    ar: /مرفق/,
  }
  const mail = (locale: Locale) =>
    promotionEmail(locale, 'limitReached', { unsubscribe: 'https://app.langx.io/unsubscribe' })

  it.each(SUPPORTED_LOCALES)('does not promise attachments in %s', (locale) => {
    // The mail is allowed to name attachments again the day a plan sells them.
    if (PLAN_LIMITS.pro.mediaPer24h !== PLAN_LIMITS.free.mediaPer24h) return
    const built = mail(locale)
    for (const text of [built.subject, built.text]) {
      expect(text).not.toMatch(ATTACHMENTS[locale])
    }
  })

  it('still says what Pro really does give more of', () => {
    // Both halves of the sentence, checked against the table it describes.
    expect(PLAN_LIMITS.pro.initiationsPer24h).toBeNull()
    expect(PLAN_LIMITS.free.initiationsPer24h).not.toBeNull()
    expect(PLAN_LIMITS.pro.translationsPer24h).toBeNull()
    expect(PLAN_LIMITS.free.translationsPer24h).not.toBeNull()
    expect(translator('en')('email.promo.limitReachedBody')).toContain(
      'more conversations and more translations',
    )
    expect(mail('en').text).toContain('more conversations and more translations')
  })
})
