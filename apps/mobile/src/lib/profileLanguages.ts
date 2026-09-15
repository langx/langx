import { languageCapAllows, type LanguageLevel } from '@langx/shared'

/**
 * The two language lists, and every edit the languages screen can make to
 * them, as data rather than as handlers.
 *
 * Here rather than in the screen because none of it can be tested there —
 * mobile's vitest cannot import `react-native`, so anything inside a component
 * is unreachable — and because the screen is not the only thing that has to
 * agree with it: the mutation asks the same questions of the cache before it
 * draws and of the profile before it writes.
 *
 * Every edit is applied exactly once. `useEditLanguages` used to apply it
 * twice — to the cache for the eye, then to that same cache for the wire —
 * which added a language as two rows and turned every other edit into a
 * request that was never sent. The guards below make the first of those
 * impossible from here as well: adding or replacing with a language already
 * on the list changes nothing rather than duplicating it.
 *
 * No copy lives here. A refusal is named, not worded; the screen owns the
 * sentence, because that is the file `en.ts` is typed against.
 */
export interface LanguageLists {
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
}

export type LanguageEdit =
  | { kind: 'replaceNative'; from: string; to: string }
  | { kind: 'addNative'; code: string }
  | { kind: 'removeNative'; code: string }
  | { kind: 'replaceLearning'; from: string; to: string }
  | { kind: 'addLearning'; code: string }
  | { kind: 'removeLearning'; code: string }
  | { kind: 'setLevel'; code: string; level: LanguageLevel }
  | { kind: 'moveLearning'; code: string; direction: 'up' | 'down' }

/** Which list an edit is about, in the vocabulary `PLAN_LIMITS` uses. */
export type LanguageListName = 'nativeLanguages' | 'learningLanguages'

export type LanguageRefusal =
  /** The plan holds `max`, and this edit would ask for one more. */
  | { kind: 'cap'; list: LanguageListName; max: number }
  /** The language is on the other list, and nothing may be on both. */
  | { kind: 'overlap'; code: string }
  /** Already on this list. */
  | { kind: 'duplicate'; code: string }
  /** The last one of a list, which must keep at least one. */
  | { kind: 'last'; list: LanguageListName }
  /** Nothing to do: the top row moved up, a language replaced by itself. */
  | { kind: 'noop' }

export interface LanguageCaps {
  maxNativeLanguages: number
  maxLearningLanguages: number
}

/** What a newly added language starts at, before anybody says otherwise. */
export const NEW_LANGUAGE_LEVEL: LanguageLevel = 'absoluteBeginner'

function nativeCodes(lists: LanguageLists): string[] {
  return lists.nativeLanguages.map((l) => l.code)
}

function learningCodes(lists: LanguageLists): string[] {
  return lists.learning.map((l) => l.code)
}

/**
 * Why an edit cannot be made, or `null` if it can.
 *
 * Asked before anything is drawn as well as before anything is sent, so that
 * no control is dimmed without a sentence next to it. The cap case defers to
 * `languageCapAllows` — the same function the server refuses with — so the
 * screen can never offer a language the write would then reject, nor withhold
 * one it would have accepted.
 */
