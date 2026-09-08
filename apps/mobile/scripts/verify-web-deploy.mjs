/* global fetch, console */
import { setTimeout as sleep } from 'node:timers/promises'

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
 * Runs against the custom domain, because that is what people open; the
 * `*.pages.dev` preview URL was fine that day and proved nothing.
 *
 * It retries, because the check runs about a second after `wrangler pages
 * deploy` prints "Deployment complete" and Cloudflare has not finished moving
 * the domain onto the new deployment by then. In that window the edge answers
 * with the *previous* index.html, whose bundle the new deployment has already
 * replaced — which looks exactly like the 5 September incident and is not it.
 * That cost two red runs on 7 September, both on a deploy that was fine; the
 * third attempt, minutes later, passed against the same commit.
 *
 * The distinction the retries have to preserve: a stale index that clears
 * within seconds of a deploy is propagation, and a stale index that is still
 * there half a minute later is the incident. So the window is bounded and the
 * failure at the end of it is the original one, unsoftened.
 */
// The custom domain, fixed: it is the address people open, and the one the
// edge cache sits in front of. Not an argument — a URL from the command line
// is a request-forgery finding, and there is no second host worth checking.
const host = 'https://app.langx.io'

// Five attempts over ~30s. Long enough for a rollout, short enough that a
// genuinely stale edge is not left sitting behind a green check.
const backoffMs = [3000, 6000, 9000, 12000]

let attempts = 0
let outcome
for (let attempt = 0; ; attempt++) {
  outcome = await check()
  if (outcome.ok || attempt === backoffMs.length) break
  console.log(`web deploy check: ${outcome.reason} — retrying in ${backoffMs[attempt] / 1000}s`)
  await sleep(backoffMs[attempt])
}

if (!outcome.ok) fail(outcome.reason)

console.log(
  `ok: ${host} serves ${outcome.bundle} (200, cf-cache-status ${outcome.cacheStatus})` +
    (outcome.attempts > 1 ? ` after ${outcome.attempts} attempts` : ''),
)

/**
 * One full index→bundle round trip. Returns `{ ok: true, … }` or a `reason`
 * worded for the final failure, since that is where it ends up if the window
 * runs out.
 */
async function check() {
  attempts++
  // A fresh buster per attempt: reusing one URL would let a retry be answered
  // from whatever the first attempt just put in a cache, which is the one
  // thing these retries must not do.
  const index = await fetch(`${host}/?verify=${Date.now()}`, {
    headers: { 'cache-control': 'no-cache' },
  })
  if (!index.ok) return { ok: false, reason: `index answered ${index.status}` }

  const html = await index.text()
  const match = /_expo\/static\/js\/web\/entry-[a-z0-9]+\.js/.exec(html)
  if (!match) return { ok: false, reason: 'index does not reference an entry bundle' }

  const bundle = await fetch(`${host}/${match[0]}`)
  const type = bundle.headers.get('content-type') ?? ''
  if (!bundle.ok || !/javascript/.test(type)) {
    return {
      ok: false,
      reason: `bundle ${match[0]} answered ${bundle.status} (${type}) — the edge is serving a stale index.html; purge app.langx.io in Cloudflare`,
    }
  }

  return {
    ok: true,
    attempts,
    bundle: match[0],
    cacheStatus: index.headers.get('cf-cache-status') ?? 'n/a',
  }
}

function fail(message) {
  console.error(`web deploy check FAILED: ${message}`)
  process.exit(1)
}
