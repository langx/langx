import { useEffect } from 'react'
import { useEchoSummary, useMe, useUnreadTotal } from '../api/queries'
import { useLocale, useT } from '../i18n'
import { buildCompanionSnapshot } from '../lib/companionSnapshot'
import { clearCompanionSnapshot, writeCompanionSnapshot } from '../../modules/companion-snapshot'

/**
 * Keeps the iOS widgets fed.
 *
 * Mounted once in the signed-in layout, beside the socket and the daily
 * check-in, for the reason that file gives: a hook living on one screen only
 * runs for people who open that screen, and the Home Screen has to be right
 * for everybody.
 *
 * It adds one request to an app launch — `GET /echo/summary`, which only the
 * Echo tab asked for before. The other two are already cached: the unread
 * total drives the tab badge, and the profile is read by half the app.
 *
 * Writes whenever any of the three change. That covers the app's own doing —
 * a chat read, a review finished, a check-in advancing the streak — because
 * each of those already invalidates one of these queries. What it does not
 * cover is the phone sitting closed while messages arrive; the notification
 * service extension handles that, by editing the same blob as the pushes pass.
 */
export function useCompanionSnapshot({ enabled }: { enabled: boolean }): void {
  const { locale } = useLocale()
  const t = useT()
  const unread = useUnreadTotal(enabled)
  const me = useMe(enabled)
  const echo = useEchoSummary(enabled)

  const unreadTotal = unread.data
  const streak = me.data?.streak
  const echoDue = echo.data?.due
  const echoNextDue = echo.data?.nextDue

  useEffect(() => {
    /*
     * Not signed in, or signed out a moment ago: take the blob away rather
     * than leaving the last reading on a Home Screen that may not be theirs.
     * Cheap and idempotent — removing a key that is not there is a no-op, and
     * the widget draws the same empty state either way.
     */
    if (!enabled) {
      clearCompanionSnapshot()
      return
    }

    // Partial data writes nothing. A snapshot with a real streak and a
    // placeholder zero beside it is worse than the one from an hour ago.
    if (unreadTotal === undefined || streak === undefined || echoDue === undefined) return

    writeCompanionSnapshot(
      buildCompanionSnapshot(
        { unread: unreadTotal, profile: { streak }, echo: { due: echoDue, nextDue: echoNextDue } },
        locale,
        t,
      ),
    )
  }, [enabled, unreadTotal, streak, echoDue, echoNextDue, locale, t])
}
