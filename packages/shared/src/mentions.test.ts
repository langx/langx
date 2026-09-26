import { describe, expect, it } from 'vitest'
import { findMentions } from './mentions'

function handles(text: string): string[] {
  return findMentions(text).map((mention) => mention.handle)
}

function cut(text: string): string[] {
  return findMentions(text).map((mention) => text.slice(mention.start, mention.end))
}

describe('findMentions', () => {
  it('finds a handle, with its @ inside the cut', () => {
    const text = 'ask @deniz about it'
    expect(findMentions(text)).toEqual([{ start: 4, end: 10, handle: 'deniz' }])
    expect(cut(text)).toEqual(['@deniz'])
  })

  it('finds every one, at the start and the end of the text', () => {
    expect(handles('@anna and @deniz_2')).toEqual(['anna', 'deniz_2'])
  })

  it('lowercases the handle but cuts the text as written', () => {
    const text = 'hi @Deniz!'
    expect(handles(text)).toEqual(['deniz'])
    expect(cut(text)).toEqual(['@Deniz'])
  })

  it('leaves the punctuation around it outside', () => {
    expect(cut('(@deniz), "@anna". @kerem? @mia\'s')).toEqual(['@deniz', '@anna', '@kerem', '@mia'])
  })

  it('does not read an email address as a mention', () => {
    expect(findMentions('write to anna@gmail.com')).toEqual([])
    expect(findMentions('anna_b@gmail.com, a.b@example.org, 42@example.org')).toEqual([])
  })

  it('takes @deniz.com as a mention followed by text, the way a missed space would', () => {
    expect(cut('@deniz.com')).toEqual(['@deniz'])
  })

  it('does not read an @ inside an address', () => {
    expect(findMentions('https://medium.com/@deniz/a-post')).toEqual([])
    expect(findMentions('@@deniz')).toEqual([])
  })

  it('holds the word to the handle rule: length, first letter, alphabet', () => {
    expect(findMentions('@ab')).toEqual([])
    expect(handles('@abc')).toEqual(['abc'])
    expect(handles(`@a${'b'.repeat(19)}`)).toEqual([`a${'b'.repeat(19)}`])
    expect(findMentions(`@a${'b'.repeat(20)}`)).toEqual([])
    expect(findMentions('@1deniz @_deniz')).toEqual([])
  })

  it('does not cut a handle out of a longer word in another script', () => {
    expect(findMentions('@ahmetçan')).toEqual([])
    expect(findMentions('@анна')).toEqual([])
  })

  it('finds one after a letter in another script only when a space separates them', () => {
    expect(findMentions('merhabaç@deniz')).toEqual([])
    expect(handles('merhaba @deniz')).toEqual(['deniz'])
  })

  it('stays linear on a long run of @ and letters', () => {
    const text = '@a'.repeat(50_000)
    const started = Date.now()
    findMentions(text)
    expect(Date.now() - started).toBeLessThan(500)
  })
})
