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

/** A `fetch` that keeps the bodies, which is what the button tests are about. */
function posting(reject: (body: unknown, attempt: number) => boolean = () => false) {
  const bodies: unknown[] = []
  const fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    if (asked(url).includes('/me?fields=id')) {
      return Promise.resolve(new Response(JSON.stringify({ id: 'us' }), { status: 200 }))
    }
    // `BodyInit` is a union; the client only ever sends the string branch.
    const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}')
    bodies.push(body)
    return Promise.resolve(
      reject(body, bodies.length) ? new Response('nope', { status: 400 }) : new Response('{}'),
    )
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, bodies }
}

/** What Instagram calls the buttons under a message. */
function quickRepliesIn(body: unknown): unknown {
  return (body as { message?: { quick_replies?: unknown } }).message?.quick_replies
}

describe('buttons under a message', () => {
  it('sends a quick reply Instagram will render', async () => {
    const { fetch, bodies } = posting()
    const graph = createGraph({ token: 't', fetch })

    await graph.sendMessage('them', 'Tap below', [{ title: 'Send the link', payload: 'SEND' }])

    expect(quickRepliesIn(bodies[0])).toEqual([
      { content_type: 'text', title: 'Send the link', payload: 'SEND' },
    ])
  })

  it('leaves the key out entirely when there are no buttons', async () => {
    // An empty `quick_replies` array is not the same as no buttons to Meta,
    // and the difference shows as a rejected send rather than a plain message.
    const { fetch, bodies } = posting()
    const graph = createGraph({ token: 't', fetch })

    await graph.sendMessage('them', 'Here it is')

    expect(bodies[0]).toEqual({ recipient: { id: 'them' }, message: { text: 'Here it is' } })
  })

  it('falls back to plain text when a buttoned private reply is refused', async () => {
    // Meta documents quick replies against a recipient id and says nothing
    // about a recipient comment_id. If they turn out not to be allowed there,
    // the alternative is no DM at all — under a public reply that already
    // said one was sent.
    const { fetch, bodies } = posting((body) => quickRepliesIn(body) !== undefined)
    const graph = createGraph({ token: 't', fetch })

    await graph.sendPrivateReply('comment-1', 'Tap below', [{ title: 'Send', payload: 'SEND' }])

    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toEqual({
      recipient: { comment_id: 'comment-1' },
      message: { text: 'Tap below' },
    })
  })

  it('still fails when the plain private reply is refused too', async () => {
    // A retry that hides a real failure is worse than the failure: the public
    // reply under the comment has already promised a DM.
    const { fetch } = posting(() => true)
    const graph = createGraph({ token: 't', fetch })

    await expect(
      graph.sendPrivateReply('comment-1', 'Tap below', [{ title: 'Send', payload: 'SEND' }]),
    ).rejects.toThrow(/messages failed/)
  })
})
