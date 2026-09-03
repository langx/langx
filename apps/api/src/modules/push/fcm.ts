import { createSign } from 'node:crypto'
import type { PushMessage, PushResult, PushSender } from './devices'

/** What Google hands out for a service account, as the JSON file's fields. */
interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
  token_uri: string
}

/** How many sends are in flight at once. FCM's own guidance is "a few hundred"; ten keeps a big fan-out polite. */
const CONCURRENCY = 10
/** Refresh the access token a minute before Google says it dies. */
const TOKEN_SLACK_MS = 60 * 1000

/**
 * Firebase Cloud Messaging, spoken to directly.
 *
 * Push used to go through Expo's relay, which meant Expo holding our FCM
 * service account and our Apple key on our behalf. Going straight to FCM puts
 * the only credential on our own server, and the same key covers both
 * platforms once Firebase holds the APNs key — one sender, one secret, no
 * third party between the message and the phone.
 *
 * FCM v1 has no multi-recipient endpoint: one request per device token. That
 * is fine for a message push (one person, a phone and maybe a tablet) and is
 * throttled here for the evening fan-outs.
 *
 * `data` values must be strings — FCM rejects anything else — and every field
 * this app sends already is one, but the map is stringified anyway so a future
 * number cannot fail an entire send.
 */
export class FcmPushSender implements PushSender {
  readonly #account: ServiceAccount
  #accessToken: { value: string; expiresAt: number } | null = null

  constructor(serviceAccountJson: string) {
    this.#account = JSON.parse(serviceAccountJson) as ServiceAccount
  }

  async send(message: PushMessage): Promise<PushResult> {
    const invalidTokens: string[] = []
    const accessToken = await this.#token()
    const endpoint = `https://fcm.googleapis.com/v1/projects/${this.#account.project_id}/messages:send`
    const data = Object.fromEntries(
      Object.entries(message.data)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    )

    const queue = [...message.to]
    const worker = async (): Promise<void> => {
      for (let token = queue.shift(); token !== undefined; token = queue.shift()) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data,
              // A message is worth waking the phone for; the OS may still
              // batch it, but it is not deferred until the next network window.
              android: { priority: 'high', notification: { channel_id: 'default' } },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        })
        if (response.ok) continue

        /*
         * Only a token FCM says is gone is pruned. `UNREGISTERED` is the app
         * uninstalled; `INVALID_ARGUMENT` on the token is a token that was
         * never FCM's — an old Expo one, say. Quota and availability errors
         * describe this send, not the device, and deleting a token over them
         * would silence a real phone.
         */
        const body = (await response.json().catch(() => ({}))) as {
          error?: { status?: string; details?: { errorCode?: string }[] }
        }
        const code = body.error?.details?.find((d) => d.errorCode)?.errorCode ?? body.error?.status
        if (code === 'UNREGISTERED' || code === 'NOT_FOUND' || code === 'INVALID_ARGUMENT') {
          invalidTokens.push(token)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    return { invalidTokens }
  }

  /**
   * A short-lived OAuth bearer, minted from the service account's own key.
   * No SDK: it is one signed JWT and one POST, and the SDK's dependency tree
   * is the size of the rest of this API.
   */
  async #token(): Promise<string> {
    if (this.#accessToken && Date.now() < this.#accessToken.expiresAt - TOKEN_SLACK_MS) {
      return this.#accessToken.value
    }
    const now = Math.floor(Date.now() / 1000)
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: this.#account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: this.#account.token_uri,
      iat: now,
      exp: now + 3600,
    })}`
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    const assertion = `${unsigned}.${signer.sign(this.#account.private_key, 'base64url')}`

    const response = await fetch(this.#account.token_uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
    if (!response.ok) throw new Error(`FCM auth failed: ${response.status}`)
    const body = (await response.json()) as { access_token: string; expires_in: number }
    this.#accessToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
    return body.access_token
  }
}
