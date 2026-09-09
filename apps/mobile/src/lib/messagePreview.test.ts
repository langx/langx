import { MESSAGE_TYPES, SUPPORTED_LOCALES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { messagePreviewKey } from './messagePreview'

describe('messagePreviewKey', () => {
  /**
   * The mirror of `apps/api`'s `previewFor.test.ts`, and the guard this file
   * exists for.
   *
   * `translate` returns a missing key verbatim, so a key that no catalogue
   * defines is not an error anywhere — it is the dotted path drawn on screen.
   * The table is exhaustive by type, so what is left to check is that every
   * key in it actually resolves, in every language. `catalogs.test.ts` uses
   * the same `not.toBe(key)` trick for the same reason.
   */
  it('resolves to a real translation for every type, in every language', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const type of MESSAGE_TYPES) {
        const key = messagePreviewKey(type)
        expect(t(key), `${locale} has no ${key} for ${type}`).not.toBe(key)
      }
    }
  })

  /**
   * The bug that started this: the old table in `chat/[id].tsx` knew `image`
   * and `audio`, and everything else fell through to "Message" — so a starred
   * meeting and a starred sticker were indistinguishable from each other and
   * from a message the screen could not read at all.
   */
  it('gives the bodyless types a name of their own', () => {
    const t = createTranslate('en')
    const named = MESSAGE_TYPES.filter((type) => type !== 'text').map((type) =>
      t(messagePreviewKey(type)),
    )
    expect(new Set(named).size).toBe(named.length)
    expect(named).not.toContain(t('messageMeta.message'))
  })
})
