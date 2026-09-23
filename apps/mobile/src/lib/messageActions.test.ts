import { MESSAGE_TYPES, TTS_MAX_TEXT_LENGTH } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  messageActionsFor,
  paginateActions,
  unsentActionsFor,
  type MessageActionContext,
} from './messageActions'

const theirs: MessageActionContext = {
  mine: false,
  type: 'text',
  hasBody: true,
  hasMedia: false,
  bodyLength: 34,
  alreadyTranslated: false,
  canEdit: false,
  corrected: false,
  starred: false,
  pinned: false,
  echoed: false,
  t: createTranslate('en'),
}

/** The same message in a deployment whose voice service is configured. */
const speakable: Partial<MessageActionContext> = { canSpeak: true }

const ids = (overrides: Partial<MessageActionContext> = {}) =>
  messageActionsFor({ ...theirs, ...overrides }).map((a) => a.id)

const find = (overrides: Partial<MessageActionContext>, id: string) =>
  messageActionsFor({ ...theirs, ...overrides }).find((a) => a.id === id)

describe('messageActionsFor', () => {
  it('offers the full set on the other person text', () => {
    expect(ids(speakable)).toEqual([
      'reply',
      'correct',
      'translate',
      'speak',
      'copy',
      'echo',
      'delete',
      'star',
      'pin',
      'phrase',
      'share',
      'report',
    ])
  })

  describe('read aloud', () => {
    /*
     * Hidden unless it is known to work, where translate is shown unless it is
     * known not to. Translation is configured in every deployment; a voice
     * service is optional, and a language it cannot read has no voice at all —
     * so an undecided `canSpeak` means no row rather than a row that fails.
     */
    it('stays hidden until something says a reading is possible', () => {
      expect(ids()).not.toContain('speak')
      expect(ids({ canSpeak: false })).not.toContain('speak')
      expect(ids(speakable)).toContain('speak')
    })

    it('is offered on your own message, unlike translate and correct', () => {
      const own = ids({ ...speakable, mine: true })
      expect(own).toContain('speak')
      expect(own).not.toContain('translate')
      expect(own).not.toContain('correct')
    })

    it('reads a correction and a captioned photo, and never a voice note', () => {
      for (const type of ['text', 'correction', 'image'] as const) {
        expect(ids({ ...speakable, type }), type).toContain('speak')
      }
      for (const type of ['audio', 'video', 'sticker', 'meeting', 'quiz', 'phrase'] as const) {
        expect(ids({ ...speakable, type }), type).not.toContain('speak')
      }
    })

    it('stops at the length the service stops at', () => {
      expect(ids({ ...speakable, bodyLength: TTS_MAX_TEXT_LENGTH })).toContain('speak')
      expect(ids({ ...speakable, bodyLength: TTS_MAX_TEXT_LENGTH + 1 })).not.toContain('speak')
    })

    it('is not offered on a withdrawn message', () => {
      expect(ids({ ...speakable, hasBody: false })).not.toContain('speak')
    })

    /*
     * On the first page, not behind `More…`. Burying a comprehension action in
     * a language-learning app's busiest screen is the wrong trade, and the
     * anchored menu still fits.
     */
    it('is on the first page of the menu', () => {
      const first = paginateActions(messageActionsFor({ ...theirs, ...speakable }), 'primary')
      expect(first.actions.map((action) => action.id)).toContain('speak')
    })
  })

  it('never offers to correct, translate or report your own message', () => {
    const own = ids({ mine: true })
    expect(own).not.toContain('correct')
    expect(own).not.toContain('translate')
    expect(own).not.toContain('report')
  })

  it('drops translate once it has been translated', () => {
    expect(ids({ alreadyTranslated: true })).not.toContain('translate')
  })

  /** A reader with no written native language — signed only — is offered no translation. */
  it('drops translate when there is no language to translate into', () => {
    expect(ids({ canTranslate: false })).not.toContain('translate')
    expect(ids({ canTranslate: true })).toContain('translate')
  })

  it('only corrects text, never an attachment or another correction', () => {
    for (const type of ['image', 'audio', 'correction'] as const) {
      expect(ids({ type })).not.toContain('correct')
    }
  })

  it('has nothing to copy or share on a captionless voice note', () => {
    expect(ids({ type: 'audio', hasBody: false })).not.toContain('copy')
    expect(ids({ type: 'audio', hasBody: false })).not.toContain('share')
  })

  it('shares text from either side of the conversation', () => {
    for (const mine of [true, false]) expect(ids({ mine })).toContain('share')
  })

  /** A filter on your own copy, so it never depends on age or authorship. */
  it('offers delete and star on every message, whoever sent it', () => {
    for (const mine of [true, false]) {
      expect(ids({ mine })).toContain('delete')
      expect(ids({ mine })).toContain('star')
    }
  })

  /**
   * Every *type*, not just every author.
   *
   * The case above varies `mine` and leaves `type: 'text'`, so "star works on
   * anything" was an untested claim for eight of the nine types — which is
   * how a meeting card could stop being starrable without a red test. A
   * bodyless type is passed as bodyless, because that is the shape a meeting
   * and a sticker actually arrive in.
   */
  it('offers star on every message type', () => {
    for (const type of MESSAGE_TYPES) {
      const hasBody = type === 'text' || type === 'correction'
      expect(ids({ type, hasBody })).toContain('star')
    }
  })

  it('offers edit only when the caller says the rules allow it', () => {
    expect(ids({ mine: true, canEdit: true })).toContain('edit')
    expect(ids({ mine: true, canEdit: false })).not.toContain('edit')
  })

  /**
   * Shown rather than hidden: on your own recent message a missing Edit reads
   * as a bug, so the row stays and says why it cannot be used.
   */
  it('explains the lock on a corrected message instead of hiding it', () => {
    const edit = find({ mine: true, canEdit: false, corrected: true }, 'edit')
    expect(edit?.disabled).toBe(true)
    expect(edit?.label).toMatch(/Corrected/)
  })

  describe('save as a phrase', () => {
    it('is offered on the other person text', () => {
      expect(ids()).toContain('phrase')
    })

    /** A deck is for what you met, not for what you already wrote. */
    it('is not offered on my own message', () => {
      expect(ids({ mine: true })).not.toContain('phrase')
    })

    /** A card is what it would produce; there is nothing to turn. */
    it('is not offered on a phrase card', () => {
      expect(ids({ type: 'phrase', hasBody: false })).not.toContain('phrase')
      expect(ids({ type: 'phrase', hasBody: true })).not.toContain('phrase')
    })

    /**
     * Nothing to put in the example. This is also what keeps it off a
     * tombstone, whose `body` the server empties — hence no `deleted` flag on
     * the context and no check for one here.
     */
    it('is not offered on a voice note with no caption', () => {
      expect(ids({ type: 'audio', hasBody: false })).not.toContain('phrase')
      expect(ids({ type: 'audio', hasBody: true })).toContain('phrase')
    })
  })

  /**
   * `@langx` announces and nothing reads a reply, so the screen draws no
   * composer for it. Every row that would have filled that composer goes with
   * it, and nothing else does: the reading rows stay because an announcement
   * is worth translating and keeping.
   */
  describe('in a channel', () => {
    const channel = { channel: true }

    it('offers nothing that would be sent', () => {
      const rows = ids({ ...speakable, ...channel })
      for (const id of ['reply', 'correct', 'phrase']) {
        expect(rows, id).not.toContain(id)
      }
    })

    /**
     * Report is not a send. It goes to moderation rather than to the account,
     * and a channel is still where an announcement nobody should have sent
     * would appear — so it is the one row on this page that stays.
     */
    it('still reports, reads, translates, copies, keeps and hides', () => {
      const rows = ids({ ...speakable, ...channel })
      expect(rows).toEqual([
        'translate',
        'speak',
        'copy',
        'echo',
        'delete',
        'star',
        'pin',
        'share',
        'report',
      ])
    })
  })

  describe('save to device', () => {
    it('is offered on a photo or video message, on the first page', () => {
      for (const type of ['image', 'video'] as const) {
        expect(find({ type, hasMedia: true, hasBody: false }, 'saveMedia')?.page).toBe('primary')
      }
    })

    it('is offered on your own messages and in a channel too', () => {
      expect(ids({ type: 'image', hasMedia: true, mine: true })).toContain('saveMedia')
      expect(ids({ type: 'video', hasMedia: true, channel: true })).toContain('saveMedia')
    })

    it('comes before delete, so the destructive row stays last on the page', () => {
      const rows = ids({ type: 'image', hasMedia: true, hasBody: false })
      expect(rows.indexOf('saveMedia')).toBeLessThan(rows.indexOf('delete'))
    })

    /** A withdrawn photo keeps its type and loses its files. */
    it('is not offered once the files are gone', () => {
      expect(ids({ type: 'image', hasMedia: false })).not.toContain('saveMedia')
    })

    it('is not offered on anything that is not a photo or a video', () => {
      for (const type of MESSAGE_TYPES.filter((type) => type !== 'image' && type !== 'video')) {
        expect(ids({ type, hasMedia: true })).not.toContain('saveMedia')
      }
    })
  })

  it('names star and pin for what pressing them will do', () => {
    expect(find({ starred: true }, 'star')?.label).toBe('Unstar')
    expect(find({ starred: false }, 'star')?.label).toBe('Star')
    expect(find({ pinned: true }, 'pin')?.label).toBe('Unpin')
  })
})

