import { describe, expect, it } from 'vitest'
import { decodeBody } from './linkPreview'
import { decodeEntities, parseMeta } from './parseMeta'

const BASE = new URL('https://example.com/articles/one')

describe('parseMeta', () => {
  it('prefers Open Graph over the title tag', () => {
    const html = `<html><head>
      <title>Plain title</title>
      <meta property="og:title" content="OG title">
      <meta property="og:description" content="What it is about">
      <meta property="og:site_name" content="Example">
      <meta property="og:image" content="/img/cover.jpg">
    </head><body></body></html>`
    expect(parseMeta(html, BASE)).toEqual({
      title: 'OG title',
      description: 'What it is about',
      siteName: 'Example',
      image: 'https://example.com/img/cover.jpg',
    })
  })

  it('falls back to twitter tags, then the title and the plain description', () => {
    const html = `<head><title> Just a
      title </title><meta name="description" content='Single quoted'>
      <meta name="twitter:image" content="https://cdn.example.com/x.png"></head>`
    expect(parseMeta(html, BASE)).toEqual({
      title: 'Just a title',
      description: 'Single quoted',
      siteName: null,
      image: 'https://cdn.example.com/x.png',
    })
  })

  it('reads attributes in either order', () => {
    const html = '<meta content="Reversed" property="og:title">'
    expect(parseMeta(html, BASE).title).toBe('Reversed')
  })

  it('ignores what is in the body', () => {
    const html = '<head></head><body><meta property="og:title" content="Injected"></body>'
    expect(parseMeta(html, BASE).title).toBeNull()
  })

  it('decodes entities and caps the length', () => {
    const html = `<meta property="og:title" content="Tom &amp; Jerry &#8212; &#x1F600; &quot;hi&quot;">
      <meta property="og:description" content="${'a'.repeat(400)}">`
    const meta = parseMeta(html, BASE)
    expect(meta.title).toBe('Tom & Jerry — 😀 "hi"')
    expect(meta.description).toHaveLength(300)
    expect(meta.description?.endsWith('…')).toBe(true)
  })

  it('drops an image that is not http(s)', () => {
    const html = '<meta property="og:image" content="javascript:alert(1)">'
    expect(parseMeta(html, BASE).image).toBeNull()
  })
})

describe('decodeEntities', () => {
  it('leaves an unknown name as written', () => {
    expect(decodeEntities('a &bogus; b')).toBe('a &bogus; b')
  })
})

describe('decodeBody', () => {
  it('uses the charset the header names', () => {
    const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]) // "café" in ISO-8859-1
    expect(decodeBody(latin1, 'text/html; charset=iso-8859-1')).toBe('café')
  })

  it('reads a charset the page declares itself', () => {
    const html = Buffer.concat([
      Buffer.from('<meta charset="windows-1251"><title>'),
      Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]), // "Привет"
      Buffer.from('</title>'),
    ])
    expect(decodeBody(html, 'text/html')).toContain('Привет')
  })

  it('falls back to UTF-8 for a label it does not know', () => {
    expect(decodeBody(Buffer.from('héllo'), 'text/html; charset=nonsense')).toBe('héllo')
  })
})
