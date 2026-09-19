import type { Env } from '../../env'

/**
 * Where people stop, between installing the app and paying for it.
 *
 * The same question `scripts/insight.mjs` asks, moved inside the panel. That
 * script stays exactly where it is — it is the artefact that still answers
 * when the API is down, and the one you can run against a project this server
 * has never heard of — but "open a terminal in a checkout with the right
 * `.env`" is a high price for a number worth glancing at.
 *
 * **This is the private half and it may never cross over.** `docs/decisions.md`
 * → _The analytics dashboard is private_ draws the line: members, messages,
 * corrections, languages and streaks are publishable; conversion is not, ever.
 * Everything in this file is conversion. It is behind `requireAdmin` and it
 * has no business anywhere near `modules/insight/publicStats.ts`.
 *
 * ### The credential
 *
 * Its own environment variable, `POSTHOG_QUERY_API_KEY`, rather than the
 * `POSTHOG_PERSONAL_API_KEY` already here. That one is scoped `person:write`
 * for the purge, and `env.ts` says why the split is deliberate: a key that can
 * both read the whole project and delete people from it is the one credential
 * nobody wanted to exist. Adding `query:read` to the write key would have made
 * exactly that key. Two variables is the cost of keeping them apart, and an
 * instance that sets neither simply has no funnel — see `FunnelUnavailable`.
 */

/** PostHog's query API. Literals, for the reason `personDeleter.ts` gives. */
const HOSTS = { eu: 'https://eu.posthog.com', us: 'https://us.posthog.com' } as const

/**
 * The funnel itself — the one product decision in this file, and a copy of the
 * list in `scripts/insight.mjs`. `funnel.test.ts` reads that file off disk and
 * fails if the two drift, because two funnels that disagree are worse than one
 * that is in the wrong place.
 *
 * The steps are the ones `apps/mobile/src/lib/analyticsEvents.ts` instruments,
 * in the order somebody walks them. The wizard's own steps are in it because
 * everything between the install and the finished profile used to be one black
 * box. `Application Installed` is the SDK's own and the only event that can
 * count an install that never reached a screen of ours. The last step is
 * filtered to a purchase that completed — the event fires for a cancelled
 * store sheet too, and counting those would flatter the number that matters
 * most.
 */
export const FUNNEL_STEPS: readonly {
  event: string
  label: string
  properties?: { key: string; value: string[]; operator: 'exact'; type: 'event' }[]
}[] = [
  { event: 'Application Installed', label: 'Installed the app' },
  { event: 'welcome_chosen', label: 'Chose on the welcome screen' },
  { event: 'signup_submitted', label: 'Submitted a sign-up' },
  ...['languages', 'levels', 'about-you', 'handle'].map((step) => ({
    event: 'onboarding_step_completed',
    label: `Finished ${step}`,
    properties: [
      { key: 'step', value: [step], operator: 'exact' as const, type: 'event' as const },
    ],
  })),
  { event: 'onboarding_completed', label: 'Finished onboarding' },
  { event: 'message_sent', label: 'Sent a message' },
  { event: 'paywall_viewed', label: 'Saw the paywall' },
  {
    event: 'purchase_finished',
    label: 'Bought a plan',
    properties: [
      { key: 'outcome', value: ['purchased'], operator: 'exact' as const, type: 'event' as const },
    ],
  },
]

/**
 * The two windows the panel offers.
 *
 * Thirty days is what the script defaults to and what a decision gets made
 * against. All time is the other question — it is the only one that counts the
 * people who installed before whatever changed last month, and it is why the
 * top of the funnel looks so different in the two.
 */
export const FUNNEL_WINDOWS = ['30d', 'all'] as const
export type FunnelWindow = (typeof FUNNEL_WINDOWS)[number]

/**
 * Half an hour, and long by the standards of everything else here.
 *
 * A funnel over all time is a scan of every event the project has ever had —
 * seconds, sometimes tens of them, and PostHog rate-limits the query API. The
 * numbers move by the hour at most, so re-asking on every open of a screen
 * would buy nothing and would eventually get the key throttled.
 */
