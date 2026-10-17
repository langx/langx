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
 * Under the funnel it also answers the questions the redesign is judged by —
 * how many people come back on day 1, 7 and 30, how long a session lasts, and
 * how many reach activation — as their own HogQL queries. A query PostHog
 * refuses as malformed shows its error on its own card instead of taking the
 * funnel down with it; a bad key or project still stops the run.
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
 * Day-30 return can only be read for people who appeared more than 30 days
 * ago, so the cohorts look back further than a short window would: the default
 * 30-day page would otherwise show an empty column.
 */
const COHORT_DAYS = Math.max(DAYS, 90)

/**
 * The funnel itself, and the only thing here that is a product decision rather
 * than a query. It is the one in `apps/mobile/src/lib/analyticsEvents.ts`:
 * the steps the app was instrumented for, in the order somebody walks them.
 *
 * The wizard's own steps are in it because everything between the install and
 * the finished profile used to be one black box: five screens of questions
 * reported as a single number that only said how many people came out.
 * `photo` is deliberately not a step — it comes after the profile exists, so
 * `onboarding_completed` has already counted that account.
 *
 * The operator panel asks the same funnel — `apps/api/src/modules/admin/funnel.ts`
 * carries the list a second time, because that file is TypeScript and this one
 * is run by bare `node`, so neither can import the other. `funnel.test.ts`
 * reads this file off disk and fails if the two drift. Change both.
 *
 * `Application Installed` is the SDK's own and the only event that can count
 * an install that never reached a screen of ours. The last step is filtered to
 * a purchase that actually completed — the event also fires for a cancelled or
 * failed store sheet, and counting those as conversions would flatter the
 * number that matters most.
 */
const FUNNEL = [
  { event: 'Application Installed', label: 'Installed the app' },
  { event: 'welcome_chosen', label: 'Chose on the welcome screen' },
  { event: 'signup_submitted', label: 'Submitted a sign-up' },
  ...['languages', 'levels', 'about-you', 'handle'].map((step) => ({
    event: 'onboarding_step_completed',
    label: `Finished ${step}`,
    properties: [{ key: 'step', value: [step], operator: 'exact', type: 'event' }],
  })),
  { event: 'onboarding_completed', label: 'Finished onboarding' },
  { event: 'message_sent', label: 'Sent a message' },
  { event: 'paywall_viewed', label: 'Saw the paywall' },
  {
    event: 'purchase_finished',
    label: 'Bought a plan',
    properties: [{ key: 'outcome', value: ['purchased'], operator: 'exact', type: 'event' }],
  },
]

/**
 * The one breakdown, asked as its own query rather than as a `breakdownFilter`
 * on the funnel above: with a breakdown PostHog answers with one array per
 * group, and a reader that takes the first would quietly report a single
 * method's numbers as everybody's.
 *
 * `method` is the property worth splitting on, because it is two different
 * journeys — an email sign-up walks through an inbox and back, Google and
 * Apple never leave. It is the first thing to look at when the steps between
 * sign-up and the wizard lose people.
 */
const METHOD_SPLIT = `
  SELECT coalesce(nullIf(toString(properties.method), ''), 'not recorded') AS method,
         countIf(event = 'signup_submitted') AS submitted,
         countIf(event = 'onboarding_completed') AS finished
  FROM events
  WHERE event IN ('signup_submitted', 'onboarding_completed')`

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
/** A number, so nothing from the environment reaches the request URL as text. */
const PROJECT_ID = Number(PROJECT)
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

/**
 * `soft` is for the queries whose text is ours and not yet proven against the
 * live API: a 400 — PostHog's answer to HogQL it cannot parse — is thrown for
 * the caller to show on its own card. Every other failure, a wrong key above
 * all, still ends the run.
 */
async function query(body, { soft = false } = {}) {
  let response
  try {
    response = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
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
      response.status === 401 || response.status === 403
        ? '\nThat is the key. PostHog answers 403, not 401, for one it does not accept,\nwhich is why this line exists. It must be a *personal* API key rather than\nthe project write key, it must still be live, and PostHog scopes them — this\none needs read access to the project it is asking about.'
        : response.status === 404
          ? `\nA 404 is the project id: ${PROJECT_ID} is not a project on ${HOST}. It is the\nnumber in the project's own URL, and the region may be the other one.`
          : ''
    if (soft && response.status === 400) throw new Error(`PostHog answered 400. ${detail}`)
    return fail(`PostHog answered ${response.status}.${hint}\n\n${detail}`)
  }
  return response.json()
}

