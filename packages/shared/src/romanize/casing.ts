/**
 * Case for a Latin string that stands in for one source letter (or digraph).
 *
 * `Щ` alone is `Shch`, but in `ЩИ` it is `SHCH`: a word written in capitals
 * stays in capitals, and a capitalised word keeps only its first letter up.
 * Uppercasing the whole replacement for a single capital would turn `Щука`
 * into `SHCHuka`.
 */
export function withCase(latin: string, upper: boolean, allCaps: boolean): string {
  if (!upper || latin.length === 0) return latin
  if (allCaps) return latin.toUpperCase()
  return latin[0]!.toUpperCase() + latin.slice(1)
}

export function isUpper(ch: string | undefined): boolean {
  return ch !== undefined && ch !== ch.toLowerCase() && ch === ch.toUpperCase()
}

export function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && ch.toLowerCase() !== ch.toUpperCase()
}

/**
 * Whether a capital at `index` belongs to a word written in capitals: the
 * next letter is a capital too, or there is no next letter and the previous
 * one is. A one-letter capital word (`Я`) is capitalised, not shouted.
 */
export function inAllCaps(chars: readonly string[], index: number): boolean {
  const next = chars[index + 1]
  if (isLetter(next)) return isUpper(next)
  const prev = chars[index - 1]
  return isLetter(prev) && isUpper(prev)
}
