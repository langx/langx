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

/**
 * "12 min", "3 h", "2 d" — how stale something is, in one or two characters.
 *
 * Coarse on purpose. A feed post is either fresh enough to still want an answer
 * or it is not, and "12 minutes ago" spends a line saying what "12 min" says in
 * a corner. Anything past a week gets the date, because at that point the age
 * matters less than when it was.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''

  const seconds = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