/** Rows for a HogQL query, as arrays in the order the SELECT names them. */
async function rows(sql, options) {
  const answer = await query({ kind: 'HogQLQuery', query: sql }, options)
  return answer.results ?? []
}

/** As `rows`, but a malformed query becomes `{ error }` instead of ending the run. */
async function softRows(sql) {
  try {
    return { rows: await rows(sql, { soft: true }) }
  } catch (error) {
    return { error: String(error.message).slice(0, 300) }
  }
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

/**
 * A label as it came back from PostHog, cut down to what a label can be.
 *
 * Every string drawn from a query is whatever some event once carried, and
 * this file is opened in a browser. Escaping it would be enough; allowing only
 * the characters a route file, a surface or a date is made of is enough
 * without having to be right about escaping, and it bounds the length too.
 * Anything outside the set is dropped rather than drawn — a label that loses a
 * character is a question somebody asks, which is the failure worth having.
 */
const label = (value) =>
  String(value ?? '')
    .replace(/[^A-Za-z0-9 ()[\]/._:@+-]/g, '')
    .slice(0, 80)
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
        `<li style="--w:${(Number(value) / top) * 100}%"><span>${escapeHtml(label(name))}</span><span class="n">${NUM.format(Number(value))}</span></li>`,
    )
    .join('')
}

function chart(days) {
  if (days.length === 0) return '<p class="empty">No events in this window</p>'
  const top = Math.max(...days.map(([, n]) => Number(n)), 1)
  const bars = days
    .map(
      ([day, n]) =>
        `<div class="bar" title="${escapeHtml(label(day))}: ${NUM.format(Number(n))}"><i style="height:${(Number(n) / top) * 100}%"></i></div>`,
    )
    .join('')
  return `<div class="plot">${bars}</div>
    <p class="axis"><span>${escapeHtml(label(days[0][0]))}</span><span>${NUM.format(top)} at the peak</span><span>${escapeHtml(label(days.at(-1)[0]))}</span></p>`
}

const since = `now() - INTERVAL ${DAYS} DAY`

/**
 * Who came back, by the week they first appeared.
 *
 * "First appeared" is PostHog's own `person.created_at`, and a person counts
 * only if they have looked at a screen in the app — the marketing sites share
 * this project and send no `$screen`. Day *N* means a screen view on exactly the
 * Nth calendar day after that one, so a cohort is measured on a day N only once
 * it is N days old: the `_base` counts are the people old enough to ask, and a
 * week too young for day 30 shows "not yet" rather than a rate of zero.
 *
 * Calendar days in the project's timezone, not 24-hour windows, which is what
 * the usual retention chart does too — the numbers are comparable with it.
 */
const COHORTS = `
  SELECT cohort,
         count() AS size,
         countIf(age >= 1) AS d1_base,
         countIf(age >= 1 AND d1_views > 0) AS d1,
         countIf(age >= 7) AS d7_base,
         countIf(age >= 7 AND d7_views > 0) AS d7,
         countIf(age >= 30) AS d30_base,
         countIf(age >= 30 AND d30_views > 0) AS d30
  FROM (
    SELECT person_id,
           toString(toStartOfWeek(min(person.created_at))) AS cohort,
           dateDiff('day', toDate(min(person.created_at)), toDate(now())) AS age,
           countIf(dateDiff('day', toDate(person.created_at), toDate(timestamp)) = 1) AS d1_views,
           countIf(dateDiff('day', toDate(person.created_at), toDate(timestamp)) = 7) AS d7_views,
           countIf(dateDiff('day', toDate(person.created_at), toDate(timestamp)) = 30) AS d30_views
    FROM events
    WHERE event = '$screen'
      AND timestamp >= now() - INTERVAL ${COHORT_DAYS} DAY
      AND person.created_at >= now() - INTERVAL ${COHORT_DAYS} DAY
    GROUP BY person_id
    LIMIT 1000000
  )
  GROUP BY cohort
  ORDER BY cohort
  LIMIT 100`

