/**
 * The four Graph API calls this flow makes, and nothing else.
 *
 * Kept behind one interface so the route can be tested without the network and
 * without a page token: `instagramWebhook.test.ts` passes a recording double,
 * which is the only way to assert the *order* the calls happen in — and the
 * order is the whole subtlety of this feature.
 */

const GRAPH = 'https://graph.instagram.com/v21.0'

export interface InstagramGraph {
  /** Answered under the post, publicly. */
  replyToComment(commentId: string, message: string): Promise<void>
  /**
   * The one private message a comment earns. Addressed to the comment rather
   * than to a person, because at this point we do not have a person: a comment
   * carries no messaging id until its author writes to us.
   */
  sendPrivateReply(commentId: string, message: string): Promise<void>
  /** Anything after that, inside the window their reply opened. */
  sendMessage(recipientId: string, message: string): Promise<void>
  /**
   * Whether they follow the account.
   *
   * Readable only once they have messaged us — which is why every step above
   * happens before this one, and why the private reply cannot be spent on
   * "follow first". Meta does not expose this for a commenter.
   */
  follows(recipientId: string): Promise<boolean>
}

export interface GraphConfig {
  /** The Instagram professional account's own id. */
  accountId: string
  /** A long-lived page token with the messaging and comment scopes. */
  token: string
  /** Injected in tests; the global otherwise. */
  fetch?: typeof globalThis.fetch
}

export function createGraph({
  accountId,
  token,
  fetch = globalThis.fetch,
}: GraphConfig): InstagramGraph {
  async function post(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${GRAPH}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`instagram ${path} failed: ${response.status} ${await response.text()}`)
    }
  }

  return {
    async replyToComment(commentId, message) {
      await post(`/${commentId}/replies`, { message })
    },
    async sendPrivateReply(commentId, message) {
      await post(`/${accountId}/messages`, {
        recipient: { comment_id: commentId },
        message: { text: message },
      })
    },
    async sendMessage(recipientId, message) {
      await post(`/${accountId}/messages`, {
        recipient: { id: recipientId },
        message: { text: message },
      })
    },
    async follows(recipientId) {
      const response = await fetch(`${GRAPH}/${recipientId}?fields=is_user_follow_business`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        throw new Error(`instagram profile read failed: ${response.status}`)
      }
      const body = (await response.json()) as { is_user_follow_business?: boolean }
      return body.is_user_follow_business === true
    },
  }
}
