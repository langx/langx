/**
 * "1 day", not "1 days".
 *
 * A streak of one is the single most common value there is — it is what every
 * user sees on the day they start — so the plural-by-default version is wrong
 * in exactly the place most people meet it.
 */
export function days(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`
}
