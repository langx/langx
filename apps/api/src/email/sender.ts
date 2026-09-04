import { Resend } from 'resend'
import type { Env } from '../env'

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

export class ResendEmailSender implements EmailSender {
  readonly deliverable = true
  readonly #client: Resend
  readonly #from: string

  constructor(apiKey: string, from: string) {
    this.#client = new Resend(apiKey)
    this.#from = from
  }

  async send({ to, subject, html, text, headers }: EmailMessage): Promise<void> {
    const { error } = await this.#client.emails.send({
      from: this.#from,
      to,
      subject,
      html,
      text,
      ...(headers ? { headers } : {}),
    })
    if (error) {
      throw new Error(`Resend failed to send "${subject}" to ${to}: ${error.message}`)
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<void> {
    for (let index = 0; index < messages.length; index += EMAIL_BATCH_SIZE) {
      const batch = messages.slice(index, index + EMAIL_BATCH_SIZE)
      const { error } = await this.#client.batch.send(
        batch.map(({ to, subject, html, text, headers }) => ({
          from: this.#from,
          to,
          subject,
          html,
          text,
          ...(headers ? { headers } : {}),
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
 * Used whenever RESEND_API_KEY is unset. The app still boots and every auth
 * flow is fully testable — the verification/reset link just lands in the log
 * instead of an inbox. This is what makes `pnpm dev` work before anyone has
 * gone and created a Resend account.
 */
export class ConsoleEmailSender implements EmailSender {
  readonly deliverable = false
  readonly #logger: EmailSenderLogger

  constructor(logger: EmailSenderLogger) {
    this.#logger = logger
  }

  send({ to, subject, text, headers }: EmailMessage): Promise<void> {
    this.#logger.warn(
      { to, subject, text, headers },
      'RESEND_API_KEY not set — printing email instead of sending it',
    )
    return Promise.resolve()
  }

  async sendBatch(messages: EmailMessage[]): Promise<void> {
    for (const message of messages) await this.send(message)
  }
}

export function createEmailSender(env: Env, logger: EmailSenderLogger): EmailSender {
  return env.RESEND_API_KEY
    ? new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM)
    : new ConsoleEmailSender(logger)
}