export const FUNNEL_TTL_MS = 30 * 60 * 1000

export interface FunnelStepResult {
  label: string
  count: number
}

export interface FunnelResult {
  window: FunnelWindow
  /** When PostHog answered — not when this was served out of the cache. */
  generatedAt: string
  steps: FunnelStepResult[]
}

/**
 * Why there is no funnel, in a shape the panel can render.
 *
 * `unconfigured` is a deployment without the key and is not an error: the app
 * boots and works without PostHog, the same way it does without email or
 * storage. `refused` and `unreachable` are PostHog saying no and PostHog not
 * answering, kept apart because the first is a key to fix and the second is a
 * wait.
 */
export interface FunnelUnavailable {
  window: FunnelWindow
  reason: 'unconfigured' | 'refused' | 'unreachable'
  detail: string
}

export type FunnelAnswer = FunnelResult | FunnelUnavailable

export function isFunnelUnavailable(answer: FunnelAnswer): answer is FunnelUnavailable {
  return 'reason' in answer
}

const memory = new Map<FunnelWindow, { at: number; answer: FunnelAnswer }>()

/** For the tests, and for anything that has just changed what it wants to read. */
export function forgetFunnel(): void {
  memory.clear()
}

export async function readFunnel(
  env: Env,
  window: FunnelWindow,
  now: Date = new Date(),
): Promise<FunnelAnswer> {
  const cached = memory.get(window)
  // A refusal is cached too. A key PostHog will not accept is not going to
  // start working within the half hour, and retrying it on every open of the
  // screen is how a throttle turns into a lockout.
  if (cached && now.getTime() - cached.at < FUNNEL_TTL_MS) return cached.answer

  const answer = await askPostHog(env, window, now)
  memory.set(window, { at: now.getTime(), answer })
  return answer
}

async function askPostHog(env: Env, window: FunnelWindow, now: Date): Promise<FunnelAnswer> {
  const key = env.POSTHOG_QUERY_API_KEY
  const project = env.POSTHOG_PROJECT_ID
  if (!key || !project) {
    return {
      window,
      reason: 'unconfigured',
      detail: 'POSTHOG_QUERY_API_KEY and POSTHOG_PROJECT_ID are not set on this instance.',
    }
  }

  let response: Response
  try {
    response = await fetch(`${HOSTS[env.POSTHOG_REGION]}/api/projects/${project}/query/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query: {
          kind: 'FunnelsQuery',
          // PostHog's own word for "since the beginning", so all time is one
          // query rather than a date this code would have to pick.
          dateRange: { date_from: window === 'all' ? 'all' : '-30d' },
          series: FUNNEL_STEPS.map(({ event, properties }) => ({
            kind: 'EventsNode',
            event,
            ...(properties ? { properties } : {}),
          })),
        },
      }),
    })
  } catch (error) {
    return {
      window,
      reason: 'unreachable',
      detail: error instanceof Error ? error.message : 'PostHog did not answer.',
    }
  }

  if (!response.ok) {
    // 403 rather than 401 is what PostHog answers for a key it does not
    // accept — the same trap `scripts/insight.mjs` and `personDeleter.ts` both
    // document. This one needs `query:read` on the project it is asking about.
    const body = await response.text().catch(() => '')
    return {
      window,
      reason: response.status === 401 || response.status === 403 ? 'refused' : 'unreachable',
      detail: `PostHog answered ${response.status}. ${body.slice(0, 200)}`.trim(),
    }
  }

  const answer = (await response.json()) as { results?: unknown }
  // A funnel with a breakdown answers with an array of arrays; this one has
  // none, so the steps are the top level. Handled anyway, because the shape
  // changing under a query that still looks right is the worst way to be wrong.
  const raw = Array.isArray(answer.results) ? answer.results : []
  const steps = (Array.isArray(raw[0]) ? raw[0] : raw) as { count?: unknown }[]

  return {
    window,
    generatedAt: now.toISOString(),
    steps: FUNNEL_STEPS.map(({ label }, i) => ({ label, count: Number(steps[i]?.count ?? 0) })),
  }
}
