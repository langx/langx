import type { InfiniteData } from '@tanstack/react-query'
import type {
  FeedPage,
  FeedPost,
  PostCorrection,
  PostCorrectionsPage,
  PronunciationAnswer,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  applyAnswer,
  applyCommentCount,
  applyCorrection,
  applyEchoed,
  applyEchoedToThread,
  applyLike,
  applyLikeToThread,
  applyReplyRemoved,
  foldCorrection,
  type FoldRun,
  markCorrected,
  prependPost,
  removePost,
} from './feedCache'

const author = { _id: 'u2', handle: 'teacher', displayName: 'Teacher' }

function correction(id: string): PostCorrection {
  return {
    _id: id,
    author,
    corrected: 'Yo tengo hambre.',
    likeCount: 0,
    likedByViewer: false,
    createdAt: '2026-08-29T12:00:00.000Z',
  }
}

function answer(id: string): PronunciationAnswer {
  return {
    _id: id,
    author,
    media: {
      url: 'https://cdn.example.com/posts/u/fast.m4a',
      contentType: 'audio/m4a',
      sizeBytes: 1,
    },
    likeCount: 0,
    likedByViewer: false,
    createdAt: '2026-08-29T12:00:00.000Z',
  }
}

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    _id: 'p1',
    author: { _id: 'u1', handle: 'learner', displayName: 'Learner' },
    body: 'Yo tener hambre.',
    language: 'es',
    level: 'intermediate',
    kind: 'correction',
    correctionCount: 0,
    answerCount: 0,
    commentCount: 0,
    topCorrection: null,
    topAnswer: null,
    correctedByViewer: false,
    answeredByViewer: false,
    echoedByViewer: false,
    likeCount: 0,
    likedByViewer: false,
    createdAt: '2026-08-29T11:00:00.000Z',
    ...overrides,
  }
}

function pages(...items: FeedPost[][]): InfiniteData<FeedPage> {
  return {
    pages: items.map((page) => ({ items: page, nextCursor: null })),
    pageParams: items.map(() => ''),
  }
}

describe('applyCorrection', () => {
  it('counts the correction and marks the post answered by the viewer', () => {
    const patched = applyCorrection(pages([post()]), 'p1', correction('c1'))
    const first = patched?.pages[0]?.items[0]
    expect(first?.correctionCount).toBe(1)
    expect(first?.correctedByViewer).toBe(true)
  })

  it('fills topCorrection only when the post had no answer', () => {
    const fresh = applyCorrection(pages([post()]), 'p1', correction('c1'))
    expect(fresh?.pages[0]?.items[0]?.topCorrection?._id).toBe('c1')

    // The top correction is the oldest, and somebody already answered — yours
    // is not it.
    const answered = pages([post({ correctionCount: 1, topCorrection: correction('c0') })])
    const patched = applyCorrection(answered, 'p1', correction('c1'))
    expect(patched?.pages[0]?.items[0]?.topCorrection?._id).toBe('c0')
    expect(patched?.pages[0]?.items[0]?.correctionCount).toBe(2)
  })

  it('patches a post on a later page', () => {
    const patched = applyCorrection(pages([post()], [post({ _id: 'p2' })]), 'p2', correction('c1'))
    expect(patched?.pages[1]?.items[0]?.correctionCount).toBe(1)
    expect(patched?.pages[0]?.items[0]?.correctionCount).toBe(0)
  })

  it('returns the identical object when the post is not loaded', () => {
    // Identity, not equality: a new object here re-renders every card in the
    // list for a post that is not even on screen.
    const data = pages([post()])
    expect(applyCorrection(data, 'missing', correction('c1'))).toBe(data)
    expect(applyCorrection(undefined, 'p1', correction('c1'))).toBeUndefined()
  })
})

