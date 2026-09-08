/* global console, fetch */
/**
 * The private funnel, as one page, without opening PostHog.
 *
 *     pnpm insight            the last 30 days
 *     pnpm insight 90         a longer window
 *
 * PostHog answers the question `docs/decisions.md` chose it for — where in
 * install → onboarding → first conversation → paywall people stop — and
 * answers it through a dashboard that has to be assembled first. This asks the
 * same question over its query API and writes a single HTML file, so the
 * answer can be read the way `insight.langx.io` is read: numbers first, no
 * configuration.
 *
 * It is the opposite artefact from that page, and the difference is the whole
 * point of both. This one carries conversion, which is exactly what
 * `docs/decisions.md` → _The analytics dashboard is private_ says may never be
 * published. It writes to a temporary directory, never into the repository,
 * and the key it needs is a *read* key that stays on the machine that runs it.
 *
 * Needs, in the root `.env` or the environment (see `.env.example`):
 *
 *   POSTHOG_PERSONAL_API_KEY   PostHog → Settings → Personal API keys
 *   POSTHOG_PROJECT_ID         the number in the project's own URL
 *   POSTHOG_REGION             optional; `eu` (the default) or `us`
 *
 * A region rather than a host, and neither is a free-form URL. There are two
 * places this API exists, `docs/decisions.md` rejected self-hosting PostHog
 * outright, and a settable host would only ever be a way to send a personal
 * API key somewhere it was not meant to go — CodeQL called that request
 * forgery on the first push and was right. Note that neither is
 * `eu.i.posthog.com`: that is where the app *sends* events and it does not
 * serve this API.
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REGION = process.env.POSTHOG_REGION ?? 'eu'
const KEY = process.env.POSTHOG_PERSONAL_API_KEY
const PROJECT = process.env.POSTHOG_PROJECT_ID
const DAYS = Number(process.argv[2] ?? 30)

/**
 * The funnel itself, and the only thing here that is a product decision rather
 * than a query. It is the one in `apps/mobile/src/lib/analyticsEvents.ts`:
 * the steps the app was instrumented for, in the order somebody walks them.
 *
 * `Application Installed` is the SDK's own and the only event that can count
 * an install that never reached a screen of ours. The last step is filtered to
 * a purchase that actually completed — the event also fires for a cancelled or
 * failed store sheet, and counting those as conversions would flatter the
 * number that matters most.
 */
const FUNNEL = [
  { event: 'Application Installed', label: 'Installed the app' },
  { event: 'onboarding_completed', label: 'Finished onboarding' },
  { event: 'message_sent', label: 'Sent a message' },
  { event: 'paywall_viewed', label: 'Saw the paywall' },
  {
    event: 'purchase_finished',
    label: 'Bought a plan',
    properties: [{ key: 'outcome', value: ['purchased'], operator: 'exact', type: 'event' }],
  },
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!KEY || !PROJECT) {
  fail(
    'POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must be set.\n' +
      'Put them in the root .env — see .env.example. The key is a personal\n' +
      'read key from PostHog → Settings → Personal API keys, and it never\n' +
      'goes in the repository.',
  )
}
if (!/^\d+$/.test(PROJECT))
  fail(`POSTHOG_PROJECT_ID is the number in the project's URL, got ${PROJECT}`)
if (!Number.isInteger(DAYS) || DAYS < 1) fail(`Days must be a whole number, got ${process.argv[2]}`)

/**
 * Written out rather than looked up in a table, so what reaches `fetch` is a
 * literal in this file and not a string that arrived from outside it.
 */
const HOST =
  REGION === 'eu'
    ? 'https://eu.posthog.com'
    : REGION === 'us'
      ? 'https://us.posthog.com'
      : fail(`POSTHOG_REGION is 'eu' or 'us', got ${REGION}`)

