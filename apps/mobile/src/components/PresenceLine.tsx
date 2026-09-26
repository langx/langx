import { isOnlineAt } from '@langx/shared'
import { useMemo, useSyncExternalStore } from 'react'
import { Text } from 'react-native'
import { useMe } from '../api/queries'
import { useLocale, useT } from '../i18n'
import { lastSeenLabel } from '../i18n/labels'
import { currentMinute, subscribeToMinute, theirLocalTime } from '../lib/partnerClock'
import { makeStyles } from '../lib/theme'

interface PresenceLineProps {
  /**
   * Absent means hidden, not unknown. `toPublicProfile` omits the field
   * entirely when `privacy.hideOnlineStatus` is set, so the privacy rule is
   * enforced by the shape of the payload and this component needs no second
   * check — there is nothing here to leak.
   */
  lastActiveAt?: string | undefined
  /**
   * Their zone, to add what time it is for them. Only the chat headers pass
   * it — that is where "is this a sensible hour to write?" gets asked.
   *
   * Absent when they hide their city, and for the same reason as above — the
   * server withholds the timezone with the city, so nothing here decides it.
   */
  timezone?: string | undefined
}

/** For callers that pass no zone: nothing to tick for, so no timer at all. */
const neverTicks = () => () => {}

/**
 * One line under a display name: "Online" in the accent, or when they are
 * not, how long ago they were, in faint.
 *
 * One component for two screens on purpose. The profile hero and the chat
 * header each drew their own presence and had already drifted — the header said
 * "Online" and the profile said nothing at all, from the same field.
 *
 * `isOnline` is recomputed here rather than read off the DTO. The server sends
 * one, but `useProfileCache` holds a profile for five minutes, which is exactly
 * `ONLINE_WINDOW_MS`, and nothing invalidates it on a socket event — so the
 * boolean can be a five-minute-old claim that somebody is still here.
 * `isOnlineAt` is the same function the server used, so re-deriving it from the
 * timestamp lets a stale cache decay correctly instead of lying.
 *
 * With a `timezone`, their clock follows on the same line — "Online · 11:14 PM
 * for them" — and stands alone when their presence is hidden, since the two
 * are separate switches. One line still, cut from the end: the header is
 * narrow, and presence is the half worth keeping when something has to go.
 */
export function PresenceLine({ lastActiveAt, timezone }: PresenceLineProps) {
  const t = useT()
  const styles = useStyles()
  const { locale } = useLocale()
  const ownZone = useMe().data?.timezone
  /*
   * The minute as an external store, so the line re-renders once as each one
   * turns over, and the timer goes when the component does. It is read during
   * render rather than kept in state, so a zone that arrives after mount is
   * drawn against the current minute, not the one it mounted in. Server
   * snapshot too: `output: 'static'` prerenders the web build.
   */
  const minute = useSyncExternalStore(
    timezone ? subscribeToMinute : neverTicks,
    currentMinute,
    currentMinute,
  )
  const theirTime = useMemo(
    () => theirLocalTime(new Date(minute * 60_000), timezone, ownZone, locale),
    [minute, timezone, ownZone, locale],
  )

  const at = lastActiveAt ? new Date(lastActiveAt) : undefined
  const known = at !== undefined && !Number.isNaN(at.getTime())
  const online = known && isOnlineAt(at)
  const presence = !known ? null : online ? t('presence.online') : lastSeenLabel(t, at)
  if (presence === null && theirTime === null) return null

  const clock = theirTime === null ? null : t('presence.theirTime', { time: theirTime })
  return (
    <Text
      style={styles.lastSeen}
      numberOfLines={1}
      // Read as a sentence: the dot between the halves is punctuation for the
      // eye, and a screen reader says it out loud as a symbol.
      accessibilityLabel={
        presence !== null && theirTime !== null
          ? t('presence.withTheirTimeAccessibility', { presence, time: theirTime })
          : undefined
      }
    >
      {presence !== null ? (
        <Text style={online ? styles.online : undefined}>{presence}</Text>
      ) : null}
      {presence !== null && clock !== null ? ' · ' : null}
      {clock}
    </Text>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  // v3 drops the green dot: the colour of the word is the whole signal —
  // accent while they are here, faint once they are not.
  online: { ...font.caption, color: colors.accent, fontSize: 13 },
  lastSeen: { ...font.caption, color: colors.textFaint, fontSize: 13 },
}))
