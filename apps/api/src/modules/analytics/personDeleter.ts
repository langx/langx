import type { Env } from '../../env'

/**
 * Deleting people from PostHog, which is the only thing this server ever asks
 * PostHog to do — events are sent from the app, never from here.
 *
 * `bulk_delete` takes distinct ids directly, so nothing has to look a person
 * up first. That matters more than it sounds: our distinct id is the Better
 * Auth user id in its string form, which is also `profiles._id`, so the id the
 * purge already holds is the id PostHog wants. A lookup step would have been
 * one more call that can fail between deleting an account and finishing the
 * job.
 */
export interface PersonDeleter {
  /** Up to `PERSON_DELETE_BATCH` distinct ids. Resolves only if PostHog accepted them. */
  deletePersons(distinctIds: readonly string[]): Promise<void>
}

/** PostHog's documented ceiling for one `bulk_delete` call. */
export const PERSON_DELETE_BATCH = 1000

/**
 * `eu.posthog.com`, not `eu.i.posthog.com`. The second is the ingestion host
 * the app sends events to and it does not serve this API; `scripts/insight.mjs`
 * resolves the same two literals the same way, and for the same reason — a
 * settable host is only ever a way to send a personal API key somewhere it was
 * not meant to go.
 */
const HOSTS = { eu: 'https://eu.posthog.com', us: 'https://us.posthog.com' } as const

export function createPostHogPersonDeleter(
  apiKey: string,
  projectId: string,
  region: 'eu' | 'us',
): PersonDeleter {
  return {
    async deletePersons(distinctIds) {
      if (distinctIds.length === 0) return
      const response = await fetch(
        `${HOSTS[region]}/api/projects/${projectId}/persons/bulk_delete/`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            distinct_ids: [...distinctIds],
            // The person alone is not what was promised. Events and recordings
            // are the data itself, and PostHog keeps them unless asked.
            delete_events: true,
            delete_recordings: true,
          }),
        },
      )
      // 202: queued. PostHog does the work asynchronously, out of hours on
      // Cloud, so accepted is the strongest answer this call can ever get and
      // the queue row is right to go once it arrives.
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        // A key without `person:write` answers 403 here, not 401 — the same
        // trap `scripts/insight.mjs` documents for the read key.
        throw new Error(`PostHog bulk_delete failed: ${response.status} ${body.slice(0, 200)}`)
      }
    },
  }
}

/**
 * `null` rather than a no-op object: the caller has to decide what an
 * unconfigured instance means, and here it means "leave the queue alone",
 * which is different from "there was nothing to do".
 */
export function createPersonDeleterFromEnv(env: Env): PersonDeleter | null {
  if (!env.POSTHOG_PERSONAL_API_KEY || !env.POSTHOG_PROJECT_ID) return null
  return createPostHogPersonDeleter(
    env.POSTHOG_PERSONAL_API_KEY,
    env.POSTHOG_PROJECT_ID,
    env.POSTHOG_REGION,
  )
}
