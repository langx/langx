import { describe, expect, it } from 'vitest'
import { findFormatting, stripFormatting, SPOILER_MASK } from './formatting'

/** Each span as `style:words`, the words without their markers. */
function spans(text: string): string[] {
  return findFormatting(text).map((span) => {
    const length = span.style === 'spoiler' ? 2 : 1
    return `${span.style}:${text.slice(span.start + length, span.end - length)}`
  })
}

describe('findFormatting', () => {
  it('finds each of the four styles', () => {
    expect(spans('a *bold* b')).toEqual(['bold:bold'])
    expect(spans('a _italic_ b')).toEqual(['italic:italic'])
    expect(spans('a ~gone~ b')).toEqual(['strike:gone'])
    expect(spans('a ||secret|| b')).toEqual(['spoiler:secret'])
    expect(spans('*one* and _two_')).toEqual(['bold:one', 'italic:two'])
  })

  it('cuts the text with the markers included', () => {
    expect(findFormatting('x *hi* y')).toEqual([{ start: 2, end: 6, style: 'bold' }])
    expect(findFormatting('||a b||')).toEqual([{ start: 0, end: 7, style: 'spoiler' }])
  })

  it('takes several words, and punctuation around the markers', () => {
    expect(spans('*very good*')).toEqual(['bold:very good'])
    expect(spans('(*yes*), _no_!')).toEqual(['bold:yes', 'italic:no'])
    expect(spans('«_bien_»')).toEqual(['italic:bien'])
  })

  it('works in any script', () => {
    expect(spans('это *очень* важно')).toEqual(['bold:очень'])
    expect(spans('هذا _مهم_ جدا')).toEqual(['italic:مهم'])
    expect(spans('*çok güzel*')).toEqual(['bold:çok güzel'])
  })

  it('leaves markers that do not hug their words', () => {
    expect(spans('* x *')).toEqual([])
    expect(spans('*x *')).toEqual([])
    expect(spans('|| x ||')).toEqual([])
    expect(spans('a * b')).toEqual([])
  })

  it('leaves markers inside a word alone', () => {
    expect(spans('snake_case_name')).toEqual([])
    expect(spans('2*3*4')).toEqual([])
    expect(spans('a~b~c')).toEqual([])
    expect(spans('x||y||z')).toEqual([])
    expect(spans('*bold*er')).toEqual([])
  })

  it('does not nest, and does not cross a line break', () => {
    expect(spans('*a _b_ c*')).toEqual(['bold:a _b_ c'])
    expect(spans('*one\ntwo*')).toEqual([])
    expect(spans('*one*\n*two*')).toEqual(['bold:one', 'bold:two'])
  })

  it('reads a doubled marker as text', () => {
    expect(spans('**bold**')).toEqual([])
    expect(spans('__init__')).toEqual([])
    expect(spans('|||x|||')).toEqual([])
  })

  it('leaves an address and a mention to themselves', () => {
    expect(spans('https://example.com/a_b_c')).toEqual([])
    expect(spans('see langx.io/_x_ ok')).toEqual([])
    expect(spans('@a_b_c hi')).toEqual([])
  })

  it('lets a whole link or mention sit inside a span', () => {
    expect(spans('*see langx.io today*')).toEqual(['bold:see langx.io today'])
    expect(spans('*ask @deniz*')).toEqual(['bold:ask @deniz'])
    // `_` can be part of a handle, so here the mention takes the closer.
    expect(spans('_ask @deniz_')).toEqual([])
  })

  it('pairs the first closer, and leaves an unmatched opener as text', () => {
    expect(spans('*a *b* c*')).toEqual(['bold:a *b'])
    expect(spans('*open and never closed')).toEqual([])
  })

  /*
   * The shape CodeQL flagged in `sentences.ts`: a long run of markers with no
   * valid closer. Generous limits — the point is linear against quadratic,
   * which at 50,000 characters is milliseconds against minutes.
   */
  it.each(['*', '_', '~', '|'])('stays linear on 50,000 × %s', (marker) => {
    for (const text of [
      marker.repeat(50_000),
      `${marker}a `.repeat(17_000),
      `a${marker}`.repeat(25_000),
      `${marker}${marker}a `.repeat(12_500),
    ]) {
      const started = Date.now()
      findFormatting(text)
      stripFormatting(text)
      expect(Date.now() - started).toBeLessThan(1000)
    }
  })
})

describe('stripFormatting', () => {
  it('drops the markers', () => {
    expect(stripFormatting('a *bold* _it_ ~no~ b')).toBe('a bold it no b')
  })

  it('hides what a spoiler covers', () => {
    expect(stripFormatting('he dies: ||the butler did it||')).toBe(`he dies: ${SPOILER_MASK}`)
  })

  it('returns text with nothing to strip unchanged', () => {
    expect(stripFormatting('2*3*4 = 24, snake_case')).toBe('2*3*4 = 24, snake_case')
    expect(stripFormatting('')).toBe('')
  })
})