describe('applyLike', () => {
  const state = { likeCount: 3, likedByViewer: true }

  it('writes the state rather than incrementing it', () => {
    // The server answers with the whole new state, so two responses to a
    // double tap carry the same number where two increments would carry two.
    const data = pages([post({ likeCount: 2 })])
    const once = applyLike(data, 'post', 'p1', state)
    const twice = applyLike(once, 'post', 'p1', state)
    expect(twice?.pages[0]?.items[0]?.likeCount).toBe(3)
    expect(twice?.pages[0]?.items[0]?.likedByViewer).toBe(true)
  })

  it('patches a liked correction shown on a card', () => {
    const data = pages([post({ correctionCount: 1, topCorrection: correction('c1') })])
    const patched = applyLike(data, 'correction', 'c1', state)
    expect(patched?.pages[0]?.items[0]?.topCorrection?.likeCount).toBe(3)
    // The post itself is untouched by a like on its correction.
    expect(patched?.pages[0]?.items[0]?.likeCount).toBe(0)
  })

  it('returns the identical object when the target is not loaded', () => {
    const data = pages([post()])
    expect(applyLike(data, 'post', 'missing', state)).toBe(data)
    expect(applyLike(data, 'correction', 'missing', state)).toBe(data)
  })
})

describe('applyLikeToThread', () => {
  const state = { likeCount: 1, likedByViewer: true }

  function thread(): InfiniteData<PostCorrectionsPage> {
    return {
      pages: [{ post: post(), items: [correction('c1'), correction('c2')], nextCursor: null }],
      pageParams: [''],
    }
  }

  it('patches the post in the header', () => {
    const patched = applyLikeToThread(thread(), 'post', 'p1', state)
    expect(patched?.pages[0]?.post.likeCount).toBe(1)
  })

  it('patches one correction and leaves its neighbours alone', () => {
    const patched = applyLikeToThread(thread(), 'correction', 'c2', state)
    expect(patched?.pages[0]?.items[0]?.likeCount).toBe(0)
    expect(patched?.pages[0]?.items[1]?.likeCount).toBe(1)
  })

  it('returns the identical object when nothing matched', () => {
    const data = thread()
    expect(applyLikeToThread(data, 'correction', 'missing', state)).toBe(data)
  })
})

describe('applyAnswer', () => {
  it('counts the recording and claims the card, without re-sorting it away', () => {
    const data = pages([post({ kind: 'pronunciation' })])
    const patched = applyAnswer(data, 'p1', answer('a1'))
    const card = patched!.pages[0]!.items[0]!
    expect(card.answerCount).toBe(1)
    expect(card.answeredByViewer).toBe(true)
    expect(card.topAnswer?._id).toBe('a1')
  })

  it('leaves an existing top answer alone', () => {
    // Oldest, not newest — the same rule `topCorrection` follows.
    const data = pages([
      post({ kind: 'pronunciation', answerCount: 1, topAnswer: answer('first') }),
    ])
    const patched = applyAnswer(data, 'p1', answer('second'))
    expect(patched!.pages[0]!.items[0]!.topAnswer?._id).toBe('first')
  })
})

describe('applyCommentCount', () => {
  it('moves the count by the delta', () => {
    const data = pages([post({ commentCount: 2 })])
    expect(applyCommentCount(data, 'p1', 1)!.pages[0]!.items[0]!.commentCount).toBe(3)
    expect(applyCommentCount(data, 'p1', -1)!.pages[0]!.items[0]!.commentCount).toBe(1)
  })

  it('never goes below zero', () => {
    // Two devices deleting the same comment would otherwise leave -1 on screen.
    const data = pages([post({ commentCount: 0 })])
    expect(applyCommentCount(data, 'p1', -1)!.pages[0]!.items[0]!.commentCount).toBe(0)
  })
})

