import { describe, expect, it } from 'vitest'
import { boxesFromValue, editBox, valueFromBoxes, type DateBoxes } from './birthDateBoxes'

/** Keystrokes into one box, each one a change event as the browser sends it. */
function typeInto(boxes: DateBoxes, field: keyof DateBoxes, keys: string): DateBoxes {
  let next = boxes
  for (const key of keys) next = editBox(next, field, next[field] + key)
  return next
}

describe('birth date boxes', () => {
  it('reads a stored date into its boxes', () => {
    expect(boxesFromValue('1995-06-15')).toEqual({ year: '1995', month: '06', day: '15' })
    expect(boxesFromValue('')).toEqual({ year: '', month: '', day: '' })
  })

  it('pads a single digit once the date is real', () => {
    expect(valueFromBoxes({ year: '1995', month: '5', day: '5' })).toBe('1995-05-05')
  })

  it('leaves a date that does not exist as typed', () => {
    expect(valueFromBoxes({ year: '1990', month: '02', day: '31' })).toBe('1990-02-31')
  })

  it('takes a two-digit day typed after the year and month', () => {
    // Year first, then the month, then 25: the "2" alone is already a real
    // day, and showing its padded "02" back made the "5" bounce off the
    // box's two-character limit — the form saved 2 December.
    let boxes = typeInto(boxesFromValue(''), 'year', '1995')
    boxes = typeInto(boxes, 'month', '12')
    boxes = typeInto(boxes, 'day', '25')
    expect(boxes.day).toBe('25')
    expect(valueFromBoxes(boxes)).toBe('1995-12-25')
  })

  it('is why the field must not show the reported value back', () => {
    const afterFirstDigit = valueFromBoxes({ year: '1995', month: '12', day: '2' })
    expect(boxesFromValue(afterFirstDigit).day).toBe('02')
  })

  it('cuts each box to its length and drops anything but digits', () => {
    expect(editBox(boxesFromValue(''), 'day', '1a23')).toEqual({ year: '', month: '', day: '12' })
    expect(editBox(boxesFromValue(''), 'year', '199567')).toEqual({
      year: '1995',
      month: '',
      day: '',
    })
  })
})
