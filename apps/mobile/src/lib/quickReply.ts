import { PUSH_ACTION_REPLY } from '@langx/shared'

/** What a notification's Reply box asks the app to send. */
export interface QuickReply {
  conversationId: string
  body: string
  clientId: string
}

/**
 * Reads a notification response as a quick reply, or `null` for anything
 * else — a tap, another action, an empty answer, a push with no thread.
 *
 * The `clientId` comes from the notification, not from the clock, because
 * one reply can reach the app twice: iOS hands it to the listener *and* keeps
 * it as the last response, and a JavaScript reload (an OTA update applying)
 * reads that last response again. The same notification always yields the
 * same id, so `sender_client_id_unique` turns the second send into the first
 * message rather than a copy of it. The clock is only the fallback for a
 * response that names no request, which neither platform produces today.
 * Cut to the 64 characters `clientMessageIdSchema` allows.
 */
export function quickReplyFrom(response: unknown, now = Date.now()): QuickReply | null {
  const r = response as {
    actionIdentifier?: unknown
    userText?: unknown
    notification?: { request?: { identifier?: unknown; content?: { data?: unknown } } }
  } | null
  if (r?.actionIdentifier !== PUSH_ACTION_REPLY) return null
  const body = typeof r.userText === 'string' ? r.userText.trim() : ''
  const request = r.notification?.request
  const data = request?.content?.data as { conversationId?: unknown } | null | undefined
  const conversationId = data?.conversationId
  if (!body || typeof conversationId !== 'string' || !conversationId) return null
  const identifier = typeof request?.identifier === 'string' ? request.identifier : ''
  const clientId = identifier ? `notif-${identifier}` : `notif-${conversationId}-${now}`
  return { conversationId, body, clientId: clientId.slice(0, 64) }
}