describe('Add to Echo', () => {
  it('is offered on your own message, unlike saving a phrase', () => {
    // The case that decides it is a correction: the corrected line is the
    // thing worth learning, and it is written on your sentence.
    expect(ids({ mine: true })).toContain('echo')
    expect(ids({ mine: true })).not.toContain('phrase')
    expect(ids({ mine: true, type: 'correction' })).toContain('echo')
  })

  it('is offered on a photo that came with a caption', () => {
    // The caption is the front; the photo is the cue. Without this a card
    // made from a chat could never carry a picture.
    expect(ids({ type: 'image', hasBody: true })).toContain('echo')
    expect(ids({ type: 'image', hasBody: false })).not.toContain('echo')
  })

  it('is not offered where there is no sentence to keep', () => {
    for (const type of ['audio', 'video', 'sticker', 'meeting', 'quiz', 'phrase'] as const) {
      expect(ids({ type }), type).not.toContain('echo')
    }
  })

  it('offers to take it back once it is kept', () => {
    expect(find({ echoed: false }, 'echo')?.label).toBe('Add to Echo')
    expect(find({ echoed: true }, 'echo')?.label).toBe('Remove from Echo')
  })

  it('sits on the first page, where one tap reaches it', () => {
    expect(find({}, 'echo')?.page).toBe('primary')
  })
})

