import { Resend } from 'resend'
import type { Env } from '../env'
import type { InlineAsset } from './inlineAssets'
import { inlineAssetsFor } from './logo'

/**
 * Just enough of pino's `warn` to log structurally — kept narrow so this
 * module doesn't depend on the app's Fastify logger lifecycle. `createAuth`
 * needs an EmailSender before `buildApp` has constructed `app.log`.
 */
export interface EmailSenderLogger {
  warn(obj: Record<string, unknown>, msg: string): void
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  /**
   * `List-Unsubscribe` and its one-click companion, on every notification
   * mail. Gmail and Outlook draw their own unsubscribe control from these and
   * treat their absence as a spam signal on bulk sending — the link in the
   * footer satisfies the law, the header is what keeps the mail arriving.
   */
  headers?: Record<string, string>
  /**
   * Where a reply goes when the From address cannot take one. langx.io sends
   * from `hi@`, a mailbox a person reads, so nothing sets this here; a
   * deployment sending from a `no-reply@` still owes its campaigns somewhere
   * to land, since they are the mail that says "reply to this, it reaches a
   * human".
   */
  replyTo?: string
  /** Images for this one message, beside the shared ones. See `Email`. */
  attachments?: InlineAsset[]
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
  /**
   * Whether a message sent through this will actually reach a mailbox.
   *
   * `false` on `ConsoleEmailSender`, where every mail goes to the log. Almost
   * nothing needs to know — a verification mail that only reaches a log is a
   * self-host running as documented — but account deletion does: it is the one
   * flow that may not become unreachable because email is unconfigured, since
   * App Store 5.1.1(v) requires it in-app. See `POST /me/delete/request`.
   */
  readonly deliverable: boolean
  /**
   * Optional: only the campaign script sends enough at once to care, and a
   * sender that cannot batch is not broken, just slower. Resend takes 100 per
   * request, each item carrying its own recipient and headers — which it must,
   * since the unsubscribe token is per person.
   */
  sendBatch?(messages: EmailMessage[]): Promise<void>
}

/** Resend rejects a batch larger than this. */
export const EMAIL_BATCH_SIZE = 100

/**
 * Between two single sends: Resend's default is two requests a second, and
 * this stays under it. Enforced by the sender itself, so a caller sending a
 * list one message at a time — the campaign drip — need not know the rate.
 */
export const SINGLE_SEND_SPACING_MS = 600

/**
 * The provider refused this one message — the address, the body — and no
 * retry can change that. The campaign drip writes such a person off and moves
 * on; every other failure (rate limit, quota, outage) is retried later.
 *
 * The distinction exists because of 12–13 September 2026: one v1 row carried
 * an address with an invalid top-level domain, Resend rejected it, the drip
 * released the whole batch as "not sent", and the next tick mailed the
 * eighteen people before it again. Twenty-seven ticks later they had each
 * received the launch mail twenty-eight times.
 */
/**
 * Nothing on the `.invalid` TLD can ever be delivered — RFC 2606 reserves it
 * precisely so it never resolves — and this codebase mints such addresses on
 * purpose: `guest.langx.invalid` for anonymous accounts,
 * `official.langx.invalid` for the accounts nobody reads,
 * `handle.langx.invalid` when a sign-in names a handle that does not exist,
 * `internal.langx.invalid` for the boot warm-up, and `test.langx.invalid` for
 * the seeded rig.
 *
 * Handing one to the provider anyway is not free. SES accepts it, retries the
 * lookup for hours as `delivery_delayed`, and eventually writes a transient
 * bounce — against the reputation of the domain every real mail leaves from.
 * `sendVerificationEmail` learned this in #1304 and stopped mailing the
 * warm-up address, but that fixed one address rather than the class: the
 * seeded test accounts kept receiving sign-in notices, streaks, token mail and
 * digests, nine of the last hundred sends on 19 September 2026.
 *
 * So the check belongs here, once, rather than in each of the callers that
 * would each have to remember. `onboardingReminder.ts` filters the same
 * addresses a step earlier, when choosing an audience, which stays worth doing
 * — it is cheaper to not build a letter than to drop it.
 */
export function isUndeliverableAddress(to: string): boolean {
  return /\.invalid$/i.test(to.trim())
}

export class EmailRejectedError extends Error {
  readonly to: string

  constructor(to: string, message: string) {
    super(message)
    this.name = 'EmailRejectedError'
    this.to = to
  }
}

/** Resend's error names for a message that is wrong rather than a service that is busy. */
const REJECTION_NAMES = new Set(['validation_error', 'invalid_parameter', 'missing_required_field'])

/**
 * The images a message shows, attached inline. See `inlineAssets.ts` for why
 * they are bytes in the mail rather than links to the site.
 */
function inlineAttachments(html: string, extra: InlineAsset[] = []) {
  const assets = [...inlineAssetsFor(html), ...extra.filter((asset) => html.includes(asset.cid))]
  return assets.length === 0
    ? {}
    : {
        attachments: assets.map((asset) => ({
          filename: asset.filename,
          content: Buffer.from(asset.base64, 'base64'),
          contentId: asset.cid,
          contentType: asset.contentType,
        })),
      }
}

