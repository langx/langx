/* global fetch, console, URL */
import { readFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'

/**
 * Proves a web deploy is actually serving: fetches the live index and every
 * script it references, and — when the build that was just uploaded is still
 * on disk — checks that the two lists are the same one.
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
 *
 * ### Nothing here knows what the entry bundle is called
 *
 * It used to. The check looked for `entry-<hash>.js` by name, and when the
 * entry module became `apps/mobile/index.ts` Expo started naming the bundle
 * after it — so the pattern matched nothing and four consecutive deploys went
 * red while the site was serving perfectly. A check that cries wolf is how the
 * next real failure gets waved through, which makes a false alarm here nearly
 * as expensive as a miss.
 *
 * So the name is never guessed now. `dist/index.html` is the build's own
 * statement of which bundles it wants — there is no separate manifest for a
 * web export, and this *is* the manifest — and the live index is checked
 * against it. That also closes a hole the name-matching version had: it asked
 * whether the live page loads *an* entry bundle, so an edge serving a stale
 * index whose old bundle still existed passed. This asks whether the live page
 * is **this** build, which is the question the incident was about.
 *
 * ### The comparison needs `--built`, and only `deploy:web` may pass it
 *
 * It is only meaningful seconds after an upload. `pnpm verify:web` on its own
 * is a documented way to ask whether the live site is healthy right now (see
 * `docs/release-runbook.md`), often from a checkout whose `dist/` is weeks
 * old or absent — and comparing against *that* reports a stale edge and sends
 * somebody to purge Cloudflare over a stale checkout. Guessing from whether
 * `dist/` exists gets that exactly wrong, which is what the first draft of
 * this did; the deploy is the only thing that knows the build is current, so
 * the deploy is what says so.
 *
 * Without the flag the check is "every script the live index references
 * loads", which still catches 5 September — the bundle that page wanted was
 * gone — and the success line says which of the two questions was answered. A
 * green line that does not say that is how the weaker check quietly becomes
 * the only one anybody runs.
 *
 * A flag rather than a path or a URL, deliberately: the note on `host` above
 * says why nothing that reaches `fetch` may come from the command line, and
 * a boolean reaches nothing.
 */

// The custom domain, fixed: it is the address people open, and the one the
// edge cache sits in front of. Not an argument — a URL from the command line
// is a request-forgery finding, and there is no second host worth checking.
const host = 'https://app.langx.io'

/** Set by `deploy:web`, which has just uploaded `dist/` and can vouch for it. */
const againstBuild = process.argv.includes('--built')

/** The build that `wrangler pages deploy` just uploaded. */
const builtIndex = new URL('../dist/index.html', import.meta.url)

// Five attempts over ~30s. Long enough for a rollout, short enough that a
// genuinely stale edge is not left sitting behind a green check.
const backoffMs = [3000, 6000, 9000, 12000]

/**
 * Every script the page loads, in the order it loads them.
 *
 * The order is part of the comparison rather than noise: these are a runtime,
 * a shared chunk and an entry, and a build that emitted them in a different
 * order is a different build.
 */
function scriptsIn(html) {
  return [...html.matchAll(/<script[^>]+src="(\/_expo\/static\/js\/[^"]+)"/g)].map((m) => m[1])
}

// Read eagerly, and refuse rather than degrade: with `--built` the upload has
// just happened, so a missing `dist/` is a broken deploy pipeline and not a
// checkout without one. Falling back to the weaker check here would report
// success for a deploy that uploaded nothing.
const expected = againstBuild ? scriptsIn(await readBuiltIndex()) : null

async function readBuiltIndex() {
  try {
    return await readFile(builtIndex, 'utf8')
  } catch {
    fail(
      '--built was passed but dist/index.html is missing. That flag means "the build ' +
        'in dist/ was just uploaded", so this is the deploy having uploaded nothing — ' +
        'run the export first. For a liveness check on its own, drop the flag.',
    )
  }
}

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
  `ok: ${host} serves ${outcome.scripts.length} script(s) including ${outcome.scripts.at(-1)}` +
    (expected ? ', matching the build just uploaded' : ' — liveness only, no build to compare') +
    ` (200, cf-cache-status ${outcome.cacheStatus})` +
    (outcome.attempts > 1 ? ` after ${outcome.attempts} attempts` : ''),
)

/**
 * One full index→scripts round trip. Returns `{ ok: true, … }` or a `reason`
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

  const scripts = scriptsIn(await index.text())
  if (scripts.length === 0) return { ok: false, reason: 'index references no scripts at all' }

  if (expected && scripts.join('\n') !== expected.join('\n')) {
    // The edge is answering with an index that is not the one just uploaded.
    // Naming the first difference rather than dumping both lists: the hashes
    // are 32 characters and only one of them usually moved.
    const mine = expected.find((src) => !scripts.includes(src)) ?? '(none)'
    const theirs = scripts.find((src) => !expected.includes(src)) ?? '(none)'
    return {
      ok: false,
      reason:
        `the live index is not the build just uploaded — it loads ${theirs} where dist/ has ${mine}; ` +
        'the edge is serving a stale index.html, purge app.langx.io in Cloudflare',
    }
  }

  for (const src of scripts) {
    const bundle = await fetch(`${host}${src}`)
    const type = bundle.headers.get('content-type') ?? ''
    if (!bundle.ok || !/javascript/.test(type)) {
      return {
        ok: false,
        reason: `${src} answered ${bundle.status} (${type}) — the index references a script the deployment does not have`,
      }
    }
  }

  return { ok: true, attempts, scripts, cacheStatus: index.headers.get('cf-cache-status') ?? 'n/a' }
}

function fail(message) {
  console.error(`web deploy check FAILED: ${message}`)
  process.exit(1)
}
