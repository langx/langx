import { TIMEZONE_UPDATE_COOLDOWN_MS } from '@langx/shared'

/**
 * The zone to write to the profile, or `null` when there is nothing to write.
 *
 * Pure, and separate from the hook, for the reason `locationRefresh` gives:
 * this is the decision, the hook is only the wiring.
 *
 * The cooldown is the server's — it refuses a change inside it with
 * `RATE_LIMITED`, because the streak runs on the profile's local day. Checking
 * it here as well is not a second rule, it is just not sending a request that
 * is already known to fail, on every foreground, for a week.
 */
export function timezoneToSync(input: {
  /** `Intl…resolvedOptions().timeZone`; may be empty on a runtime that has none. */
  deviceZone: string | undefined
  profileZone: string | undefined
  timezoneUpdatedAt: string | undefined
  now?: Date
}): string | null {
  const { deviceZone, profileZone, timezoneUpdatedAt } = input
  if (!deviceZone || deviceZone === profileZone || !isKnownZone(deviceZone)) return null
  // Nothing on file: the account predates the field, or came over from v1.
  // The server lets a first zone through without a cooldown.
  if (!profileZone || !timezoneUpdatedAt) return deviceZone

  const at = Date.parse(timezoneUpdatedAt)
  // Unparseable is what the server also lets through; a future date is clock
  // skew, and the server would refuse it.
  if (Number.isNaN(at)) return deviceZone
  const now = (input.now ?? new Date()).getTime()
  return now - at >= TIMEZONE_UPDATE_COOLDOWN_MS ? deviceZone : null
}

/**
 * The profile keeps any non-empty string, and a zone this runtime cannot
 * format would sit there making every clock drawn from it fall back to UTC.
 */
function isKnownZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}
