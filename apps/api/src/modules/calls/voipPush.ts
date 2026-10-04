import { APPLE_TEAM_ID, IOS_BUNDLE_ID, type ApnsEnvironment } from '@langx/shared'
import { importPKCS8, SignJWT } from 'jose'
import { connect, constants, type ClientHttp2Session } from 'node:http2'
import type { Env } from '../../env'

/**
 * The push that makes an iPhone ring.
 *
 * Everything else this app sends goes through Expo's relay, and that decision
 * stands (`docs/decisions.md` → _Push stays on Expo's relay, after a day on
 * Firebase directly_). This is the one
 * exception, and it is not a choice: a VoIP push is its own APNs push type,
 * delivered to its own token, and Expo's service does not carry it. It is also
 * the only kind of push iOS will start a killed app for and let it put the
 * system's incoming-call screen on a locked phone.
 *
 * **Only ever sent to ring.** iOS requires that every VoIP push end in a call
 * being reported to the system, and it stops delivering them to an app that
 * breaks the rule — so there is no "cancel" VoIP push, no "answered elsewhere"
 * one, nothing but "somebody is calling". A phone learns that the ringing
 * stopped the way it learns anything else: its own timer, or the app asking.
 */
export interface VoipPush {
  /** The PushKit token, hex. */
  token: string
  environment: ApnsEnvironment
  /** The JSON the phone's native code reads. Small: APNs allows a VoIP push 5 KB. */
  payload: Record<string, unknown>
  /**
   * When the call stops ringing. Apple discards the push if it has not been
   * delivered by then, which is what keeps a phone that was in a tunnel for
   * five minutes from ringing for a call that ended four minutes ago.
   */
  expiresAt: Date
}

export type VoipResult =
  | { ok: true }
  /** `gone` means Apple said the token is no longer a phone: stop sending to it. */
  | { ok: false; gone: boolean; reason: string }

export interface VoipSender {
  /** False for the stand-in, which is how the ring falls back to an ordinary push. */
  readonly configured: boolean
  send(push: VoipPush): Promise<VoipResult>
  /** Drops the open connections. Called when the app closes. */
  close(): void
}

/**
 * Mirrors `LoggingPushSender`: without a key nothing is sent, nothing fails,
 * and a test can read what would have gone out.
 */
export class NotConfiguredVoipSender implements VoipSender {
  readonly configured = false
  readonly sent: VoipPush[] = []

  send(push: VoipPush): Promise<VoipResult> {
    this.sent.push(push)
    return Promise.resolve({ ok: false, gone: false, reason: 'NotConfigured' })
  }

  close(): void {}
}

/** The narrow slice of a logger this needs, for the reason `PushSenderLogger` is narrow. */
export interface VoipSenderLogger {
  warn(obj: Record<string, unknown>, msg: string): void
}

export interface ApnsVoipConfig {
  keyId: string
  teamId: string
  /** The app's bundle id. The VoIP topic is this with `.voip` on the end. */
  bundleId: string
  /** PEM-encoded `.p8` APNs auth key. */
  privateKeyPem: string
}

const APNS_ORIGINS: Record<ApnsEnvironment, string> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
}

/**
 * Apple accepts a provider token for an hour and refuses one refreshed more
 * often than every twenty minutes. Forty sits inside both.
 */
const JWT_LIFETIME_MS = 40 * 60 * 1000

/** A ring that takes longer than this to reach Apple is not going to be a ring. */
const REQUEST_TIMEOUT_MS = 5000

/** Reasons that mean the provider token was the problem, not the device. */
const TOKEN_REASONS = new Set(['ExpiredProviderToken', 'InvalidProviderToken'])

/** Reasons that mean the device token is dead for good. */
const GONE_REASONS = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'])

/**
 * APNs over HTTP/2 with token authentication — no SDK, for the reason
 * `ExpoPushSender` has none: it is one request shape and a signed header.
 *
 * One session per environment, opened on first use and reused. Apple asks for
 * exactly that — a connection per push is treated as abuse — and a ring cannot
 * afford a TLS handshake in front of it either. A session that errors or is
 * told to go away is dropped and the next push opens another.
 */
export class ApnsVoipSender implements VoipSender {
  readonly configured = true
  readonly #config: ApnsVoipConfig
  readonly #origins: Record<ApnsEnvironment, string>
  readonly #logger: VoipSenderLogger | undefined
  readonly #sessions = new Map<ApnsEnvironment, ClientHttp2Session>()
  #jwt: { value: string; mintedAt: number } | null = null

