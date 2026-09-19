/**
 * Takes the secrets out of a URL before it is written to a log line.
 *
 * Fastify logs the full request URL, query string included, and three of our
 * routes are reached by a link that carries a credential in it:
 *
 *   - `/account/delete/confirm?token=…` — spends once and ends an account
 *   - `/email/unsubscribe?token=…` — a signed claim about an address
 *   - `/webhooks/instagram?hub.verify_token=…` — Meta's subscription handshake
 *
 * None of those should sit in a log aggregator where everyone with production
 * access can read them. `hub_verify_token` is in the list because Meta sends
 * the same value twice, once dotted and once with an underscore.
 */
const SECRET_QUERY_PARAMS = [
  'token',
  'access_token',
  'hub.verify_token',
  'hub_verify_token',
] as const

export const REDACTED = 'REDACTED'

export function redactUrl(url: string): string {
  const mark = url.indexOf('?')
  if (mark === -1) return url

  const query = new URLSearchParams(url.slice(mark + 1))
  let redacted = false
  for (const name of SECRET_QUERY_PARAMS) {
    if (!query.has(name)) continue
    query.set(name, REDACTED)
    redacted = true
  }
  // Rebuilt only when something was actually taken out: `URLSearchParams`
  // re-encodes as it stringifies, and a log line that silently changes shape
  // on every request is harder to grep than one that does not.
  return redacted ? `${url.slice(0, mark)}?${query.toString()}` : url
}