async function query(body) {
  let response
  try {
    response = await fetch(`${HOST}/api/projects/${PROJECT}/query/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: body }),
    })
  } catch (error) {
    return fail(`Could not reach ${HOST}: ${error.message}`)
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400)
    const hint =
      response.status === 401
        ? '\nA 401 is the key: it must be a *personal* API key, not the project write key.'
        : response.status === 404
          ? `\nA 404 is the project id: ${PROJECT} is not a project on ${HOST}. It is the\nnumber in the project's own URL, and the region may be the other one.`
          : ''
    return fail(`PostHog answered ${response.status}.${hint}\n\n${detail}`)
  }
  return response.json()
}

/** Rows for a HogQL query, as arrays in the order the SELECT names them. */
async function rows(sql) {
  const answer = await query({ kind: 'HogQLQuery', query: sql })
  return answer.results ?? []
}

async function funnel() {
  const answer = await query({
    kind: 'FunnelsQuery',
    dateRange: { date_from: `-${DAYS}d` },
    series: FUNNEL.map(({ event, properties }) => ({
      kind: 'EventsNode',
      event,
      ...(properties ? { properties } : {}),
    })),
  })
  // A funnel with a breakdown answers with an array of arrays; this one has
  // none, so the steps are the top level. Handled anyway, because the shape
  // changing under a query that still looks right is the worst way to be wrong.
  const steps = Array.isArray(answer.results?.[0]) ? answer.results[0] : (answer.results ?? [])
  return FUNNEL.map(({ label }, i) => ({ label, count: Number(steps[i]?.count ?? 0) }))
}

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )
const NUM = new Intl.NumberFormat('en')
const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—')

function funnelRows(steps) {
  const first = steps[0]?.count ?? 0
  return steps
    .map((step, i) => {
      const previous = i === 0 ? step.count : steps[i - 1].count
      const width = first > 0 ? (step.count / first) * 100 : 0
      const drop =
        i === 0 ? 'the top of the funnel' : `${percent(step.count, previous)} of the step above`
      return `<li style="--w:${width}%">
          <span class="step">${escapeHtml(step.label)}</span>
          <span class="n">${NUM.format(step.count)}</span>
          <span class="meta">${escapeHtml(drop)}</span>
        </li>`
    })
    .join('')
}

function listRows(entries) {
  if (entries.length === 0) return '<li class="empty">Nothing in this window</li>'
  const top = Number(entries[0][1]) || 1
  return entries
    .map(
      ([name, value]) =>
        `<li style="--w:${(Number(value) / top) * 100}%"><span>${escapeHtml(name)}</span><span class="n">${NUM.format(Number(value))}</span></li>`,
    )
    .join('')
}

function chart(days) {
  if (days.length === 0) return '<p class="empty">No events in this window</p>'
  const top = Math.max(...days.map(([, n]) => Number(n)), 1)
  const bars = days
    .map(
      ([day, n]) =>
        `<div class="bar" title="${escapeHtml(day)}: ${NUM.format(Number(n))}"><i style="height:${(Number(n) / top) * 100}%"></i></div>`,
    )
    .join('')
  return `<div class="plot">${bars}</div>
    <p class="axis"><span>${escapeHtml(days[0][0])}</span><span>${NUM.format(top)} at the peak</span><span>${escapeHtml(days.at(-1)[0])}</span></p>`
}

const since = `now() - INTERVAL ${DAYS} DAY`

const [steps, active, screens, surfaces, totals] = await Promise.all([
  funnel(),
  rows(
    `SELECT toString(toDate(timestamp)) AS day, count(DISTINCT person_id) AS people
     FROM events WHERE timestamp >= ${since} GROUP BY day ORDER BY day`,
  ),
  rows(
    `SELECT properties.$screen_name AS screen, count() AS views
     FROM events WHERE event = '$screen' AND timestamp >= ${since}
     GROUP BY screen ORDER BY views DESC LIMIT 12`,
  ),
  // `langx_surface` is stamped by every build after it shipped, so events from
  // before it — and from a build still on somebody's phone — have none. They
  // are counted, under their own name, rather than dropped.
  rows(
    `SELECT coalesce(nullIf(toString(properties.langx_surface), ''), 'before this was stamped') AS surface,
            count(DISTINCT person_id) AS people
     FROM events WHERE timestamp >= ${since} GROUP BY surface ORDER BY people DESC`,
  ),
  rows(
    `SELECT count() AS events, count(DISTINCT person_id) AS people
     FROM events WHERE timestamp >= ${since}`,
  ),
])