  /**
   * `origins` exists for the test, which answers as Apple from a local
   * server. Nothing else should ever pass it.
   */
  constructor(
    config: ApnsVoipConfig,
    logger?: VoipSenderLogger,
    origins: Record<ApnsEnvironment, string> = APNS_ORIGINS,
  ) {
    this.#config = config
    this.#logger = logger
    this.#origins = origins
  }

  async send(push: VoipPush): Promise<VoipResult> {
    try {
      let result = await this.#request(push, await this.#providerToken())
      /*
       * Once, with a fresh token. Apple's clock and ours can disagree about
       * whether forty minutes have passed, and a refused token is the one
       * failure that a second attempt actually fixes.
       */
      if (!result.ok && TOKEN_REASONS.has(result.reason)) {
        this.#jwt = null
        result = await this.#request(push, await this.#providerToken())
      }
      if (!result.ok && !result.gone) {
        this.#logger?.warn(
          { reason: result.reason, environment: push.environment },
          'apns refused a voip push',
        )
      }
      return result
    } catch (error) {
      // The network, or a key that will not import. Never the caller's
      // problem: the call still rings every other way it can.
      this.#logger?.warn({ err: error, environment: push.environment }, 'voip push failed')
      return { ok: false, gone: false, reason: 'TransportError' }
    }
  }

  close(): void {
    for (const session of this.#sessions.values()) session.close()
    this.#sessions.clear()
  }

  async #providerToken(): Promise<string> {
    const now = Date.now()
    if (this.#jwt && now - this.#jwt.mintedAt < JWT_LIFETIME_MS) return this.#jwt.value

    const key = await importPKCS8(this.#config.privateKeyPem, 'ES256')
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.#config.keyId })
      .setIssuer(this.#config.teamId)
      .setIssuedAt(Math.floor(now / 1000))
      .sign(key)
    this.#jwt = { value, mintedAt: now }
    return value
  }

  #session(environment: ApnsEnvironment): ClientHttp2Session {
    const open = this.#sessions.get(environment)
    if (open && !open.closed && !open.destroyed) return open

    const session = connect(this.#origins[environment])
    const forget = (): void => {
      if (this.#sessions.get(environment) === session) this.#sessions.delete(environment)
    }
    session.on('error', forget)
    session.on('goaway', forget)
    session.on('close', forget)
    // An idle connection to Apple must not be what keeps the process alive.
    session.unref()
    this.#sessions.set(environment, session)
    return session
  }

  #request(push: VoipPush, providerToken: string): Promise<VoipResult> {
    return new Promise((resolve, reject) => {
      const request = this.#session(push.environment).request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${push.token}`,
        authorization: `bearer ${providerToken}`,
        'apns-topic': `${this.#config.bundleId}.voip`,
        'apns-push-type': 'voip',
        // Immediately. A VoIP push at any other priority is refused.
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(push.expiresAt.getTime() / 1000)),
        'content-type': 'application/json',
      })

      let status = 0
      let body = ''
      request.setEncoding('utf8')
      request.setTimeout(REQUEST_TIMEOUT_MS, () => {
        request.close(constants.NGHTTP2_CANCEL)
        reject(new Error('apns request timed out'))
      })
      request.on('response', (headers) => {
        status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0)
      })
      request.on('data', (chunk: string) => {
        body += chunk
      })
      request.on('error', reject)
      request.on('end', () => {
        if (status === 200) {
          resolve({ ok: true })
          return
        }
        let reason = `HTTP ${status}`
        try {
          const parsed = JSON.parse(body) as { reason?: unknown }
          if (typeof parsed.reason === 'string') reason = parsed.reason
        } catch {
          // No body, or not JSON: the status is all there is to say.
        }
        resolve({ ok: false, gone: status === 410 || GONE_REASONS.has(reason), reason })
      })
      request.end(JSON.stringify(push.payload))
    })
  }
}

/**
 * The real sender when a key is configured, the stand-in otherwise.
 *
 * The team and bundle default to this app's own. They are settings only so a
 * fork that ships under another identity does not have to edit code to ring
 * its own phones.
 */
export function createVoipSender(env: Env, logger?: VoipSenderLogger): VoipSender {
  if (!env.APNS_KEY_ID || !env.APNS_PRIVATE_KEY) return new NotConfiguredVoipSender()
  return new ApnsVoipSender(
    {
      keyId: env.APNS_KEY_ID,
      teamId: env.APNS_TEAM_ID ?? APPLE_TEAM_ID,
      bundleId: env.APNS_BUNDLE_ID ?? IOS_BUNDLE_ID,
      privateKeyPem: env.APNS_PRIVATE_KEY,
    },
    logger,
  )
}
