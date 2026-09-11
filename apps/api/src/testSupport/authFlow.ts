import type { FastifyInstance } from 'fastify'
import type { EmailMessage, EmailSender } from '../email/sender'

/** Captures every email instead of sending it, so a test can pull the token/url out. */
export class CapturingEmailSender implements EmailSender {
  /** A test sender stands in for a real one, so the flows that check are exercised. */
  readonly deliverable = true
  readonly messages: EmailMessage[] = []

  send(message: EmailMessage): Promise<void> {
    this.messages.push(message)
    return Promise.resolve()
  }

  latestUrl(): string {
    const message = this.messages.at(-1)
    if (!message) throw new Error('no email was sent')
    const match = /https?:\/\/\S+/.exec(message.text)
    if (!match) throw new Error(`no URL found in email text: ${message.text}`)
    return match[0]
  }

  /** The `token` query parameter of the latest emailed link. */
  latestToken(): string {
    const token = new URL(this.latestUrl()).searchParams.get('token')
    if (!token) throw new Error(`no token in emailed link: ${this.latestUrl()}`)
    return token
  }
}

export function setCookieValue(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie']
  const cookies = Array.isArray(raw) ? raw : [raw]
  const sessionCookie = cookies.find(
    (c): c is string => typeof c === 'string' && c.includes('session_token'),
  )
  if (!sessionCookie) throw new Error(`no session cookie in response: ${JSON.stringify(raw)}`)
  return sessionCookie.split(';')[0] ?? ''
}

export interface SignedUpUser {
  userId: string
  email: string
  cookie: string
}

/**
 * Sign-up → verify (via the captured link, never a real inbox) → sign-in, in
 * one call. Every module past Faz 1 that needs an authenticated request in
 * tests goes through this rather than re-deriving the same three-endpoint
 * dance — see auth.test.ts for what each step actually asserts on its own.
 */
export async function signUpAndSignIn(
  app: FastifyInstance,
  emailSender: CapturingEmailSender,
  opts: { email: string; password: string; name: string },
): Promise<SignedUpUser> {
  const signUp = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: opts,
  })
  if (signUp.statusCode !== 200) {
    throw new Error(`sign-up failed (${signUp.statusCode}): ${signUp.body}`)
  }
  const userId = signUp.json<{ user: { id: string } }>().user.id

  /*
   * The token, not the link. The mailed link is a page in the app
   * (`app.langx.io/verify-email`) rather than this API's endpoint, precisely
   * so that the app is what spends the token — which is what this stands in
   * for.
   */
  const verify = await app.inject({
    method: 'GET',
    url: `/api/auth/verify-email?token=${encodeURIComponent(emailSender.latestToken())}`,
  })
  if (verify.statusCode >= 400) {
    throw new Error(`verify failed (${verify.statusCode}): ${verify.body}`)
  }

  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email: opts.email, password: opts.password },
  })
  if (signIn.statusCode !== 200) {
    throw new Error(`sign-in failed (${signIn.statusCode}): ${signIn.body}`)
  }

  return { userId, email: opts.email, cookie: setCookieValue(signIn) }
}
