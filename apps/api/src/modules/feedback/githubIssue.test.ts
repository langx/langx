import { FEEDBACK_MAX_LENGTH } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { isFiledIssue, issueTitle, newIssueUrl, openIssue } from './githubIssue'

const report = {
  kind: 'bug' as const,
  body: 'The wallet shows a negative balance.\nSteps: refuse a gift, open the wallet.',
  attachmentCount: 1,
}

const fields = (url: string) => new URL(url).searchParams

describe('newIssueUrl', () => {
  it("points at the repository's own form, prefilled and labelled by kind", () => {
    const url = new URL(newIssueUrl('langx/langx', report))

    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/langx/langx/issues/new')
    expect(url.searchParams.get('labels')).toBe('bug,triage')
    expect(url.searchParams.get('title')).toBe('Bug: The wallet shows a negative balance.')
    expect(url.searchParams.get('body')).toContain('1 file(s) attached')
  })

  it('labels a feature request as a feature', () => {
    expect(fields(newIssueUrl('langx/langx', { ...report, kind: 'feature' })).get('labels')).toBe(
      'feature,triage',
    )
  })

  it('never names the person who sent it, nor links their files — the issue is public', () => {
    const body = fields(newIssueUrl('langx/langx', report)).get('body') ?? ''

    expect(body).not.toContain('@')
    // The proof lives under `feedback/<userId>/`, and an account id resolves to
    // a handle through the public profile route.
    expect(body).not.toContain('user-1')
    expect(body).not.toContain('media.example.test')
  })

  /**
   * A report at the ceiling, written in a script whose every character costs
   * six once percent-encoded — the case that would otherwise hand GitHub a URL
   * it answers 414 to. The words are in the email the link arrived in.
   */
  it('drops the body rather than building a link GitHub would refuse', () => {
    const url = newIssueUrl('langx/langx', { ...report, body: 'ё'.repeat(FEEDBACK_MAX_LENGTH) })

    expect(url.length).toBeLessThan(6100)
    expect(fields(url).get('body')).toBeNull()
    expect(fields(url).get('title')).toContain('Bug: ')
    expect(fields(url).get('labels')).toBe('bug,triage')
  })
})

describe('issueTitle', () => {
  it('takes the first line and prefixes the kind', () => {
    expect(issueTitle('feature', 'Dark mode for the web app\nIt is blinding at night.')).toBe(
      'Feature: Dark mode for the web app',
    )
  })

  it('trims a first line no list could read', () => {
    const title = issueTitle('bug', 'x'.repeat(200))
    expect(title.length).toBeLessThanOrEqual(86)
    expect(title.endsWith('…')).toBe(true)
  })

  it('still says something when the body starts with a blank line', () => {
    expect(issueTitle('bug', '\n\nsomething')).toBe('Bug: something')
  })
})

describe('openIssue', () => {
  it('files it labelled by kind and triage, and answers its page', async () => {
    let sent: { url: string; body: string } | undefined
    const fake = (url: string, init: { body: string }) => {
      sent = { url, body: init.body }
      return Promise.resolve(
        new Response(JSON.stringify({ html_url: 'https://github.com/langx/langx/issues/7' }), {
          status: 201,
        }),
      )
    }

    const url = await openIssue('t0ken', 'langx/langx', report, fake as unknown as typeof fetch)

    expect(url).toBe('https://github.com/langx/langx/issues/7')
    expect(sent?.url).toBe('https://api.github.com/repos/langx/langx/issues')
    const body = JSON.parse(sent?.body ?? '{}') as { labels: string[]; body: string }
    expect(body.labels).toEqual(['bug', 'triage'])
    expect(body.body).not.toContain('feedback/')
  })

  it('throws rather than answering nothing when GitHub refuses', async () => {
    const fake = () => Promise.resolve(new Response('Bad credentials', { status: 401 }))
    await expect(openIssue('expired', 'langx/langx', report, fake as typeof fetch)).rejects.toThrow(
      '401',
    )
  })
})

describe('isFiledIssue', () => {
  it('tells a filed issue from the form that would file one', () => {
    expect(isFiledIssue('https://github.com/langx/langx/issues/7')).toBe(true)
    expect(isFiledIssue(newIssueUrl('langx/langx', report))).toBe(false)
    expect(isFiledIssue(undefined)).toBe(false)
  })
})
