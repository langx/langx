import { isCalendarDate } from '@langx/shared'

/** The web birth-date field's three boxes, as typed. */
export interface DateBoxes {
  year: string
  month: string
  day: string
}

export function boxesFromValue(value: string): DateBoxes {
  const [year = '', month = '', day = ''] = value ? value.split('-') : []
  return { year, month, day }
}

/** One box changed: digits only, cut to the box's length. */
export function editBox(boxes: DateBoxes, field: keyof DateBoxes, text: string): DateBoxes {
  const digits = text.replace(/\D/g, '').slice(0, field === 'year' ? 4 : 2)
  return { ...boxes, [field]: digits }
}

/**
 * The value reported to the form: padded to `YYYY-MM-DD` once it is a real
 * day, so "5" "5" "1995" counts as 5 May — and left as typed otherwise, since
 * a half-typed `1995-06-1` is not a date and must not be sent as one.
 *
 * The padding is for the value only. Shown back in the box it turns the "1"
 * of "15" into "01", which a two-character box then refuses to extend — so
 * the field keeps what was typed and never re-derives its boxes from this.
 */
export function valueFromBoxes({ year, month, day }: DateBoxes): string {
  if (year.length === 4 && month.length > 0 && day.length > 0) {
    const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    if (isCalendarDate(candidate)) return candidate
  }
  return `${year}-${month}-${day}`
}
