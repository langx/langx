import { describe, expect, it } from 'vitest'
import { bugReportEmail } from './templates'

describe('bugReportEmail', () => {
  const reporter = { userId: 'user-1', handle: 'bugfinder', email: 'finder@example.com' }
  const awardUrl = 'https://api.langx.io/bug-reports/award?token=v1.user-1.report-1.1.sig'

  it('names the finder in the subject and carries the proof as links', () => {
    const mail = bugReportEmail({
      body: 'The wallet shows a negative balance after a refused gift.',
      attachmentUrls: ['https://media.example.test/bug-reports/user-1/proof.jpg'],
      reporter,
      awardUrl,
    })

    expect(mail.subject).toBe('Bug report from @bugfinder')
    expect(mail.html).toContain('https://media.example.test/bug-reports/user-1/proof.jpg')
    expect(mail.text).toContain('negative balance')
    expect(mail.text).toContain('finder@example.com')
  })

  it('carries the link that pays the finder, in both bodies', () => {
    const mail = bugReportEmail({
      body: 'The wallet shows a negative balance after a refused gift.',
      attachmentUrls: [],
      reporter,
      awardUrl,
    })

    expect(mail.html).toContain(awardUrl)
    expect(mail.text).toContain(awardUrl)
  })

  it('falls back to the user id when the account has no handle yet', () => {
    const mail = bugReportEmail({
      body: 'Onboarding will not finish.',
      attachmentUrls: [],
      reporter: { userId: 'user-2', handle: null, email: null },
      awardUrl,
    })

    expect(mail.subject).toBe('Bug report from user-2')
    expect(mail.html).not.toContain('Proof')
  })

  it('escapes what the reporter typed', () => {
    // A report is user-typed text landing in an HTML body, and the one that
    // closes the tag it is inside is the one worth a test.
    const mail = bugReportEmail({
      body: '<img src=x onerror="alert(1)"> breaks the profile screen.',
      attachmentUrls: [],
      reporter,
      awardUrl,
    })

    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('&#60;img')
  })
})