/**
 * Activation, as far as PostHog can see it: two messages sent and two received
 * within 72 hours of first appearing.
 *
 * **This is a proxy, and the page says so.** The goal is two two-way
 * *conversations*, and PostHog cannot count conversations: its events carry no
 * conversation id, deliberately (`docs/analytics.md` → _Never_). What it does
 * hold is every message sent and every message received while the app was
 * open. Two conversations that went both ways need at least two of each, so the
 * rule below is a necessary condition — it counts some people with one long
 * exchange — while `message_received` is a lower bound (a push read from the
 * lock screen is not seen), which counts some activated people out. The two
 * errors run in opposite directions and neither is measured. The exact figure
 * is on the server, in the ledger's mutual-conversation rows, and arrives with
 * the operator panel.
 *
 * Only people old enough to have had their 72 hours.
 */
const ACTIVATION = `
  SELECT cohort, count() AS size, countIf(sent >= 2 AND received >= 2) AS activated
  FROM (
    SELECT person_id,
           toString(toStartOfWeek(min(person.created_at))) AS cohort,
           countIf(event = 'message_sent' AND timestamp < person.created_at + INTERVAL 72 HOUR) AS sent,
           countIf(event = 'message_received' AND timestamp < person.created_at + INTERVAL 72 HOUR) AS received
    FROM events
    WHERE event IN ('$screen', 'message_sent', 'message_received')
      AND timestamp >= now() - INTERVAL ${COHORT_DAYS} DAY
      AND person.created_at >= now() - INTERVAL ${COHORT_DAYS} DAY
      AND person.created_at <= now() - INTERVAL 72 HOUR
    GROUP BY person_id
    HAVING countIf(event = '$screen') > 0
    LIMIT 1000000
  )
  GROUP BY cohort
  ORDER BY cohort
  LIMIT 100`

/**
 * One row per session: from its first event to its last.
 *
 * A session that ends in silence — the app killed, the phone locked — is cut
 * at its last event, and a session with one event has no length at all, so
 * those are left out rather than counted as zero seconds. The marketing sites
 * stamp their own surface and are excluded; server-side events carry no
 * session id and fall out of the second condition.
 */
const SESSIONS = `
  SELECT properties.$session_id AS sid,
         min(timestamp) AS started,
         dateDiff('second', min(timestamp), max(timestamp)) AS seconds
  FROM events
  WHERE timestamp >= ${since}
    AND coalesce(toString(properties.$session_id), '') != ''
    AND coalesce(toString(properties.langx_surface), '') NOT IN ('website', 'token-website')
  GROUP BY sid
  HAVING count() > 1
  LIMIT 1000000`

const [
  steps,
  active,
  screens,
  surfaces,
  methods,
  totals,
  cohorts,
  activation,
  sessionWeeks,
  sessionAll,
] = await Promise.all([
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
  rows(`${METHOD_SPLIT} AND timestamp >= ${since} GROUP BY method ORDER BY submitted DESC`),
  rows(
    `SELECT count() AS events, count(DISTINCT person_id) AS people
     FROM events WHERE timestamp >= ${since}`,
  ),
  softRows(COHORTS),
  softRows(ACTIVATION),
  softRows(
    `SELECT toString(toStartOfWeek(started)) AS week, count() AS sessions, quantile(0.5)(seconds) AS median
     FROM (${SESSIONS}) GROUP BY week ORDER BY week LIMIT 100`,
  ),
  softRows(`SELECT count() AS sessions, quantile(0.5)(seconds) AS median FROM (${SESSIONS})`),
])

// The number the split is for: of the people who started with this door, how
// many came out of the wizard with a profile.
const methodRows = methods.map(([method, submitted, finished]) => [
  `${method} (${NUM.format(Number(submitted))} started)`,
  Number(finished),
])

const [events = 0, people = 0] = totals[0] ?? []

/** A malformed query's own message, drawn where its answer would have been. */
const unanswered = (error) =>
  `<p class="empty">PostHog could not answer this one, and the rest of the page is unaffected: ${escapeHtml(error)}</p>`

/** "4m 12s": a session's length is read at a glance, not to the decimal. */
function duration(seconds) {
  const whole = Math.round(Number(seconds) || 0)
  return whole >= 60 ? `${Math.floor(whole / 60)}m ${whole % 60}s` : `${whole}s`
}

/**
 * A rate and the two numbers behind it. A cohort too young to have a day N has
 * no base for it, and says so: a dash would read as zero.
 */
const rate = (hit, base) =>
  base > 0
    ? `${percent(hit, base)} <span class="of">${NUM.format(hit)} of ${NUM.format(base)}</span>`
    : '<span class="of">not yet</span>'