describe('paginateActions', () => {
  const all = messageActionsFor(theirs)

  it('keeps the everyday six on the first page', () => {
    const { actions, hasMore } = paginateActions(all, 'primary')
    expect(actions.map((a) => a.id)).toEqual([
      'reply',
      'correct',
      'translate',
      'copy',
      'echo',
      'delete',
    ])
    expect(hasMore).toBe(true)
  })

  it('puts the rest behind More', () => {
    const { actions, hasMore } = paginateActions(all, 'more')
    expect(actions.map((a) => a.id)).toEqual(['star', 'pin', 'phrase', 'share', 'report'])
    expect(hasMore).toBe(false)
  })

  /** A `More…` row that opens an empty page is worse than one row too many. */
  it('offers no second page when there is nothing on it', () => {
    const primaryOnly = all.filter((a) => a.page === 'primary')
    expect(paginateActions(primaryOnly, 'primary')).toEqual({
      actions: primaryOnly,
      hasMore: false,
    })
  })
})

describe('unsentActionsFor', () => {
  const t = createTranslate('en')

  /*
   * Everything else acts on a message the server holds, and this one never
   * reached it. Delete is the row that matters: without it a send that keeps
   * failing can only be retried, and stays in the thread for good.
   */
  it('offers copy and delete on a failed sentence', () => {
    expect(unsentActionsFor({ hasBody: true, t }).map((a) => a.id)).toEqual(['copy', 'delete'])
  })

  it('offers only delete on a failed attachment with nothing to copy', () => {
    expect(unsentActionsFor({ hasBody: false, t }).map((a) => a.id)).toEqual(['delete'])
  })

  it('fits on one page', () => {
    const actions = unsentActionsFor({ hasBody: true, t })
    expect(paginateActions(actions, 'primary')).toEqual({ actions, hasMore: false })
  })
})
