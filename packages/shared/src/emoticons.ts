/**
 * Typed shortcuts the chat composer offers to turn into emoji: the ASCII
 * faces people have typed since before phones had an emoji keyboard, and the
 * `:name:` codes Slack and Discord taught everyone else.
 *
 * The composer only suggests; nothing here rewrites what was typed. A person
 * who meant the literal `:P` — a learner quoting a textbook, a programmer
 * pasting a path — keeps it by typing on, and the message stored is exactly
 * the text they chose to send.
 */

/**
 * Case matters here, on purpose: `:D` is a grin and `:d` is nobody's face, so
 * only the spellings people actually type are listed, both cases where both
 * are common (`:P`/`:p`, `xD`/`XD`).
 */
export const EMOTICONS: Readonly<Record<string, string>> = {
  ':)': '🙂',
  ':-)': '🙂',
  '(:': '🙂',
  ':D': '😄',
  ':-D': '😄',
  xD: '😆',
  XD: '😆',
  ':(': '🙁',
  ':-(': '🙁',
  ":'(": '😢',
  ":'-(": '😢',
  ":')": '🥲',
  ';)': '😉',
  ';-)': '😉',
  ':P': '😛',
  ':-P': '😛',
  ':p': '😛',
  ':-p': '😛',
  ';P': '😜',
  ';p': '😜',
  ':O': '😮',
  ':-O': '😮',
  ':o': '😮',
  ':-o': '😮',
  '<3': '❤️',
  '</3': '💔',
  ':*': '😘',
  ':-*': '😘',
  '^^': '😊',
  '^_^': '😊',
  '-_-': '😑',
  ':/': '😕',
  ':-/': '😕',
  ':|': '😐',
  ':-|': '😐',
  'B)': '😎',
  'B-)': '😎',
  'o/': '👋',
  '\\o/': '🙌',
  '>:(': '😠',
  '>:-(': '😠',
  ':3': '😺',
  T_T: '😭',
  'O:)': '😇',
  '>:)': '😈',
}

/**
 * The `:name:` codes, a curated fifty rather than the full Unicode list: a
 * table of thousands would make every two-letter prefix a wall of guesses,
 * and these are the ones a chat actually reaches for. Lowercase; the matcher
 * lowercases what was typed.
 */
export const EMOJI_SHORTCODES: Readonly<Record<string, string>> = {
  smile: '😄',
  smiley: '😃',
  grin: '😁',
  laughing: '😆',
  joy: '😂',
  rofl: '🤣',
  wink: '😉',
  blush: '😊',
  innocent: '😇',
  heart_eyes: '😍',
  kissing_heart: '😘',
  yum: '😋',
  stuck_out_tongue: '😛',
  thinking: '🤔',
  neutral_face: '😐',
  expressionless: '😑',
  unamused: '😒',
  roll_eyes: '🙄',
  grimacing: '😬',
  relieved: '😌',
  sleepy: '😪',
  sleeping: '😴',
  sunglasses: '😎',
  nerd: '🤓',
  confused: '😕',
  worried: '😟',
  open_mouth: '😮',
  flushed: '😳',
  cry: '😢',
  sob: '😭',
  scream: '😱',
  angry: '😠',
  rage: '😡',
  skull: '💀',
  heart: '❤️',
  broken_heart: '💔',
  sparkling_heart: '💖',
  fire: '🔥',
  star: '⭐',
  sparkles: '✨',
  tada: '🎉',
  hundred: '💯',
  thumbsup: '👍',
  thumbsdown: '👎',
  ok_hand: '👌',
  clap: '👏',
  wave: '👋',
  pray: '🙏',
  muscle: '💪',
  raised_hands: '🙌',
  eyes: '👀',
  coffee: '☕',
  books: '📚',
  earth: '🌍',
  sun: '☀️',
  rocket: '🚀',
}

export interface EmojiSuggestion {
  emoji: string
  /** The shortcode's name for a `:name` match, which is what tells two faces apart; absent for an emoticon. */
  name?: string
}

/**
 * What the text right before the cursor could become: the stretch to replace
 * and up to `SHORTCODE_SUGGESTIONS_MAX` emoji to replace it with.
 */
export interface EmoticonMatch {
  start: number
  end: number
  suggestions: EmojiSuggestion[]
}

export const SHORTCODE_SUGGESTIONS_MAX = 5

/**
 * Longer than any key above. A token is never read further back than this,
 * so the matcher costs the same on a one-line message and a pasted essay.
 */
const MAX_TOKEN_LENGTH = 32

/**
 * Two characters before a partial `:na` offers anything: one letter would
 * put a strip of guesses under every `:s` in a sentence.
 */
const PARTIAL_SHORTCODE = /^:([a-z0-9_]{2,})$/
const FULL_SHORTCODE = /^:([a-z0-9_]+):$/

const SHORTCODE_NAMES = Object.keys(EMOJI_SHORTCODES)

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char)
}

/**
 * The shortcut that ends at `cursor`, if the whole word there is one.
 *
 * "The whole word" is the point: the token runs from the last whitespace (or
 * the start) to the cursor, and must be followed by whitespace or the end.
 * So `http://`, `10:30`, `a:b` and `:/path` are words that are not in the
 * table and never match, where a pattern searched for inside the text would
 * have found `:/` in the first and `:3` in `10:30`.
 */
export function emoticonAt(text: string, cursor: number): EmoticonMatch | null {
  if (cursor < 1 || cursor > text.length || !isSpace(text[cursor])) return null

  let start = cursor
  while (start > 0 && !isSpace(text[start - 1])) {
    start -= 1
    if (cursor - start > MAX_TOKEN_LENGTH) return null
  }
  const token = text.slice(start, cursor)
  const end = cursor

  const emoticon = EMOTICONS[token]
  if (emoticon) return { start, end, suggestions: [{ emoji: emoticon }] }

  const lower = token.toLowerCase()
  const full = FULL_SHORTCODE.exec(lower)
  if (full) {
    const name = full[1] ?? ''
    const emoji = EMOJI_SHORTCODES[name]
    return emoji ? { start, end, suggestions: [{ emoji, name }] } : null
  }

  const partial = PARTIAL_SHORTCODE.exec(lower)
  if (!partial) return null
  const prefix = partial[1] ?? ''
  const suggestions: EmojiSuggestion[] = []
  for (const name of SHORTCODE_NAMES) {
    if (!name.startsWith(prefix)) continue
    suggestions.push({ emoji: EMOJI_SHORTCODES[name] ?? '', name })
    if (suggestions.length === SHORTCODE_SUGGESTIONS_MAX) break
  }
  return suggestions.length > 0 ? { start, end, suggestions } : null
}

/** `text` with the match swapped for `emoji`, and where the cursor belongs after it. */
export function applyEmoticon(
  text: string,
  match: Pick<EmoticonMatch, 'start' | 'end'>,
  emoji: string,
): { text: string; cursor: number } {
  return {
    text: text.slice(0, match.start) + emoji + text.slice(match.end),
    cursor: match.start + emoji.length,
  }
}
