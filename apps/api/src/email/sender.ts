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
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

class ResendEmailSender implements EmailSender {
  readonly #client: Resend
  readonly #from: string

  constructor(apiKey: string, from: string) {
    this.#client = new Resend(apiKey)
    this.#from = from
  }

  async send({ to, subject, html, text }: EmailMessage): Promise<void> {
    const { error } = await this.#client.emails.send({ from: this.#from, to, subject, html, text })
    if (error) {
      throw new Error(`Resend failed to send "${subject}" to ${to}: ${error.message}`)
    }
  }
}

/**
 * Used whenever RESEND_API_KEY is unset. The app still boots and every auth
 * flow is fully testable — the verification/reset link just lands in the log
 * instead of an inbox. This is what makes `pnpm dev` work before anyone has
 * gone and created a Resend account.
 */
class ConsoleEmailSender implements EmailSender {
  readonly #logger: EmailSenderLogger

  constructor(logger: EmailSenderLogger) {
    this.#logger = logger
  }

  send({ to, subject, text }: EmailMessage): Promise<void> {
    this.#logger.warn(
      { to, subject, text },
      'RESEND_API_KEY not set — printing email instead of sending it',
    )
    return Promise.resolve()
  }
}

export function createEmailSender(env: Env, logger: EmailSenderLogger): EmailSender {
  return env.RESEND_API_KEY
    ? new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM)
    : new ConsoleEmailSender(logger)
}