export function refuseLanguageEdit(
  lists: LanguageLists,
  edit: LanguageEdit,
  caps: LanguageCaps,
): LanguageRefusal | null {
  switch (edit.kind) {
    case 'addNative':
      return (
        onOtherList(lists, edit.code, 'nativeLanguages') ??
        alreadyHere(nativeCodes(lists), edit.code) ??
        roomForAnother(lists, 'nativeLanguages', caps)
      )
    case 'addLearning':
      return (
        onOtherList(lists, edit.code, 'learningLanguages') ??
        alreadyHere(learningCodes(lists), edit.code) ??
        roomForAnother(lists, 'learningLanguages', caps)
      )
    /*
     * A replacement never touches the count, so it never touches the cap —
     * which is the whole point of the row-based flow. A plan allowing one
     * native language still allows changing which one it is, in a single
     * write, without a moment in between where the profile has none.
     */
    case 'replaceNative':
      if (edit.from === edit.to) return { kind: 'noop' }
      return (
        onOtherList(lists, edit.to, 'nativeLanguages') ?? alreadyHere(nativeCodes(lists), edit.to)
      )
    case 'replaceLearning':
      if (edit.from === edit.to) return { kind: 'noop' }
      return (
        onOtherList(lists, edit.to, 'learningLanguages') ??
        alreadyHere(learningCodes(lists), edit.to)
      )
    case 'removeNative':
      return lists.nativeLanguages.length <= 1 ? { kind: 'last', list: 'nativeLanguages' } : null
    case 'removeLearning':
      return lists.learning.length <= 1 ? { kind: 'last', list: 'learningLanguages' } : null
    case 'setLevel': {
      const entry = lists.learning.find((l) => l.code === edit.code)
      return entry === undefined || entry.level === edit.level ? { kind: 'noop' } : null
    }
    case 'moveLearning': {
      const index = ordered(lists).findIndex((l) => l.code === edit.code)
      if (index === -1) return { kind: 'noop' }
      const target = edit.direction === 'up' ? index - 1 : index + 1
      return target < 0 || target >= lists.learning.length ? { kind: 'noop' } : null
    }
  }
}

function onOtherList(
  lists: LanguageLists,
  code: string,
  list: LanguageListName,
): LanguageRefusal | null {
  const other = list === 'nativeLanguages' ? learningCodes(lists) : nativeCodes(lists)
  return other.includes(code) ? { kind: 'overlap', code } : null
}

function alreadyHere(codes: string[], code: string): LanguageRefusal | null {
  return codes.includes(code) ? { kind: 'duplicate', code } : null
}

/**
 * Whether one more would fit, asked without naming a language.
 *
 * The screen asks before it opens the picker, so that "Add a language" either
 * opens it or says why it cannot — rather than leading somebody through a
 * hundred and eighty chips to a refusal at the end.
 */
export function roomForAnother(
  lists: LanguageLists,
  list: LanguageListName,
  caps: LanguageCaps,
): LanguageRefusal | null {
  const was = list === 'nativeLanguages' ? lists.nativeLanguages.length : lists.learning.length
  const max = list === 'nativeLanguages' ? caps.maxNativeLanguages : caps.maxLearningLanguages
  return languageCapAllows(was + 1, was, max) ? null : { kind: 'cap', list, max }
}

/** Already carrying more than the plan holds — grandfathered, not upgradable. */
export function isOverCap(
  lists: LanguageLists,
  list: LanguageListName,
  caps: LanguageCaps,
): boolean {
  const has = list === 'nativeLanguages' ? lists.nativeLanguages.length : lists.learning.length
  const max = list === 'nativeLanguages' ? caps.maxNativeLanguages : caps.maxLearningLanguages
  return has > max
}

/**
 * The learning list in the order its priorities claim.
 *
 * Stored order and priority order are two statements about the same thing and
 * nothing has ever forced them to agree, so the one that survives a round trip
 * is the one to trust. Sorted on the way in, renumbered on the way out.
 */
function ordered(lists: LanguageLists): LanguageLists['learning'] {
  return [...lists.learning].sort((a, b) => a.priority - b.priority)
}

/** 1..n from the array's own order, so a reorder is a fact rather than a hint. */
function renumbered(learning: LanguageLists['learning']): LanguageLists['learning'] {
  return learning.map((entry, index) => ({ ...entry, priority: index + 1 }))
}

/**
 * The lists as they are after an edit. Pure: the input is never touched.
 *
 * An edit naming a language that is no longer there returns the lists
 * unchanged rather than inventing one. That is not defensive padding — it is
 * the shape of a queued second tap whose first tap was refused and rolled
 * back, and the mutation reads "nothing changed" as "send nothing".
 */
