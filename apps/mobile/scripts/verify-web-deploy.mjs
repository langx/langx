/* global fetch, console */
/**
 * Proves a web deploy is actually serving: fetches the live index, finds the
 * entry bundle it references, and fetches that too.
 *
 * Exists because of 5 September 2026, when `app.langx.io` served a cached
 * `index.html` pointing at the previous build's fingerprinted bundle — which
 * the new deployment had replaced — and the page was a blank splash with a
 * 404 in the console. The deploy command had reported success. This runs
 * after every `deploy:web` and fails loudly instead.
 *
 * Runs against the custom domain by default, because that is what people
 * open; the `*.pages.dev` preview URL was fine that day and proved nothing.
 */
const host = process.argv[2] ?? 'https://app.langx.io'
const bust = `?verify=${Date.now()}`

const index = await fetch(`${host}/${bust}`, { headers: { 'cache-control': 'no-cache' } })
if (!index.ok) fail(`index answered ${index.status}`)
const html = await index.text()
const match = /_expo\/static\/js\/web\/entry-[a-z0-9]+\.js/.exec(html)
if (!match) fail('index does not reference an entry bundle')

const bundle = await fetch(`${host}/${match[0]}`)
const type = bundle.headers.get('content-type') ?? ''
if (!bundle.ok || !/javascript/.test(type)) {
  fail(
    `bundle ${match[0]} answered ${bundle.status} (${type}) — the edge is serving a stale index.html; purge app.langx.io in Cloudflare`,
  )
}
console.log(
  `ok: ${host} serves ${match[0]} (${bundle.status}, cf-cache-status ${index.headers.get('cf-cache-status') ?? 'n/a'})`,
)

function fail(message) {
  console.error(`web deploy check FAILED: ${message}`)
  process.exit(1)
}