function table(head, body) {
  const cells = (tag, values) => values.map((value) => `<${tag}>${value}</${tag}>`).join('')
  return `<table>
      <thead><tr>${cells('th', head)}</tr></thead>
      <tbody>${body.map((row) => `<tr>${cells('td', row)}</tr>`).join('')}</tbody>
    </table>`
}

function cohortCard(answer) {
  if (answer.error) return unanswered(answer.error)
  if (answer.rows.length === 0) return '<p class="empty">Nobody first appeared in this window</p>'
  return table(
    ['Week of', 'New', 'Day 1', 'Day 7', 'Day 30'],
    answer.rows.map(([week, size, d1Base, d1, d7Base, d7, d30Base, d30]) => [
      escapeHtml(label(week)),
      NUM.format(Number(size)),
      rate(Number(d1), Number(d1Base)),
      rate(Number(d7), Number(d7Base)),
      rate(Number(d30), Number(d30Base)),
    ]),
  )
}

function activationCard(answer) {
  if (answer.error) return unanswered(answer.error)
  if (answer.rows.length === 0) return '<p class="empty">Nobody has had their 72 hours yet</p>'
  const size = answer.rows.reduce((sum, row) => sum + Number(row[1]), 0)
  const activated = answer.rows.reduce((sum, row) => sum + Number(row[2]), 0)
  return `<p class="figure">${percent(activated, size)} <span class="of">${NUM.format(activated)} of ${NUM.format(size)}</span></p>
    ${table(
      ['Week of', 'People', 'Activated'],
      answer.rows.map(([week, weekSize, weekActivated]) => [
        escapeHtml(label(week)),
        NUM.format(Number(weekSize)),
        rate(Number(weekActivated), Number(weekSize)),
      ]),
    )}`
}

function sessionCard(weeks, all) {
  if (weeks.error || all.error) return unanswered(weeks.error ?? all.error)
  const [sessions = 0, median = 0] = all.rows[0] ?? []
  if (Number(sessions) === 0)
    return '<p class="empty">No sessions with more than one event in this window</p>'
  return `<p class="figure">${duration(median)} <span class="of">median, over ${NUM.format(Number(sessions))} sessions</span></p>
    ${table(
      ['Week of', 'Sessions', 'Median'],
      weeks.rows.map(([week, count, weekMedian]) => [
        escapeHtml(label(week)),
        NUM.format(Number(count)),
        duration(weekMedian),
      ]),
    )}`
}
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
      table { border-collapse: collapse; width: 100%; font-size: 14px; }
      th, td { text-align: start; padding: 6px 10px; font-variant-numeric: tabular-nums; }
      th { color: var(--muted); font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--border); }
      td { border-bottom: 1px solid var(--border); }
      tr:last-child td { border-bottom: 0; }
      .of { color: var(--faint); font-size: 12px; }
      .figure { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 12px; }
      .axis { display: flex; justify-content: space-between; color: var(--faint); font-size: 11px; margin: 8px 0 0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Funnel — last ${DAYS} days</h1>
      <p class="sub">PostHog project ${PROJECT_ID} · generated ${escapeHtml(new Date().toLocaleString())}</p>

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
        <h2>Coming back</h2>
        <p class="hint">
          By the week people first appeared (last ${COHORT_DAYS} days). Day N is a screen view
          on exactly the Nth day after the first; a week counts toward it once it is N days old
        </p>
        ${cohortCard(cohorts)}
      </section>

      <section class="card">
        <h2>Activation — a proxy</h2>
        <p class="hint">
          At least two messages sent and two received within 72 hours of first appearing, among
          people old enough to have had them. PostHog holds no conversation ids, so
          “two conversations” cannot be counted here: this over-counts one long exchange and
          under-counts replies read from a notification. The exact figure is on the server
        </p>
        ${activationCard(activation)}
      </section>

      <section class="card">
        <h2>Session length</h2>
        <p class="hint">
          First event to last, over sessions with more than one event, last ${DAYS} days. A
          session that ends in silence is cut at its last event
        </p>
        ${sessionCard(sessionWeeks, sessionAll)}
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
          <h2>Finished onboarding, by sign-up method</h2>
          <p class="hint">Email walks through an inbox; Google and Apple do not</p>
          <ul>${listRows(methodRows)}</ul>
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
for (const [name, answer] of [
  ['Coming back', cohorts],
  ['Activation', activation],
  ['Session length', sessionAll],
]) {
  if (answer.error) console.log(`  ${name}: not answered — ${answer.error.split('\n')[0]}`)
}
console.log(`  Written to file://${out}\n`)
