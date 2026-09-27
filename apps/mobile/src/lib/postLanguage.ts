import { isLanguageCode, type LanguageCode } from '@langx/shared'

/** The shape the profile DTO hands over: `code` is a bare string there. */
interface LearningEntry {
  code: string
  priority: number
}

/**
 * The languages you can post in, most important first.
 *
 * Sorted here rather than trusted, because the API returns `learning` in stored
 * array order — `profiles.ts` reads the field straight off the document — while
 * `priority` is what actually says which language matters most to you. The
 * profile screen already sorts for the same reason; the composer used to take
 * `learning[0]` and so could disagree with it about your own main language.
 *
 * `isLanguageCode` is doing two jobs at once: it drops a code this build has no
 * name for, and it is the only place `string` becomes `LanguageCode`. That
 * narrowing is why the composer can hand its choice to `createPost` without an
 * assertion.
 */
export function postLanguages(learning: readonly LearningEntry[] | undefined): LanguageCode[] {
  if (!learning) return []
  // Copied before sorting: `me.data` is React Query's cache, and sorting it in
  // place mutates what every other screen is reading.
  return [...learning]
    .sort((a, b) => a.priority - b.priority)
    .map((entry) => entry.code)
    .filter(isLanguageCode)
}

/**
 * Every language a post may be in: the ones you learn, most important first,
 * then the ones you speak.
 *
 * Wider than `postLanguages` because a moment — a post that asks for nothing —
 * may be in your own language: natives sharing their day is what learners come
 * to read. Asking for help stays learning-only, which the composer shows by
 * disabling the ask chips on a native-only language (`asksAllowedIn`) rather
 * than by quietly moving the text to another language.
 */
export function momentLanguages(
  learning: readonly LearningEntry[] | undefined,
  native: readonly { code: string }[] | undefined,
): LanguageCode[] {
  const learned = postLanguages(learning)
  const spoken = (native ?? [])
    .map((entry) => entry.code)
    .filter(isLanguageCode)
    .filter((code) => !learned.includes(code))
  // A language listed twice in `native` would be offered twice without this.
  return [...learned, ...new Set(spoken)]
}

/** Whether a post in `language` may ask for help: only in a language you learn. */
export function asksAllowedIn(
  language: string | undefined,
  learning: readonly LearningEntry[] | undefined,
): boolean {
  return !!language && postLanguages(learning).some((code) => code === language)
}

/**
 * Which language the composer is actually posting in.
 *
 * Takes `chosen` as a loose `string | null` on purpose: it is a *wish*, not a
 * fact. It comes from a tap the reader made earlier — possibly in a previous
 * session, possibly before they edited their learning languages, possibly under
 * a different account on the same phone. Any of those can leave it naming a
 * language that is no longer on offer, and the answer to all of them is the
 * same: fall back to the most important one rather than reconciling state.
 *
 * So the caller stores the wish and derives the answer every render. There is
 * nothing to keep in step, and nothing to go stale.
 */
export function resolvePostLanguage(
  languages: readonly LanguageCode[],
  chosen: string | null,
): LanguageCode | undefined {
  const wanted = languages.find((code) => code === chosen)
  return wanted ?? languages[0]
}