const [events = 0, people = 0] = totals[0] ?? []
const bought = steps.at(-1)?.count ?? 0
const installed = steps[0]?.count ?? 0

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LangX — funnel (private)</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff; --fill: #f4f5f7; --border: #e8eaec; --text: #17191c;
        --muted: #62676d; --faint: #9aa1a7; --accent: #3b6cf6; --accent-soft: #e9f0fe;
        --warn: #c87820; --warn-bg: #fff6b6;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #101215; --fill: #191c20; --border: #262a2f; --text: #f1f3f5;
          --muted: #a0a7ae; --faint: #6d757d; --accent: #7d9bff; --accent-soft: #1c2740;
          --warn: #f9a63a; --warn-bg: #2a2213;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0; background: var(--bg); color: var(--text);
        font: 15px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .wrap { max-width: 900px; margin: 0 auto; padding: 28px 20px 64px; }
      h1 { font-size: 20px; margin: 0 0 2px; }
      .sub { color: var(--faint); font-size: 13px; margin: 0 0 20px; }
      .banner {
        background: var(--warn-bg); color: var(--warn); border-radius: 10px;
        padding: 10px 14px; font-size: 13px; margin-bottom: 20px;
      }
      .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
      @media (max-width: 700px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
      .tile { border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
      .tile dt { font-size: 13px; color: var(--muted); margin: 0 0 4px; }
      .tile dd { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
      .card { border: 1px solid var(--border); border-radius: 14px; padding: 18px; margin-bottom: 20px; }
      .card h2 { font-size: 15px; margin: 0 0 2px; }
      .card .hint { font-size: 13px; color: var(--faint); margin: 0 0 16px; }
      ul { list-style: none; margin: 0; padding: 0; }
      li { position: relative; display: flex; align-items: baseline; gap: 12px; padding: 8px 10px; border-radius: 6px; font-size: 14px; }
      li::before { content: ''; position: absolute; inset: 0 auto 0 0; width: var(--w, 0%); background: var(--accent-soft); border-radius: 6px; }
      li > * { position: relative; }
      /* The label takes the slack so every number lands on the same edge; the
         funnel's own rows name the step explicitly for the same reason. */
      li > span:first-child, .step { flex: 1; }
      .n { font-variant-numeric: tabular-nums; font-weight: 600; }
      .meta { color: var(--muted); font-size: 12px; min-width: 11em; text-align: right; }
      .empty { color: var(--faint); }
      .lists { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      @media (max-width: 700px) { .lists { grid-template-columns: 1fr; } }
      .plot { display: flex; align-items: flex-end; gap: 2px; height: 120px; }
      .bar { flex: 1; height: 100%; display: flex; align-items: flex-end; }
      .bar i { display: block; width: 100%; background: var(--accent); border-radius: 3px 3px 0 0; }
      .axis { display: flex; justify-content: space-between; color: var(--faint); font-size: 11px; margin: 8px 0 0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Funnel — last ${DAYS} days</h1>
      <p class="sub">PostHog project ${escapeHtml(PROJECT)} · generated ${escapeHtml(new Date().toLocaleString())}</p>

      <p class="banner">
        <strong>Private.</strong> This page carries conversion, which
        <code>docs/decisions.md</code> says may never be published. The public
        numbers are a different page, at insight.langx.io.
      </p>

      <dl class="tiles">
        <div class="tile"><dt>People</dt><dd>${NUM.format(Number(people))}</dd></div>
        <div class="tile"><dt>Events</dt><dd>${NUM.format(Number(events))}</dd></div>
        <div class="tile"><dt>Installs</dt><dd>${NUM.format(installed)}</dd></div>
        <div class="tile"><dt>Install → paid</dt><dd>${percent(bought, installed)}</dd></div>
      </dl>

      <section class="card">
        <h2>Where people stop</h2>
        <p class="hint">Each step counts the people who reached it, in order</p>
        <ul>${funnelRows(steps)}</ul>
      </section>

      <section class="card">
        <h2>Active people per day</h2>
        <p class="hint">Anyone who sent any event that day</p>
        ${chart(active)}
      </section>

      <div class="lists">
        <section class="card">
          <h2>Most seen screens</h2>
          <p class="hint">Route files, never an identifier</p>
          <ul>${listRows(screens)}</ul>
        </section>
        <section class="card">
          <h2>Where they are</h2>
          <p class="hint">People per surface</p>
          <ul>${listRows(surfaces)}</ul>
        </section>
      </div>
    </div>
  </body>
</html>
`

/**
 * A fresh directory per run, and a file only its owner can read.
 *
 * `mkdtemp` because a predictable name in a shared temp directory is a file
 * anybody on the machine can read — and this one holds conversion, which is
 * the whole reason the page says it must not be published. The 0600 is the
 * same sentence said twice, which is the right number of times for it.
 */
const out = join(mkdtempSync(join(tmpdir(), 'langx-insight-')), `funnel-${DAYS}d.html`)
writeFileSync(out, html, { mode: 0o600 })
console.log(`\n  ${steps.map((s) => `${s.label}: ${NUM.format(s.count)}`).join('\n  ')}\n`)
console.log(`  Written to file://${out}\n`)
