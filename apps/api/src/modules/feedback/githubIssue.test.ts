import { describe, expect, it, vi } from 'vitest'
import { issueTitle, openFeedbackIssue } from './githubIssue'

const config = { token: 'ghp_test', repo: 'langx/langx' }
const report = {
  kind: 'bug' as const,
  body: 'The wallet shows a negative balance.\nSteps: refuse a gift, open the wallet.',
  attachmentCount: 1,
}

/** A `fetch` that always answers this, and remembers what it was asked to send. */
type Recording = typeof fetch & { mock: { calls: [string, { body: string }][] } }

function respond(status: number, body: unknown): Recording {
  return vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as Recording
}

/** The JSON body of the one call that was made. */
function sent(fetchImpl: Recording): { title: string; body: string; labels: string[] } {
  const call = fetchImpl.mock.calls[0]
  if (!call) throw new Error('GitHub was never asked')
  return JSON.parse(call[1].body) as { title: string; body: string; labels: string[] }
}

describe('openFeedbackIssue', () => {
  it('labels the issue by kind and answers with its URL', async () => {
    const fetchImpl = respond(201, { html_url: 'https://github.com/langx/langx/issues/42' })

    const url = await openFeedbackIssue(config, report, fetchImpl)

    expect(url).toBe('https://github.com/langx/langx/issues/42')
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/langx/langx/issues')
    expect(sent(fetchImpl).labels).toEqual(['bug'])
    expect(sent(fetchImpl).title).toBe('Bug: The wallet shows a negative balance.')
    expect(sent(fetchImpl).body).toContain('1 file(s) attached')
  })

  it('labels a feature request as a feature', async () => {
    const fetchImpl = respond(201, { html_url: 'https://github.com/langx/langx/issues/43' })

    await openFeedbackIssue(config, { ...report, kind: 'feature' }, fetchImpl)

    expect(sent(fetchImpl).labels).toEqual(['feature'])
  })

  it('never names the person who sent it, nor links their files — the issue is public', async () => {
    const fetchImpl = respond(201, { html_url: 'https://github.com/langx/langx/issues/44' })

    await openFeedbackIssue(config, report, fetchImpl)

    const issue = sent(fetchImpl)
    expect(issue.body).not.toContain('@')
    // The proof lives under `feedback/<userId>/`, and an account id resolves to
    // a handle through the public profile route.
    expect(issue.body).not.toContain('user-1')
    expect(issue.body).not.toContain('media.example.test')
  })

  it('opens nothing without a token, and asks GitHub nothing either', async () => {
    const fetchImpl = respond(201, { html_url: 'https://github.com/langx/langx/issues/45' })

    expect(await openFeedbackIssue({ ...config, token: undefined }, report, fetchImpl)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('answers null rather than throwing when GitHub refuses or breaks', async () => {
    expect(await openFeedbackIssue(config, report, respond(403, { message: 'no' }))).toBeNull()
    expect(await openFeedbackIssue(config, report, respond(201, { nope: true }))).toBeNull()

    const broken = vi.fn(() => Promise.reject(new Error('network'))) as unknown as typeof fetch
    expect(await openFeedbackIssue(config, report, broken)).toBeNull()
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
