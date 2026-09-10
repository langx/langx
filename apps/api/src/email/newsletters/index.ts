import type { Locale } from '@langx/shared'

/**
 * The editorial half of the monthly recap: what shipped, in the writer's own
 * words, in eight languages.
 *
 * One file per month, `YYYY-MM.ts`, drafted from the repository's own history
 * by a scheduled routine, opened as a pull request, edited by a person and
 * **merged** — the merge is the approval, and no merge means no editorial
 * block that month. The recap still goes out: the numbers are the part that
 * is always true.
 *
 * A registry rather than a directory read at runtime, because the API ships
 * as one bundled `dist/index.js` with no files beside it — the same reason
 * the images are inlined.
 */
export interface NewsletterNote {
  headline: string
  items: { title: string; body: string }[]
  /** An optional closing line from whoever wrote it. */
  note?: string
}

export type LocalizedNote = Partial<Record<Locale, NewsletterNote>> & { en: NewsletterNote }

/** Every month that has a note. Add the import and the entry together. */
const NOTES: Record<string, LocalizedNote> = {}

/**
 * The note for a month in the reader's language, falling back to English —
 * which is the one language every note has, because the routine writes it
 * first and translates from it.
 */
export function noteFor(month: string, locale: Locale): NewsletterNote | null {
  const note = NOTES[month]
  if (!note) return null
  return note[locale] ?? note.en
}
