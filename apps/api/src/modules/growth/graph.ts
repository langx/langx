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
  /**
   * Which account this token speaks as, asked of `/me` rather than configured.
   *
   * The dashboard shows one id for @langxapp and the token answers with
   * another — both real, in different id spaces — and addressing `/messages`
   * with the wrong one fails at the moment a DM should go out, which is the
   * hardest place to notice it. So the token is asked, and the answer cached.
   */
  accountId(): Promise<string>
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
  /**
   * What `IG_ACCOUNT_ID` holds, used only if `/me` cannot be reached. Asking
   * the token is the truth; this is the fallback for a network blip, not a
   * second source of it.
   */
  fallbackAccountId?: string
  /** A long-lived page token with the messaging and comment scopes. */
  token: string
  /** Injected in tests; the global otherwise. */
  fetch?: typeof globalThis.fetch
}

export function createGraph({
  fallbackAccountId,
  token,
  fetch = globalThis.fetch,
}: GraphConfig): InstagramGraph {
  let resolved: Promise<string> | null = null
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

  async function askWhoWeAre(): Promise<string> {
    const response = await fetch(`${GRAPH}/me?fields=id`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      if (fallbackAccountId) return fallbackAccountId
      throw new Error(`instagram /me failed: ${response.status}`)
    }
    const body = (await response.json()) as { id?: string }
    if (typeof body.id !== 'string') {
      if (fallbackAccountId) return fallbackAccountId
      throw new Error('instagram /me returned no id')
    }
    return body.id
  }

  return {
    async accountId() {
      // Cached as the promise, not the value, so two events arriving together
      // ask once.
      resolved ??= askWhoWeAre()
      try {
        return await resolved
      } catch (caught) {
        // A failed lookup must not poison every later call.
        resolved = null
        throw caught
      }
    },
    async replyToComment(commentId, message) {
      await post(`/${commentId}/replies`, { message })
    },
    async sendPrivateReply(commentId, message) {
      await post(`/${await this.accountId()}/messages`, {
        recipient: { comment_id: commentId },
        message: { text: message },
      })
    },
    async sendMessage(recipientId, message) {
      await post(`/${await this.accountId()}/messages`, {
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
