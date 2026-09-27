import { PUSH_ACTION_REPLY } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { quickReplyFrom } from './quickReply'

const response = (overrides: Record<string, unknown> = {}) => ({
  actionIdentifier: PUSH_ACTION_REPLY,
  userText: '  see you then  ',
  notification: {
    request: {
      identifier: 'A1B2C3D4-0000-4000-8000-000000000000',
      content: { data: { kind: 'message', conversationId: 'c1', senderId: 'u2' } },
    },
  },
  ...overrides,
})

describe('quickReplyFrom', () => {
  it('reads the thread, the trimmed text and an id tied to the notification', () => {
    expect(quickReplyFrom(response())).toEqual({
      conversationId: 'c1',
      body: 'see you then',
      clientId: 'notif-A1B2C3D4-0000-4000-8000-000000000000',
    })
  })

  /** The whole point of the id: a reload that reads the reply again cannot post it twice. */
  it('gives the same id every time it is asked about the same notification', () => {
    expect(quickReplyFrom(response(), 1)?.clientId).toBe(quickReplyFrom(response(), 2)?.clientId)
  })

  it('falls back to the thread and the clock when the request has no identifier', () => {
    const r = response()
    const bare = { ...r, notification: { request: { content: r.notification.request.content } } }
    expect(quickReplyFrom(bare, 42)?.clientId).toBe('notif-c1-42')
  })

  it('keeps the id within what the server accepts', () => {
    const r = response()
    const long = {
      ...r,
      notification: { request: { ...r.notification.request, identifier: 'x'.repeat(200) } },
    }
    expect(quickReplyFrom(long)?.clientId).toHaveLength(64)
  })

  it('is not a reply when it is a tap, empty, or about no thread', () => {
    for (const r of [
      response({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' }),
      response({ userText: '   ' }),
      response({ userText: undefined }),
      response({ notification: { request: { identifier: 'n1', content: { data: {} } } } }),
      null,
      undefined,
    ]) {
      expect(quickReplyFrom(r)).toBeNull()
    }
  })
})
