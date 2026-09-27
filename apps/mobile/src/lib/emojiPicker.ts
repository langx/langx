import { isReactionEmoji } from '@langx/shared'
import { EMOJI_GROUPS, type EmojiGroupId } from './emojiData'

/**
 * The data side of the reaction picker behind the strip's "+": the groups it
 * pages through, the search over them, and the recently used row.
 *
 * Our own grid over a bundled list rather than a picker package. The packages
 * that run on iOS, Android *and* web ship their own copy of the emoji data
 * with keywords — `rn-emoji-keyboard`'s is 230 KB and has not had a release
 * since 2024 — while everything here is 40 KB, draws with the `Text` the rest
 * of the chat uses, and follows the app's theme instead of a package's.
 */

export interface PickerEmoji {
  emoji: string
  /** Unicode's English name — what the search box matches against. */
  name: string
}

export interface PickerGroup {
  id: EmojiGroupId
  emoji: readonly PickerEmoji[]
}

/** Two rows of the grid: enough to be a habit, few enough to be a glance. */
export const MAX_RECENT_REACTIONS = 16

let parsed: readonly PickerGroup[] | null = null

/** Parsed on first use: the picker is opened rarely, and never at startup. */
export function emojiGroups(): readonly PickerGroup[] {
  parsed ??= EMOJI_GROUPS.map((group) => ({
    id: group.id,
    emoji: group.list.split('|').map((entry) => {
      // An emoji never contains an ASCII space, so the first one ends it.
      const space = entry.indexOf(' ')
      return { emoji: entry.slice(0, space), name: entry.slice(space + 1) }
    }),
  }))
  return parsed
}

/**
 * Every emoji whose name has a word starting with each word of the query, so
 * "hea" finds the hearts and "red hea" narrows to the red one.
 *
 * The names are English, Unicode's own. Translating two thousand of them is a
 * CLDR annotation set per locale, several times the size of the whole list;
 * the groups are there for browsing in any language.
 */
export function searchEmoji(query: string): PickerEmoji[] {
  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean)
  if (words.length === 0) return []
  const found: PickerEmoji[] = []
  for (const group of emojiGroups()) {
    for (const entry of group.emoji) {
      const nameWords = entry.name.toLowerCase().split(/[\s:,-]+/u)
      if (words.every((word) => nameWords.some((name) => name.startsWith(word)))) {
        found.push(entry)
      }
    }
  }
  return found
}

/**
 * The recent list with `emoji` moved to the front, deduplicated and capped.
 *
 * Tolerant of whatever storage hands back: a value from an older build, or
 * one edited by hand in a browser's devtools, must not be able to put
 * something that is not a reaction on the grid.
 */
export function withRecentReaction(recent: unknown, emoji: string): string[] {
  return [emoji, ...readRecentReactions(recent).filter((item) => item !== emoji)].slice(
    0,
    MAX_RECENT_REACTIONS,
  )
}

/** What storage held, as a list the picker can draw. */
export function readRecentReactions(stored: unknown): string[] {
  if (!Array.isArray(stored)) return []
  return stored
    .filter((item): item is string => typeof item === 'string' && isReactionEmoji(item))
    .slice(0, MAX_RECENT_REACTIONS)
}
