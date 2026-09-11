/**
 * The device's own calendar day, `YYYY-MM-DD`.
 *
 * `toISOString().slice(0, 10)` is the obvious spelling of this and it is the
 * *UTC* day, which is a different day from the reader's for part of every day:
 * in Tokyo the UTC key is still yesterday's until nine in the morning, in
 * Istanbul until three. Anything asking "have I already done this today" on
 * behalf of the person holding the phone has to read the local calendar, and
 * `getFullYear`/`getMonth`/`getDate` are local by definition — so no timezone
 * has to be named, looked up, or kept in step with the profile's.
 *
 * Never the authority on a streak. The server decides which day an action
 * counts for, in the timezone stored on the profile (`streakDay`); this is the
 * device's approximation of the same question, and it is allowed to be loose
 * in the direction of asking again.
 */
export function deviceDayKey(at: Date = new Date()): string {
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${day}`
}
