import { describe, expect, it } from 'vitest'
import {
  EMOJI_SHORTCODES,
  EMOTICONS,
  SHORTCODE_SUGGESTIONS_MAX,
  applyEmoticon,
  emoticonAt,
} from './emoticons'

/** The emoji offered for `text` with the cursor at its end. */
function offered(text: string): string[] {
  return emoticonAt(text, text.length)?.suggestions.map((item) => item.emoji) ?? []
}

describe('emoticonAt', () => {
  it('offers every emoticon in the table, alone and after a word', () => {
    for (const [emoticon, emoji] of Object.entries(EMOTICONS)) {
      expect(offered(emoticon), emoticon).toEqual([emoji])
      expect(offered(`nice ${emoticon}`), emoticon).toEqual([emoji])
    }
  })

  it('offers every shortcode, closed, in any case', () => {
    for (const [name, emoji] of Object.entries(EMOJI_SHORTCODES)) {
      expect(emoticonAt(`:${name}:`, name.length + 2)?.suggestions).toEqual([{ emoji, name }])
    }
    expect(offered('so :FIRE:')).toEqual(['🔥'])
  })

  it('covers the stretch to replace and nothing around it', () => {
    expect(emoticonAt('haha :D', 7)).toEqual({ start: 5, end: 7, suggestions: [{ emoji: '😄' }] })
    expect(emoticonAt('a\n<3', 4)).toMatchObject({ start: 2, end: 4 })
  })

  it('matches only the whole word before the cursor', () => {
    expect(offered('http://')).toEqual([])
    expect(offered('see https://langx.io/')).toEqual([])
    expect(offered('at 10:30')).toEqual([])
    expect(offered('10:3')).toEqual([])
    expect(offered('a:b')).toEqual([])
    expect(offered('word:)')).toEqual([])
    expect(offered('cd :/path')).toEqual([])
    expect(offered('mailto:x')).toEqual([])
  })

  it('needs the cursor at the end of the word', () => {
    expect(emoticonAt(':D ok', 2)).not.toBeNull()
    expect(emoticonAt(':Dok', 2)).toBeNull()
    expect(emoticonAt(':D ok', 1)).toBeNull()
    // Typed on past it: the space leaves the text as it is.
    expect(offered(':D ')).toEqual([])
  })

  it('keeps case where case is the meaning', () => {
    expect(offered(':d')).toEqual([])
    expect(offered('Xd')).toEqual([])
    expect(offered('b)')).toEqual([])
    expect(offered(':p')).toEqual(['😛'])
    expect(offered(':P')).toEqual(['😛'])
    expect(offered('xD')).toEqual(['😆'])
  })

  it('offers matching shortcodes for a partial one, from two letters', () => {
    const smile = emoticonAt(':smi', 4)
    expect(smile?.suggestions.map((item) => item.name)).toEqual(['smile', 'smiley'])
    expect(smile).toMatchObject({ start: 0, end: 4 })
    expect(offered('ok :FI')).toEqual(['🔥'])
    expect(emoticonAt(':s', 2)).toBeNull()
  })

  it('caps a partial match at five', () => {
    // Pick the two-letter prefix most names share, so the cap is what stops it.
    const counts = new Map<string, number>()
    for (const name of Object.keys(EMOJI_SHORTCODES)) {
      counts.set(name.slice(0, 2), (counts.get(name.slice(0, 2)) ?? 0) + 1)
    }
    const [prefix, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
    const found = emoticonAt(`:${prefix}`, prefix.length + 1)?.suggestions ?? []
    expect(found).toHaveLength(Math.min(count, SHORTCODE_SUGGESTIONS_MAX))
  })

  it('offers nothing for an unknown code or a lone colon', () => {
    expect(offered(':nothing:')).toEqual([])
    expect(offered(':zz')).toEqual([])
    expect(offered(':')).toEqual([])
    expect(offered('')).toEqual([])
    expect(emoticonAt(':D', 5)).toBeNull()
  })

  it('does not read further back than a token can be long', () => {
    const long = `:${'a'.repeat(10_000)}`
    expect(offered(long)).toEqual([])
    expect(offered(`${'x'.repeat(10_000)} :)`)).toEqual(['🙂'])
  })
})

describe('applyEmoticon', () => {
  it('swaps the match and puts the cursor after the emoji', () => {
    const text = 'haha :D and more'
    const match = emoticonAt(text, 7)
    expect(match).not.toBeNull()
    if (!match) return
    expect(applyEmoticon(text, match, '😄')).toEqual({ text: 'haha 😄 and more', cursor: 7 })
  })
})
