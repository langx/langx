import { Resend } from 'resend'
import type { Env } from '../env'
import { LOGO_CID, LOGO_FILENAME, LOGO_SRC, logoPng } from './logo'

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
   * Where a reply goes when the sender is `no-reply@`. Only campaigns set
   * it: they are the mail that says "reply to this, it reaches a human", and
   * from the app's transactional address that would be a lie.
   */
  replyTo?: string
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
 * Between two single sends inside a batch that could not go as one: Resend's
 * default is two requests a second, and this stays under it.
 */
const SINGLE_SEND_SPACING_MS = 600

/**
 * The logo, attached inline to any message whose HTML shows it. See
 * `logo.ts` for why it is bytes in the mail rather than a link to the site.
 */
function inlineLogo(html: string) {
  return html.includes(LOGO_SRC)
    ? {
        attachments: [
          {
            filename: LOGO_FILENAME,
            content: logoPng(),
            contentId: LOGO_CID,
            contentType: 'image/png',
          },
        ],
      }
    : {}
}

export class ResendEmailSender implements EmailSender {
  readonly deliverable = true
  readonly #client: Resend
  readonly #from: string

  constructor(apiKey: string, from: string) {
    this.#client = new Resend(apiKey)
    this.#from = from
  }

  async send({ to, subject, html, text, headers, replyTo }: EmailMessage): Promise<void> {
    const { error } = await this.#client.emails.send({
      from: this.#from,
      to,
      subject,
      html,
      text,
      ...(headers ? { headers } : {}),
      ...(replyTo ? { replyTo } : {}),
      ...inlineLogo(html),
    })
    if (error) {
      throw new Error(`Resend failed to send "${subject}" to ${to}: ${error.message}`)
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<void> {
    /*
     * The batch endpoint takes no attachments, so a message that carries the
     * logo goes on its own. Slower — one request per person rather than per
     * hundred — and the only caller is the campaign drip, which sends a few
     * dozen a tick and has the whole half hour to do it in. A thrown error
     * still means "release everything not yet sent": the claim was for the
     * whole batch, and the caller cannot tell which of these went.
     */
    if (messages.some((message) => message.html.includes(LOGO_SRC))) {
      for (const [index, message] of messages.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, SINGLE_SEND_SPACING_MS))
        await this.send(message)
      }
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
