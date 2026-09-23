import { languageCapAllows, type LanguageLevel } from '@langx/shared'

/**
 * The two language lists, and every edit the languages screen can make to
 * them, as data rather than as handlers.
 *
 * Here rather than in the screen because none of it can be tested there —
 * mobile's vitest cannot import `react-native`, so anything inside a component
 * is unreachable — and because the screen is not the only thing that has to
 * agree with it: the screen asks whether an edit is allowed as it draws the
 * control, and the mutation applies it against the cache as it is when the
 * request finally runs. Two moments, two states, one function — which is what
 * keeps a control that offers something from being refused when it is pressed.
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
  /** `to` is the row it lands on, counted from 0 in priority order. */
  | { kind: 'moveLearning'; code: string; to: number }

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
      if (index === -1 || index === edit.to) return { kind: 'noop' }
      return edit.to < 0 || edit.to >= lists.learning.length ? { kind: 'noop' } : null
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
    case 'addNative':
      return { nativeLanguages: [...native, { code: edit.code }], learning: renumbered(learning) }
    case 'removeNative':
      return {
        nativeLanguages: native.filter((l) => l.code !== edit.code),
        learning: renumbered(learning),
      }
    case 'replaceNative':
      return {
        nativeLanguages: native.map((l) => (l.code === edit.from ? { code: edit.to } : l)),
        learning: renumbered(learning),
      }
    case 'addLearning':
      return {
        nativeLanguages: native,
        learning: renumbered([
          ...learning,
          { code: edit.code, level: NEW_LANGUAGE_LEVEL, priority: 0 },
        ]),
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
          learning.map((l) => (l.code === edit.from ? { ...l, code: edit.to } : l)),
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
      if (index === -1 || edit.to < 0 || edit.to >= learning.length) {
        return { nativeLanguages: native, learning: renumbered(learning) }
      }
      const moved = [...learning]
      const [entry] = moved.splice(index, 1)
      moved.splice(edit.to, 0, entry as LanguageLists['learning'][number])
      return { nativeLanguages: native, learning: renumbered(moved) }
    }
  }
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
