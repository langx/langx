import { describe, expect, it } from 'vitest'
import { findLinks } from './links'

function hrefs(text: string): string[] {
  return findLinks(text).map((link) => link.href)
}

function cut(text: string): string[] {
  return findLinks(text).map((link) => text.slice(link.start, link.end))
}

describe('findLinks', () => {
  it('finds an address with a scheme, wherever it sits', () => {
    expect(hrefs('look https://langx.io/pro now')).toEqual(['https://langx.io/pro'])
    expect(hrefs('http://example.com')).toEqual(['http://example.com'])
  })

  it('opens a www. address over https but cuts the text as written', () => {
    const text = 'see www.example.com/a'
    expect(hrefs(text)).toEqual(['https://www.example.com/a'])
    expect(cut(text)).toEqual(['www.example.com/a'])
  })

  it('leaves the sentence punctuation outside the link', () => {
    expect(cut('Try https://langx.io.')).toEqual(['https://langx.io'])
    expect(cut('https://langx.io, then https://example.com!')).toEqual([
      'https://langx.io',
      'https://example.com',
    ])
    expect(cut('"https://langx.io"')).toEqual(['https://langx.io'])
  })

  it('keeps balanced parentheses and drops a wrapping one', () => {
    expect(cut('https://en.wikipedia.org/wiki/Mercury_(planet)')).toEqual([
      'https://en.wikipedia.org/wiki/Mercury_(planet)',
    ])
    expect(cut('(see https://langx.io/pro)')).toEqual(['https://langx.io/pro'])
  })

  it('finds a bare domain, with or without a path', () => {
    expect(hrefs('join me on langx.io!')).toEqual(['https://langx.io'])
    expect(cut('read hurriyet.com.tr/spor, then call')).toEqual(['hurriyet.com.tr/spor'])
    expect(hrefs('Mira spiegel.de')).toEqual(['https://spiegel.de'])
  })

  it('finds a bare domain in another script', () => {
    expect(cut('bak: hürriyet.com.tr.')).toEqual(['hürriyet.com.tr'])
  })

  it('takes a word-like ending only with a path after it', () => {
    expect(hrefs('watch youtu.be/dQw4w9WgXcQ')).toEqual(['https://youtu.be/dQw4w9WgXcQ'])
    expect(hrefs('t.me/langx')).toEqual(['https://t.me/langx'])
    expect(findLinks('ok.no problem, come.in and sit, just.do.it')).toEqual([])
  })

  it('does not light up ordinary words', () => {
    expect(findLinks('e.g. i.e. file.txt index.html Mr.Smith 3.14 v1.2')).toEqual([])
    expect(findLinks('just www. on its own')).toEqual([])
    expect(findLinks('https:// and nothing')).toEqual([])
  })

  it('leaves an email address alone', () => {
    expect(findLinks('write to anna@gmail.com or bob@mail.langx.io')).toEqual([])
  })

  it('does not match a second time inside an address it already found', () => {
    expect(cut('www.langx.io and https://langx.io/pro')).toEqual([
      'www.langx.io',
      'https://langx.io/pro',
    ])
  })

  it('needs a dotted host', () => {
    expect(findLinks('http://localhost:4000/x')).toEqual([])
  })

  it('works across scripts', () => {
    expect(cut('Посмотри https://ru.wikipedia.org/wiki/Москва, пожалуйста')).toEqual([
      'https://ru.wikipedia.org/wiki/Москва',
    ])
  })

  it('reports where each one is', () => {
    const text = 'a https://a.io b https://b.io'
    expect(findLinks(text)).toEqual([
      { start: 2, end: 14, href: 'https://a.io' },
      { start: 17, end: 29, href: 'https://b.io' },
    ])
  })
})
