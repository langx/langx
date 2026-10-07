import { useState, type ReactElement } from 'react'
import { Turnstile } from '../components/Turnstile'

/**
 * Public by design — it sits in every page that shows the widget — and only
 * valid on the hostnames Cloudflare lists for it. Absent (local development,
 * a self-hosted instance), no widget is drawn and no token is sent, which a
 * server without the secret, or with `flags.captchaRequired` off, accepts.
 */
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY

/** Better Auth's captcha plugin reads the token from this header. */
const CAPTCHA_HEADER = 'x-captcha-response'

export interface Captcha {
  /** The Turnstile widget to place in the form, or `null` with no site key. */
  widget: ReactElement | null
  /**
   * Still waiting for the first token. The form holds its submit button for
   * this — usually a second or two, and invisible otherwise.
   */
  checking: boolean
  /** For a Better Auth call's `fetchOptions`: the token header, or no headers. */
  fetchOptions: { headers: Record<string, string> }
  /**
   * After every submit, successful or not. A token is single-use — the server
   * spent it checking the request — so the next attempt needs a new one.
   */
  reset: () => void
}

/**
 * Turnstile for the password forms: sign-up, sign-in and forgot-password.
 *
 * A widget that fails (a blocked script, a network that will not reach
 * Cloudflare) lets the form submit without a token rather than locking the
 * person out. Whether that request is then accepted is the server's call,
 * not this hook's: while `flags.captchaRequired` is off it is, and once it is
 * on the form shows `errors.captchaFailed` and `reset` gives the widget
 * another go.
 */
export function useCaptcha(): Captcha {
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  // Remounting is the reset: a new widget asks Cloudflare for a new token.
  const [round, setRound] = useState(0)

  if (!SITE_KEY) {
    return { widget: null, checking: false, fetchOptions: { headers: {} }, reset: () => {} }
  }

  return {
    widget: (
      <Turnstile
        key={round}
        siteKey={SITE_KEY}
        onToken={(next) => {
          setToken(next)
          setFailed(false)
        }}
        onExpire={() => setToken(null)}
        onError={() => setFailed(true)}
      />
    ),
    checking: token === null && !failed,
    fetchOptions: { headers: token ? { [CAPTCHA_HEADER]: token } : {} },
    reset: () => {
      setToken(null)
      setFailed(false)
      setRound((value) => value + 1)
    },
  }
}
