import { describe, expect, it } from 'vitest'
import { feedbackEmail } from './templates'

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
