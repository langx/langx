import type { BetterAuthPlugin } from 'better-auth'
import { captcha } from 'better-auth/plugins'
import type { Db } from 'mongodb'
import type { Env } from '../env'
import { getAppConfig } from '../modules/appConfig/appConfig'

/** Where the client puts the Turnstile token. Better Auth's name, not ours. */
export const CAPTCHA_HEADER = 'x-captcha-response'

/**
 * The forms a bot is worth stopping at: the two that send mail to an address
 * somebody typed, and the one that tries passwords. Better Auth's own default
 * list, spelled out so the "is this a checked path" test below and the plugin
 * cannot drift apart.
 */
export const CAPTCHA_ENDPOINTS = ['/sign-up/email', '/sign-in/email', '/request-password-reset']

/**
 * Better Auth's `captcha` plugin with provider `cloudflare-turnstile`, made to
 * tolerate a missing token until the operator says otherwise.
 *
 * The plugin alone refuses any request to its endpoints that arrives without
 * an `x-captcha-response` header. Every build already installed — 2.9 and
 * older — sends none, so registering it bare would end email sign-up and
 * sign-in for all of them on the day the API deployed. Hence two stages:
 *
 * - `flags.captchaRequired` off (the default): a request **with** a token is
 *   handed to the plugin and a bad token is refused; a request **without** one
 *   passes as it always has.
 * - On: everything goes to the plugin, so a missing token is refused too.
 *
 * The switch is in the app config rather than here so that it can be thrown
 * the day `minVersion` moves everybody to a build that sends tokens, without
 * a deploy — and thrown back the same way if the widget turns out to fail
 * somewhere. See `docs/decisions.md` → _Turnstile on the password forms_.
 *
 * No secret, no plugin: an optional service degrades to the behaviour from
 * before it existed, as every other one here does.
 */
export function captchaPlugins(env: Env, db: Db): BetterAuthPlugin[] {
  if (!env.TURNSTILE_SECRET_KEY) return []
  return [
    gatedCaptcha({
      secretKey: env.TURNSTILE_SECRET_KEY,
      required: async () => (await getAppConfig(db)).flags.captchaRequired,
    }),
  ]
}

export function gatedCaptcha(options: {
  secretKey: string
  required: () => Promise<boolean>
}): BetterAuthPlugin {
  const inner = captcha({
    provider: 'cloudflare-turnstile',
    secretKey: options.secretKey,
    endpoints: CAPTCHA_ENDPOINTS,
  })
  const verify = inner.onRequest
  return {
    ...inner,
    onRequest: async (request, ctx) => {
      if (!request.headers.get(CAPTCHA_HEADER)) {
        // Only a checked path costs a config read: this runs on every auth
        // request, `get-session` included, and those must not wait on Mongo.
        if (!isCaptchaPath(request.url)) return
        if (!(await options.required())) return
      }
      return verify(request, ctx)
    },
  }
}

/**
 * The plugin's own path test, loosely: it strips the base path and compares
 * exactly, and that base path is only known inside the request. A suffix test
 * on the normalised path answers the same question without it — none of the
 * three can be the tail of some other Better Auth route.
 */
function isCaptchaPath(url: string): boolean {
  const pathname = new URL(url).pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  return CAPTCHA_ENDPOINTS.some((endpoint) => pathname.endsWith(endpoint))
}
