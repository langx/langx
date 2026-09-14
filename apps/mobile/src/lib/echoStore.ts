import { Platform } from 'react-native'
import {
  emptySnapshot,
  parseSnapshot,
  withPending,
  withoutPending,
  type EchoSnapshot,
  type PendingReview,
} from './echoSnapshot'

/**
 * Where the offline snapshot lives.
 *
 * `expo-file-system` on a phone and `localStorage` in a browser, because the
 * same build serves both and neither API exists on the other side. The rules
 * are in `echoSnapshot.ts`; this file is only the writing, which is why it is
 * separate — vitest cannot load a module that reaches `Platform`.
 *
 * **No new native module.** `expo-file-system` has been in the binary since
 * the meeting file and the deck export, so this ships over the air.
 * `docs/echo.md` assumed `expo-sqlite` and therefore a store build; a due
 * queue is ten cards, and a database for that would be a migration story
 * bought to hold less than one chat thread.
 *
 * Every function swallows its failures. A phone with no space left, a
 * private-mode browser that throws on `localStorage`, a file half-written by
 * a kill: none of that may stop somebody reviewing online, which is still the
 * ordinary case.
 */

const FILE_NAME = 'echo-offline.json'
/** One key, because a browser's storage is not enumerable per user. */
const WEB_KEY = 'langx.echo.offline'

async function readRaw(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(WEB_KEY) ?? null
    const { File, Paths } = await import('expo-file-system')
    const file = new File(Paths.document, FILE_NAME)
    return file.exists ? file.textSync() : null
  } catch {
    return null
  }
}

async function writeRaw(contents: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(WEB_KEY, contents)
      return
    }
    const { File, Paths } = await import('expo-file-system')
    const file = new File(Paths.document, FILE_NAME)
    if (!file.exists) file.create({ overwrite: true })
    file.write(contents)
  } catch {
    // Reviewing online still works. Nothing here is worth an alert.
  }
}

export async function readEchoSnapshot(): Promise<EchoSnapshot | null> {
  const raw = await readRaw()
  if (!raw) return null
  try {
    return parseSnapshot(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

async function update(
  change: (snapshot: EchoSnapshot) => EchoSnapshot,
  now: Date,
): Promise<EchoSnapshot> {
  const next = change((await readEchoSnapshot()) ?? emptySnapshot(now))
  await writeRaw(JSON.stringify(next))
  return next
}

/**
 * Keeps the queue the server just gave, for the next time there is no network.
 *
 * Called on every successful fetch rather than on a timer: the cheapest
 * moment to know the truth is the moment it arrives, and writing a few
 * kilobytes is not worth scheduling.
 */
export async function rememberEchoCards(
  cards: EchoSnapshot['cards'],
  now: Date = new Date(),
): Promise<void> {
  await update((snapshot) => ({ ...snapshot, cards, savedAt: now.toISOString() }), now)
}

/** The counts the tab draws, so it is not blank on a train. */
export async function rememberEchoSummary(
  summary: EchoSnapshot['summary'],
  now: Date = new Date(),
): Promise<void> {
  await update((snapshot) => ({ ...snapshot, summary }), now)
}

/** Holds grades that could not be sent, so leaving the app does not lose them. */
export async function rememberPendingReviews(
  reviews: readonly PendingReview[],
  now: Date = new Date(),
): Promise<void> {
  if (reviews.length === 0) return
  await update((snapshot) => withPending(snapshot, reviews), now)
}

/** Forgets the grades the server has accepted. */
export async function forgetPendingReviews(
  reviewIds: readonly string[],
  now: Date = new Date(),
): Promise<void> {
  if (reviewIds.length === 0) return
  await update((snapshot) => withoutPending(snapshot, reviewIds), now)
}