export class ResendEmailSender implements EmailSender {
  readonly deliverable = true
  readonly #client: Resend
  readonly #from: string
  /** Optional so the existing tests can construct one with two arguments. */
  readonly #logger: EmailSenderLogger | undefined
  /** When the next single send may go, per `SINGLE_SEND_SPACING_MS`. */
  #nextSendAt = 0

  constructor(apiKey: string, from: string, logger?: EmailSenderLogger) {
    this.#client = new Resend(apiKey)
    this.#from = from
    this.#logger = logger
  }

  /** Logged rather than thrown: the address is synthetic by construction, and
   * a scheduler that crashed on one would stop delivering everybody else's. */
  #dropUndeliverable(to: string, subject: string): boolean {
    if (!isUndeliverableAddress(to)) return false
    this.#logger?.warn({ to, subject }, 'not sending: address is on the reserved .invalid TLD')
    return true
  }

  async send({
    to,
    subject,
    html,
    text,
    headers,
    replyTo,
    attachments,
  }: EmailMessage): Promise<void> {
    if (this.#dropUndeliverable(to, subject)) return

    const wait = this.#nextSendAt - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    this.#nextSendAt = Date.now() + SINGLE_SEND_SPACING_MS

    const { error } = await this.#client.emails.send({
      from: this.#from,
      to,
      subject,
      html,
      text,
      ...(headers ? { headers } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...inlineAttachments(html, attachments),
    })
    if (error) {
      const message = `Resend failed to send "${subject}" to ${to}: ${error.message}`
      if (REJECTION_NAMES.has(error.name)) throw new EmailRejectedError(to, message)
      throw new Error(message)
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<void> {
    messages = messages.filter(({ to, subject }) => !this.#dropUndeliverable(to, subject))
    if (messages.length === 0) return
    /*
     * The batch endpoint takes no attachments, so a message that carries an
     * inline image goes on its own, paced by `send`. A thrown error from this
     * path says nothing about which of the earlier messages went — which is
     * why the campaign drip no longer uses it and sends one at a time.
     */
    if (
      messages.some(
        (message) => Object.keys(inlineAttachments(message.html, message.attachments)).length > 0,
      )
    ) {
      for (const message of messages) await this.send(message)
      return
    }
    for (let index = 0; index < messages.length; index += EMAIL_BATCH_SIZE) {
      const batch = messages.slice(index, index + EMAIL_BATCH_SIZE)
      const { error } = await this.#client.batch.send(
        batch.map(({ to, subject, html, text, headers, replyTo }) => ({
          from: this.#from,
          to,
          subject,
          html,
          text,
          ...(headers ? { headers } : {}),
          ...(replyTo ? { replyTo } : {}),
        })),
      )
      // Thrown rather than logged: the caller claimed these recipients in the
      // ledger before sending, and only an error tells it to release them.
      if (error)
        throw new Error(`Resend failed to send a batch of ${batch.length}: ${error.message}`)
    }
  }
}

/**
 * Used whenever no mail may leave this process. The app still boots and every
 * auth flow is fully testable — the verification/reset link just lands in the
 * log instead of an inbox. This is what makes `pnpm dev` work before anyone
 * has gone and created a Resend account.
 *
 * `reason` is in the log line because there are now two ways to end up here
 * and they call for opposite responses: a missing key is something to set, a
 * non-production `NODE_ENV` is the protection working.
 */
export class ConsoleEmailSender implements EmailSender {
  readonly deliverable = false
  readonly #logger: EmailSenderLogger
  readonly #reason: string

  constructor(logger: EmailSenderLogger, reason = 'RESEND_API_KEY not set') {
    this.#logger = logger
    this.#reason = reason
  }

  send({ to, subject, text, headers }: EmailMessage): Promise<void> {
    this.#logger.warn(
      { to, subject, text, headers },
      `${this.#reason} — printing email instead of sending it`,
    )
    return Promise.resolve()
  }

  async sendBatch(messages: EmailMessage[]): Promise<void> {
    for (const message of messages) await this.send(message)
  }
}

/**
 * Only a production process sends mail, even when a key is right there.
 *
 * A development machine holds the real key on purpose — the campaign scripts
 * run from a laptop against the production database, and they need one. But
 * the same `.env` also names the development database, and `pnpm dev` starts
 * the full notification scheduler against it. On 19 September 2026 that
 * combination mailed sign-in notices, streaks and daily-pool mail from
 * `hi@langx.io` to the seeded fixture accounts, whose addresses cannot
 * resolve; the bounces landed on the reputation of the domain every real mail
 * leaves from. `isUndeliverableAddress` closed the fixture accounts. This
 * closes the rest of it — a person with a real address in `langx_dev` was
 * always one scheduler tick away from being mailed by somebody's laptop.
 *
 * `NODE_ENV` rather than the database name, because it is what a deployment
 * already sets (`fly.toml`, the `Dockerfile`) and what the production overlay
 * turns on for a script run against the live cluster. A self-hosted install
 * that leaves it at the default gets the log instead of the mail, and the log
 * line says so.
 */
export function createEmailSender(env: Env, logger: EmailSenderLogger): EmailSender {
  if (!env.RESEND_API_KEY) return new ConsoleEmailSender(logger)
  if (env.NODE_ENV !== 'production') {
    return new ConsoleEmailSender(logger, `NODE_ENV is "${env.NODE_ENV}", not "production"`)
  }
  return new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM, logger)
}
