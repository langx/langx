import { describe, expect, it } from 'vitest'
import { feedbackEmail } from './templates'

describe('feedbackEmail', () => {
  const sender = { userId: 'user-1', handle: 'bugfinder', email: 'finder@example.com' }
  const awardUrl = 'https://api.langx.io/feedback/award?token=v1.user-1.report-1.1.sig'
  const issueUrl = 'https://github.com/langx/langx/issues/42'

  const mail = (overrides: Partial<Parameters<typeof feedbackEmail>[0]> = {}) =>
    feedbackEmail({
      kind: 'bug',
      body: 'The wallet shows a negative balance after a refused gift.',
      attachmentUrls: [],
      sender,
      awardUrl,
      issueUrl,
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

  it('carries the proof, the issue and the link that pays, in both bodies', () => {
    const built = mail({
      attachmentUrls: ['https://media.example.test/feedback/user-1/proof.jpg'],
    })

    for (const body of [built.html, built.text]) {
      expect(body).toContain('https://media.example.test/feedback/user-1/proof.jpg')
      expect(body).toContain(issueUrl)
      expect(body).toContain(awardUrl)
    }
  })

  it('says so when no issue was opened', () => {
    const built = mail({ issueUrl: null })
    expect(built.text).toContain('No issue was opened.')
    expect(built.html).toContain('GITHUB_ISSUE_TOKEN')
  })

  it('escapes what the sender typed', () => {
    // A report is user-typed text landing in an HTML body, and the one that
    // closes the tag it is inside is the one worth a test.
    const built = mail({ body: '<img src=x onerror="alert(1)"> breaks the profile screen.' })

    expect(built.html).not.toContain('<img')
    expect(built.html).toContain('&#60;img')
  })
})