describe('prependPost', () => {
  it('puts the new post at the top of the first page', () => {
    const data = pages([post({ _id: 'p1' }), post({ _id: 'p2' })])
    const patched = prependPost(data, post({ _id: 'new' }))
    expect(patched!.pages[0]!.items.map((item) => item._id)).toEqual(['new', 'p1', 'p2'])
  })

  it('does not draw the post twice when it is already loaded', () => {
    // The server can hand back a post the pages already hold — a refetch that
    // landed between the write and this patch. Two identical cards is the
    // visible failure, so the old copy goes.
    const data = pages([post({ _id: 'p1' })], [post({ _id: 'new' }), post({ _id: 'p2' })])
    const patched = prependPost(data, post({ _id: 'new', body: 'edited' }))
    expect(patched!.pages[0]!.items.map((item) => item._id)).toEqual(['new', 'p1'])
    expect(patched!.pages[1]!.items.map((item) => item._id)).toEqual(['p2'])
  })

  it('leaves later pages alone when nothing has to be dropped from them', () => {
    const data = pages([post({ _id: 'p1' })], [post({ _id: 'p2' })])
    const patched = prependPost(data, post({ _id: 'new' }))
    expect(patched!.pages[1]).toBe(data.pages[1])
  })

  it('does nothing when the feed has not been loaded', () => {
    expect(prependPost(undefined, post({ _id: 'new' }))).toBeUndefined()
  })
})

describe('removePost', () => {
  it('drops the row and leaves the rest of the page', () => {
    const data = pages([post(), post({ _id: 'p2' })])
    const patched = removePost(data, 'p1')
    expect(patched!.pages[0]!.items.map((item) => item._id)).toEqual(['p2'])
  })

  it('returns the identical object when the post is not loaded', () => {
    // The same no-op contract every patcher here keeps, so React Query does not
    // re-render a list nothing happened to.
    const data = pages([post()])
    expect(removePost(data, 'nope')).toBe(data)
  })
})

describe('markCorrected', () => {
  it('claims the card without touching the count', () => {
    const data = pages([post({ correctionCount: 3 })])
    const patched = markCorrected(data, 'p1')
    expect(patched!.pages[0]!.items[0]!.correctedByViewer).toBe(true)
    expect(patched!.pages[0]!.items[0]!.correctionCount).toBe(3)
  })
})

describe('applyEchoed', () => {
  it('sets and clears the Echo mark without a refetch', () => {
    const kept = applyEchoed(pages([post()]), 'p1', true)
    expect(kept!.pages[0]!.items[0]!.echoedByViewer).toBe(true)
    const cleared = applyEchoed(kept, 'p1', false)
    expect(cleared!.pages[0]!.items[0]!.echoedByViewer).toBe(false)
  })

  it('leaves a post that already agrees untouched', () => {
    const data = pages([post({ echoedByViewer: true })])
    expect(applyEchoed(data, 'p1', true)).toBe(data)
  })
})

describe('applyEchoedToThread', () => {
  it('marks the post a thread page carries', () => {
    const data: InfiniteData<PostCorrectionsPage> = {
      pages: [{ post: post(), items: [], nextCursor: null }],
      pageParams: [''],
    }
    const patched = applyEchoedToThread(data, 'p1', true)
    expect(patched!.pages[0]!.post.echoedByViewer).toBe(true)
    expect(applyEchoedToThread(data, 'other', true)).toBe(data)
  })
})

describe('applyReplyRemoved', () => {
  it('takes your correction off the card and empties the panel it headed', () => {
    const data = pages([
      post({ correctionCount: 2, correctedByViewer: true, topCorrection: correction('c1') }),
    ])
    const patched = applyReplyRemoved(data, 'p1', 'correction', 'c1')!.pages[0]!.items[0]!
    expect(patched.correctionCount).toBe(1)
    expect(patched.correctedByViewer).toBe(false)
    expect(patched.topCorrection).toBeNull()
  })

  it('keeps somebody else’s top reply in place', () => {
    const data = pages([post({ answerCount: 2, answeredByViewer: true, topAnswer: answer('a0') })])
    const patched = applyReplyRemoved(data, 'p1', 'answer', 'a1')!.pages[0]!.items[0]!
    expect(patched.answerCount).toBe(1)
    expect(patched.answeredByViewer).toBe(false)
    expect(patched.topAnswer?._id).toBe('a0')
  })

  it('never counts below zero', () => {
    const patched = applyReplyRemoved(pages([post()]), 'p1', 'correction', 'c1')
    expect(patched!.pages[0]!.items[0]!.correctionCount).toBe(0)
  })
})