export function applyLanguageEdit(lists: LanguageLists, edit: LanguageEdit): LanguageLists {
  const native = lists.nativeLanguages
  const learning = ordered(lists)

  switch (edit.kind) {
    /*
     * An add of something already on the list returns the list, rather than a
     * second copy of it. `refuseLanguageEdit` has already said no to that, so
     * nothing reaches here by the front door — this is the back one: a list is
     * a set, and a function that can produce two rows for one language is one
     * mistake in a caller away from producing them.
     */
    case 'addNative':
      return nativeCodes(lists).includes(edit.code)
        ? { nativeLanguages: native, learning: renumbered(learning) }
        : { nativeLanguages: [...native, { code: edit.code }], learning: renumbered(learning) }
    case 'removeNative':
      return {
        nativeLanguages: native.filter((l) => l.code !== edit.code),
        learning: renumbered(learning),
      }
    /*
     * The same guard on the other side of a replacement: replacing a language
     * with one already on the list would leave two rows of it and one fewer
     * language. Refused before it is offered; here, it simply does not happen.
     */
    case 'replaceNative':
      return {
        nativeLanguages: nativeCodes(lists).includes(edit.to)
          ? native
          : native.map((l) => (l.code === edit.from ? { code: edit.to } : l)),
        learning: renumbered(learning),
      }
    case 'addLearning':
      return {
        nativeLanguages: native,
        learning: renumbered(
          learningCodes(lists).includes(edit.code)
            ? learning
            : [...learning, { code: edit.code, level: NEW_LANGUAGE_LEVEL, priority: 0 }],
        ),
      }
    case 'removeLearning':
      return {
        nativeLanguages: native,
        learning: renumbered(learning.filter((l) => l.code !== edit.code)),
      }
    /*
     * The level and the position survive a replacement. Somebody swapping
     * Spanish for Portuguese at B1, third in their list, is correcting which
     * language it is — not restarting it as a beginner at the bottom.
     */
    case 'replaceLearning':
      return {
        nativeLanguages: native,
        learning: renumbered(
          learningCodes(lists).includes(edit.to)
            ? learning
            : learning.map((l) => (l.code === edit.from ? { ...l, code: edit.to } : l)),
        ),
      }
    case 'setLevel':
      return {
        nativeLanguages: native,
        learning: renumbered(
          learning.map((l) => (l.code === edit.code ? { ...l, level: edit.level } : l)),
        ),
      }
    case 'moveLearning': {
      const index = learning.findIndex((l) => l.code === edit.code)
      const target = edit.direction === 'up' ? index - 1 : index + 1
      if (index === -1 || target < 0 || target >= learning.length) {
        return { nativeLanguages: native, learning: renumbered(learning) }
      }
      const moved = [...learning]
      const [entry] = moved.splice(index, 1)
      moved.splice(target, 0, entry as LanguageLists['learning'][number])
      return { nativeLanguages: native, learning: renumbered(moved) }
    }
  }
}

/**
 * Which profile the request body should be built from: the one this edit has
 * not been applied to yet.
 *
 * `useEditLanguages` reaches for the lists twice over one tap's life. Once in
 * `onMutate`, which applies the edit to the cache so the row moves under the
 * finger — and once in `mutationFn`, because a request queued ahead of this
 * one may have answered in between, and the body belongs on that answer rather
 * than on the guess it replaced. Taking the cache both times is the bug this
 * exists to prevent: the edit was applied to its own result, which added a
 * language as two rows and turned every other edit into a request that was
 * never sent.
 *
 * Identity, not equality. `shown` is the object `onMutate` put in the cache,
 * so finding that very object still there means nothing has landed since and
 * the edit is already in it — in which case the lists to apply it to are the
 * ones from before it. Anything else in the cache is a profile this edit is
 * not in, and is itself the thing to apply it to.
 */
export function profileBeforeEdit<T>(cache: T, applied: { before?: T; shown?: T }): T {
  return cache === applied.shown && applied.before !== undefined ? applied.before : cache
}

/**
 * Whether two sets of lists say the same thing — codes, levels and order.
 *
 * The mutation asks this of the edit it is about to send: an edit that changes
 * nothing is a request that can fail, and failing at nothing is worse than not
 * asking.
 */
export function sameLanguageLists(a: LanguageLists, b: LanguageLists): boolean {
  return signature(a) === signature(b)
}

function signature(lists: LanguageLists): string {
  const native = lists.nativeLanguages.map((l) => l.code).join(',')
  const learning = ordered(lists)
    .map((l) => `${l.code}:${l.level}`)
    .join(',')
  return `${native}|${learning}`
}
