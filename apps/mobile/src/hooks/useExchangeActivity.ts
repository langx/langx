import { useEffect, useMemo } from 'react'
import { useUpcomingMeetings } from '../api/queries'
import { useProfileCache } from './useProfileCache'
import { track } from '../lib/analytics'
import {
  endAllExchangeActivities,
  endExchangeActivity,
  liveActivityIsAvailable,
  liveActivityIsSupported,
  startExchangeActivity,
} from '../../modules/live-activity'

/**
 * Keeps a Live Activity on the Lock Screen for the next call that was agreed.
 *
 * Mounted once in the signed-in layout beside `useCompanionSnapshot` and
 * `useWatchLink`, and it behaves like both: it asks for nothing new that the
 * app was not going to load, and it is a no-op on every platform and every
 * build that cannot draw one.
 *
 * **One at a time, and only the next one.** A person can have several calls
 * booked; stacking a card for each would put a row of countdowns on the Lock
 * Screen, most of them for tomorrow. The nearest one is the only one anybody
 * is about to do something about, and when it ends the next becomes nearest.
 *
 * **Nothing here ticks.** The card counts on the system's own clock, so the
 * only reasons this effect runs are the list changing or the app coming back.
 * That is also why there is no timer to end the activity at the right moment:
 * `endsAt` has already passed by the time the meeting leaves the list, and the
 * system has stopped showing it.
 */
/** Calls whose card has been counted in this process. */
const counted = new Set<string>()

export function useExchangeActivity({ enabled }: { enabled: boolean }): void {
  /*
   * Asked once, because this one cannot change: false on Android, on web, and
   * on a binary made before the module existed.
   *
   * Deliberately *not* the person's Live Activities setting, which was the
   * first version of this line and was wrong twice over. That setting can be
   * turned off and on again while the app is running, so a value read once at
   * mount goes stale; and gating the query on it means a phone that answers
   * "no" also stops asking about meetings, which is the one thing that would
   * have to change for the countdown to come back. The setting is checked in
   * the module, on every call, where a stale answer cannot outlive the call
   * that asked.
   */
  const available = useMemo(() => liveActivityIsAvailable(), [])
  const active = enabled && available

  const meetings = useUpcomingMeetings(active)

  /*
   * The soonest one. The endpoint already sorts and already bounds how far
   * ahead it looks, so this is a first rather than a search.
   */
  const next = active ? meetings.data?.[0] : undefined

  const partnerIds = useMemo(() => (next ? [next.withUserId] : []), [next])
  const partners = useProfileCache(partnerIds)
  const withName = next ? partners[next.withUserId]?.displayName : undefined

  useEffect(() => {
    if (!available) return
    if (!enabled) {
      // Sign-out. A card naming somebody must not outlive the session that
      // knew who they were — the same rule the widget blob follows.
      endAllExchangeActivities()
      return
    }
    if (next === undefined) return
    /*
     * The setting, asked now rather than remembered: somebody can turn Live
     * Activities off in Settings while the app is open, and an answer from
     * mount would outlive the truth.
     */
    if (!liveActivityIsSupported()) return
    /*
     * A name we do not have yet is a reason to wait, not to draw. The profile
     * cache fills a moment later and this effect runs again; a card that said
     * the call was with nobody would be worse than one that arrived late.
     */
    if (withName === undefined || withName.length === 0) return

    const startsAt = new Date(next.startsAt)
    const endsAt = new Date(startsAt.getTime() + next.durationMinutes * 60 * 1000)
    startExchangeActivity({
      conversationId: next.conversationId,
      withName,
      startsAt,
      endsAt,
    })
    /*
     Counted once per call per launch — this effect runs again whenever the
     upcoming list or the name cache refreshes, and phase 7 wants cards, not
     renders. See `live_activity_started` in `analyticsEvents.ts`.
    */
    if (!counted.has(next.conversationId)) {
      counted.add(next.conversationId)
      track({
        name: 'live_activity_started',
        properties: {
          minutes_ahead: Math.max(0, Math.round((startsAt.getTime() - Date.now()) / 60_000)),
        },
      })
    }

    return () => {
      // The call left the list, or another one is nearer. Either way this
      // card is no longer the one to show.
      endExchangeActivity(next.conversationId)
    }
  }, [enabled, available, next, withName])
}
