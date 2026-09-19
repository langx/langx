import { describe, expect, it, vi } from 'vitest'
import { createGraph } from './graph'

/** `fetch` takes three shapes of input; only one of them stringifies usefully. */
function asked(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

/** A `fetch` that records what it was asked and answers from a script. */
function recording(answers: Record<string, unknown>) {
  const calls: string[] = []
  const fetch = vi.fn((url: string | URL | Request) => {
    const path = asked(url)
    calls.push(path)
    const match = Object.keys(answers).find((known) => path.includes(known))
    if (!match) return Promise.resolve(new Response('not found', { status: 404 }))
    return Promise.resolve(
      new Response(JSON.stringify(answers[match]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

describe('the account id the token speaks as', () => {
  it('comes from /me, not from configuration', async () => {
    // The dashboard shows one id for the account and the token answers with
    // another; addressing /messages with the wrong one fails exactly where a
    // DM should have gone out.
    const { fetch, calls } = recording({ '/me': { id: 'from-me' }, '/messages': {} })
    const graph = createGraph({ token: 't', fallbackAccountId: 'from-config', fetch })

    await graph.sendMessage('someone', 'hello')

    expect(calls.some((url) => url.includes('/from-me/messages'))).toBe(true)
    expect(calls.some((url) => url.includes('from-config'))).toBe(false)
  })

  it('asks once however many calls follow', async () => {
    const { fetch, calls } = recording({ '/me': { id: 'from-me' }, '/messages': {} })
    const graph = createGraph({ token: 't', fetch })

    await Promise.all([
      graph.sendMessage('a', 'one'),
      graph.sendMessage('b', 'two'),
      graph.sendPrivateReply('c', 'three'),
    ])

    // `/me` on its own would also match `/messages`; the query is what makes
    // this the identity lookup and nothing else.
    expect(calls.filter((url) => url.includes('/me?fields=id')).length).toBe(1)
  })

  it('falls back to the configured id when /me cannot be reached', async () => {
    const { fetch, calls } = recording({ '/messages': {} })
    const graph = createGraph({ token: 't', fallbackAccountId: 'from-config', fetch })

    await graph.sendMessage('someone', 'hello')

    expect(calls.some((url) => url.includes('/from-config/messages'))).toBe(true)
  })

  it('refuses rather than guessing when there is no fallback either', async () => {
    const { fetch } = recording({ '/messages': {} })
    const graph = createGraph({ token: 't', fetch })

    await expect(graph.accountId()).rejects.toThrow(/\/me failed/)
  })

  it('retries the lookup after a failure instead of staying poisoned', async () => {
    let meWorks = false
    const fetch = vi.fn((url: string | URL | Request) => {
      if (asked(url).includes('/me?fields=id')) {
        return Promise.resolve(
          meWorks
            ? new Response(JSON.stringify({ id: 'from-me' }), { status: 200 })
            : new Response('nope', { status: 500 }),
        )
      }
      return Promise.resolve(new Response('{}', { status: 200 }))
    }) as unknown as typeof globalThis.fetch
    const graph = createGraph({ token: 't', fetch })

    await expect(graph.accountId()).rejects.toThrow()
    meWorks = true
    await expect(graph.accountId()).resolves.toBe('from-me')
  })
})
