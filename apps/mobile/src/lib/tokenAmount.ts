import type { Locale } from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n/runtime'

/*
 * A token amount drawn as a number and the token icon — "+23 ●" rather than
 * "+23 tokens" — in the redesign.
 *
 * The icon is a picture a screen reader cannot see, so every amount drawn
 * this way carries a label that is the sentence it replaced, built from the
 * plural entry the word came from: a reader hears "23 tokens", "23 jeton" or
 * "23 رمزًا", never a bare "23".
 *
 * The icon's place inside a translated sentence is a marker character the
 * translation never contains. The screen asks for the sentence with the
 * marker beside the number (`tokenSlot`), and `TokenText` draws the icon
 * where the marker landed — so "Protect · 200 ●" puts the icon after the
 * number in every language without anyone knowing where the number sits in
 * each one.
 */

/** Unicode private use: no catalogue, no name and no number can contain it. */
export const TOKEN_MARK = ''

/**
 * How the token icon sits beside text of a given size, as the design review
 * settled it: a full em up to body sizes,
 * where anything smaller read as a speck at 12pt, and 0.85em from display
 * sizes up, where a full em's points rose visibly above the digits. Both
 * centre it on Nunito's cap height; the drop is how far below the baseline
 * the box's foot goes to get there.
 */
export function tokenIconMetrics(fontSize: number): { size: number; gap: number; drop: number } {
  const display = fontSize >= 24
  return {
    size: Math.round(fontSize * (display ? 0.85 : 1)),
    gap: Math.round(fontSize * (display ? 0.12 : 0.14)),
    drop: Math.round(fontSize * (display ? 0.06 : 0.12)),
  }
}

/** The digits alone, grouped as the locale groups them ("1,500", "1.500"). */
export function formatTokenCount(count: number, locale: Locale): string {
  return Math.abs(count).toLocaleString(locale)
}

export type TokenSign = '' | '+' | '−'

/**
 * "23 tokens", said: what the icon and the number stand for together.
 * `count` picks the plural and is always taken as the magnitude; `sign` is
 * printed as the screen prints it.
 */
export function tokenAmountLabel(
  t: TranslateFn,
  count: number,
  locale: Locale,
  sign: TokenSign = '',
): string {
  return t('wallet.price', {
    count: Math.abs(count),
    amount: sign + formatTokenCount(count, locale),
  })
}

/**
 * Which side of the number the icon sits on, read from the translation itself
 * rather than kept as a second table that could disagree with it. Every
 * language the app ships today writes the number first ("23 tokens", "23
 * jeton", "23 رمزًا" — the layout's own RTL flip takes care of Arabic's
 * direction), but a translator who puts the unit first is followed without a
 * code change.
 *
 * Probed with five, not one: Arabic's singular is "رمز واحد", "one token",
 * with no digit in it to find.
 */
export function tokenIconSide(t: TranslateFn): 'before' | 'after' {
  const text = t('wallet.price', { count: 5, amount: TOKEN_MARK }).trim()
  return text.endsWith(TOKEN_MARK) && !text.startsWith(TOKEN_MARK) ? 'before' : 'after'
}

/** The number with the icon's marker on the side the language puts its unit. */
export function tokenSlot(
  t: TranslateFn,
  count: number,
  locale: Locale,
  sign: TokenSign = '',
): string {
  const digits = sign + formatTokenCount(count, locale)
  return tokenIconSide(t) === 'before' ? TOKEN_MARK + digits : digits + TOKEN_MARK
}

/**
 * A sentence some other key already printed an amount into ("+15 for both"),
 * with the icon's marker put beside the first `printed` in it. For keys whose
 * placeholder is `{count}` itself, where a marker cannot ride in the
 * placeholder without costing the plural its number. Unchanged when the
 * amount is not there.
 */
export function markAmount(t: TranslateFn, text: string, printed: string): string {
  const at = text.indexOf(printed)
  if (at < 0) return text
  const end = at + printed.length
  return tokenIconSide(t) === 'before'
    ? text.slice(0, at) + TOKEN_MARK + text.slice(at)
    : text.slice(0, end) + TOKEN_MARK + text.slice(end)
}

/** A sentence cut where its icons go: text, icon, text, … — always odd in length. */
export function splitTokenMarks(text: string): string[] {
  return text.split(TOKEN_MARK)
}

/**
 * A sentence with an amount in it, twice: as it is drawn (`text`, with the
 * marker where the icon goes) and as it is said (`label`, the same sentence
 * with "200 tokens" in words). `slot` names the placeholder the amount fills.
 *
 * For a key whose sentence already carries the word, the screen keeps that
 * key for the label and hands its icon twin here as `key` — see `spokenKey`.
 */
export function tokenSentence(
  t: TranslateFn,
  key: MessageKey,
  {
    count,
    locale,
    sign = '',
    slot = 'amount',
    params = {},
    spokenKey,
  }: {
    count: number
    locale: Locale
    sign?: TokenSign
    slot?: string
    params?: Record<string, string | number>
    /** A sentence that says the unit itself ("Protect · {count} tokens"), for the label. */
    spokenKey?: MessageKey
  },
): { text: string; label: string } {
  const text = t(key, {
    ...params,
    count: Math.abs(count),
    [slot]: tokenSlot(t, count, locale, sign),
  })
  const label = spokenKey
    ? t(spokenKey, {
        ...params,
        count: Math.abs(count),
        [slot]: sign + formatTokenCount(count, locale),
      })
    : t(key, {
        ...params,
        count: Math.abs(count),
        [slot]: tokenAmountLabel(t, count, locale, sign),
      })
  return { text, label }
}

/** A sentence with no amount in it, in `tokenSentence`'s shape. */
export function plain(text: string): { text: string; label: string } {
  return { text, label: text }
}

/** `tokenSentence` as a `Button`'s two props: the label it draws and the one it says. */
export function tokenButton(...args: Parameters<typeof tokenSentence>): {
  label: string
  accessibilityLabel: string
} {
  const { text, label } = tokenSentence(...args)
  return { label: text, accessibilityLabel: label }
}

/** Several of `tokenSentence`'s pairs as one, skipping the absent ones. */
export function joinSentences(
  parts: readonly ({ text: string; label: string } | null)[],
  separator: string,
): { text: string; label: string } {
  const present = parts.filter((part) => part !== null)
  return {
    text: present.map((part) => part.text).join(separator),
    label: present.map((part) => part.label).join(separator),
  }
}
