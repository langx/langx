import type { SocialPlatform, SocialPostContent } from '@langx/shared'

/**
 * What every platform adapter is, and the few rules they share.
 *
 * One interface, `publish(post) → {id, url}`, so the scheduler neither knows
 * nor cares which platform it is talking to — and so a test can hand it a
 * recording double instead of four APIs.
 */

/** One row, as an adapter needs it. */
export interface SocialPublishInput {
  videoUrl: string
  coverUrl: string
  lang: string
  content: SocialPostContent
  firstComment: string | null
}

export interface SocialPublishResult {
  /** The platform's id for what was made: a media id, a video id, a TikTok publish id. */
  id: string
  /** Where it can be seen, when the platform says. A TikTok inbox draft has nowhere yet. */
  url: string | null
  /** Something the operator should know about a post that did go out. */
  note?: string | null
}

export interface SocialAdapter {
  platform: SocialPlatform
  publish(post: SocialPublishInput): Promise<SocialPublishResult>
}

/**
 * A publish that failed, and whether trying again could post twice.
 *
 * `retryable` is true only for a failure before anything was public — a
 * container that would not process, a token that would not refresh, a
 * download that broke. From the call that publishes onwards it is false: a
 * timeout there says nothing about whether the platform went ahead, and a
 * second copy of a day's video is worse than a missing one, which somebody
 * can post by hand.
 */
export class SocialPublishError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'SocialPublishError'
  }
}

/** Long enough to read on the panel, short enough not to carry a whole HTML error page. */
const ERROR_TEXT_LIMIT = 300

function describe(step: string, caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught)
  return `${step}: ${message}`.slice(0, ERROR_TEXT_LIMIT)
}

/** A step before anything is public. Failing it posted nothing. */
export async function beforePublishing<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (caught) {
    if (caught instanceof SocialPublishError) throw caught
    throw new SocialPublishError(describe(step, caught), true)
  }
}

/** The step that publishes, or one after it. Failing it may have posted. */
export async function whilePublishing<T>(step: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (caught) {
    if (caught instanceof SocialPublishError) throw caught
    throw new SocialPublishError(
      `${describe(step, caught)} — it may have posted: check the account before retrying`,
      false,
    )
  }
}

/**
 * A response's JSON, or an error naming what failed and what the platform
 * said. Never the URL: a token in a query string would be written to the row
 * and shown on the panel.
 */
export async function jsonOrThrow<T>(
  response: Response,
  what: string,
  parse: (text: string) => unknown = JSON.parse,
): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${what} answered ${response.status} ${body.slice(0, ERROR_TEXT_LIMIT)}`)
  }
  return parse(await response.text()) as T
}

/** The video's bytes, for the two platforms that will not fetch a URL themselves. */
export async function downloadVideo(
  fetch: typeof globalThis.fetch,
  url: string,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(2 * 60 * 1000) })
  if (!response.ok) throw new Error(`video download answered ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error('video download was empty')
  return bytes
}

export interface PollOptions {
  everyMs: number
  timeoutMs: number
  sleep: (ms: number) => Promise<void>
}

/**
 * Asks `check` until it returns something other than `undefined`, or the time
 * runs out — for the platforms that process a video after taking it. Counted
 * in asks rather than read off the clock, so a test's instant `sleep` runs
 * the same number of them.
 */
export async function pollUntil<T>(
  check: () => Promise<T | undefined>,
  { everyMs, timeoutMs, sleep }: PollOptions,
): Promise<T | undefined> {
  const asks = Math.max(1, Math.ceil(timeoutMs / everyMs))
  for (let ask = 1; ; ask++) {
    const answer = await check()
    if (answer !== undefined) return answer
    if (ask >= asks) return undefined
    await sleep(everyMs)
  }
}