describe('prependPost on the timeline', () => {
  it('puts a moment — a post that asks for nothing — at the top like any other', () => {
    const moment = { ...post({ _id: 'm1', body: '' }), asks: [] } as FeedPost
    const patched = prependPost(pages([post()]), moment)
    expect(patched!.pages[0]!.items.map((item) => item._id)).toEqual(['m1', 'p1'])
  })
})

/** `kept` plain, `removed` as ~~struck~~, `added` as **bold**: one line to compare. */
const drawn = (runs: FoldRun[]): string =>
  runs
    .map((run) =>
      run.kind === 'kept'
        ? run.text
        : run.kind === 'removed'
          ? `~~${run.text}~~`
          : `**${run.text}**`,
    )
    .join('')

describe('foldCorrection', () => {
  it.each([
    // The report: adding `, please` redrew `coffee` as struck and retyped.
    [
      'I would like a cup of coffee',
      'I would like a cup of coffee, please',
      'I would like a cup of coffee**, please**',
    ],
    ['Hello', 'Hello!', 'Hello**!**'],
    ['Yes I know', 'Yes, I know', 'Yes**,** I know'],
    ['I have a cat.', 'I have a dog.', 'I have a ~~cat~~ **dog**.'],
    ['Dónde está el baño', '¿Dónde está el baño?', '**¿**Dónde está el baño**?**'],
    ['كيف حالك?', 'كيف حالك؟', 'كيف حالك~~?~~**؟**'],
    ['I dont know', "I don't know", "I don**'**t know"],
    // Struck punctuation stays attached to its word, as it was written.
    ['Hello, world', 'Hello world', 'Hello~~,~~ world'],
    ['Hello world!', 'Hello world', 'Hello world~~!~~'],
    // A struck suffix is part of a word, not a word of its own.
    ['she have a car', 'she has a car', 'she ha~~ve~~**s** a car'],
    // Whole words keep the spaces they always had.
    ['I go home', 'I run home', 'I ~~go~~ **run** home'],
    ['Go home', 'Went home', '~~Go~~ **Went** home'],
    ['I really like it', 'I like it', 'I ~~really~~ like it'],
    ['I going home', 'I am going home', 'I **am** going home'],
  ])('draws %j → %j as %j', (original, corrected, expected) => {
    expect(drawn(foldCorrection(original, corrected))).toBe(expected)
  })

  /**
   * The corrected sentence is what the line says; the struck runs are
   * annotations dropped into it. Leave them out and it must read the same —
   * up to spacing, since a struck word is given a space of its own to stand
   * in. The exact-whitespace invariant is `diffCorrection`'s, and tested there.
   */
  it.each([
    ['I would like a cup of coffee', 'I would like a cup of coffee, please'],
    ['Hello, world', 'Hello world'],
    ['she have a car and he have a bike', 'she has a car and he has a bike'],
    ['Como estas', '¿Cómo estás?'],
    ['نعم أعرف', 'نعم، أعرف'],
    ['我去学校，他在家。', '我去了学校，他不在家。'],
    ['line one\nline two', 'line one\nline two!'],
  ])('keeps the corrected sentence intact: %j → %j', (original, corrected) => {
    const runs = foldCorrection(original, corrected)
    const text = runs
      .filter((run) => run.kind !== 'removed')
      .map((run) => run.text)
      .join('')
    const squash = (value: string): string => value.replace(/\s+/g, ' ').trim()
    expect(squash(text)).toBe(squash(corrected))
  })
})
