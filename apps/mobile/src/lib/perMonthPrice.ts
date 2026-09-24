/**
 * What a yearly price comes to a month, written the way the store wrote the
 * yearly price — or `null` when that price string cannot be read back, in
 * which case the caller keeps the store's own per-month text.
 *
 * **Truncated, not rounded.** The yearly prices are picked so that a year
 * reads as a `.99` month: `$83.99` for `$6.99`, `₺1.799,99` for `₺149,99`.
 * That is `12 × month + 0.11`, which only survives the division if the
 * cents are cut off — `83.99 ÷ 12 = 6.99917`, and the stores' own per-month
 * strings round that to `$7.00`. Rounding cannot be designed around either:
 * above about 100 units Apple sells only `.99` endings, and no `.99` yearly
 * rounds to a `.99` month. The error is under one minor unit a month, and the
 * charge itself is always stated beside it in the store's own words.
 *
 * The format is copied from the yearly string rather than rebuilt with `Intl`:
 * the store formats in the storefront's locale, which is not the device's, and
 * a per-month figure in a different style from the price under it reads as a
 * different currency. Pure, and in `src/lib`, so vitest reaches it.
 */
export function perMonthPriceString(yearlyPriceString: string, yearlyPrice: number): string | null {
  if (!Number.isFinite(yearlyPrice) || yearlyPrice <= 0) return null

  const numeric = NUMERIC.exec(yearlyPriceString)
  if (!numeric) return null
  const text = numeric[0]
  const digits = [...text].filter(isDigit)
  const value = Number(digits.map(asciiDigit).join(''))

  // How many of the digits are the fraction: the count that reads back as the
  // price. `$83.90` is 8390 at two, `¥13,200` is 13200 at none.
  let fractionDigits = -1
  for (let places = 0; places <= 3; places++) {
    if (Math.round(yearlyPrice * 10 ** places) === value) {
      fractionDigits = places
      break
    }
  }
  if (fractionDigits < 0) return null

  // Every separator is a grouping mark except the one before the fraction.
  const wholeDigits = digits.length - fractionDigits
  let decimalMark = ''
  let groupMark = ''
  let seen = 0
  for (const char of text) {
    if (isDigit(char)) {
      seen++
    } else if (fractionDigits > 0 && seen === wholeDigits) {
      decimalMark = char
    } else if (!groupMark) {
      groupMark = char
    }
  }
  if (fractionDigits > 0 && !decimalMark) return null

  const minorPerMonth = Math.floor(value / 12)
  const scale = 10 ** fractionDigits
  const whole = String(Math.floor(minorPerMonth / scale))
  const fraction = String(minorPerMonth % scale).padStart(fractionDigits, '0')
  // A locale that did not group the yearly figure does not group a smaller one.
  const grouped = groupMark ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupMark) : whole
  const number = fractionDigits > 0 ? `${grouped}${decimalMark}${fraction}` : grouped

  // Back into the digit set the store used — Arabic storefronts may not use 0–9.
  const zero = digits[0]
    ? (DIGIT_ZEROS.find((z) => digitValue(digits[0]!, z) !== null) ?? '0')
    : '0'
  const localised = [...number]
    .map((char) =>
      char >= '0' && char <= '9' ? String.fromCharCode(zero.charCodeAt(0) + Number(char)) : char,
    )
    .join('')

  return (
    yearlyPriceString.slice(0, numeric.index) +
    localised +
    yearlyPriceString.slice(numeric.index + text.length)
  )
}

/** Western, Arabic-Indic and Extended Arabic-Indic zeros. */
const DIGIT_ZEROS = ['0', '\u0660', '\u06f0'] as const

function digitValue(char: string, zero: string): number | null {
  const offset = char.charCodeAt(0) - zero.charCodeAt(0)
  return offset >= 0 && offset <= 9 ? offset : null
}

function isDigit(char: string): boolean {
  return DIGIT_ZEROS.some((zero) => digitValue(char, zero) !== null)
}

function asciiDigit(char: string): string {
  for (const zero of DIGIT_ZEROS) {
    const value = digitValue(char, zero)
    if (value !== null) return String(value)
  }
  return ''
}

/**
 * The number inside a price string: a digit, then digits and the marks
 * storefronts put between them (point, comma, apostrophe, the various spaces,
 * and the Arabic decimal and thousands marks), ending on a digit.
 */
const NUMERIC =
  /[0-9\u0660-\u0669\u06f0-\u06f9](?:[0-9\u0660-\u0669\u06f0-\u06f9.,'\u2019 \u00a0\u202f\u066b\u066c]*[0-9\u0660-\u0669\u06f0-\u06f9])?/
