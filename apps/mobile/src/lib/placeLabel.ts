import { countryFlag, getCountry } from '@langx/shared'

/**
 * Where somebody is, as one item on a meta line: "🇨🇦 Toronto", or "🇨🇦 Canada"
 * when there is no city to say.
 *
 * One item, not two. The line used to run "Waterfront Communities-The Island
 * · 🇨🇦 Canada", the city and the country as separate entries, and wrapped to
 * a second line on most phones. The flag already names the country to anyone
 * who recognises it, and the country's name is only worth its width when it
 * is the only thing known.
 *
 * `countryName` is passed in rather than imported: the localised name comes
 * from `useDisplayNames`, a hook, and this has to stay a plain function so it
 * is testable and usable from both profile screens.
 */
export function placeLabel(
  { city, country }: { city?: string | undefined; country?: string | undefined },
  countryName: (code: string) => string,
): string | undefined {
  const known = country ? getCountry(country) : undefined
  if (!known) return city ?? country
  const flag = countryFlag(known.code)
  return `${flag} ${city ?? countryName(known.code)}`
}
