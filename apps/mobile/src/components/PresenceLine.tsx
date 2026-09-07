import { isOnlineAt } from '@langx/shared'
import { Text } from 'react-native'
import { useT } from '../i18n'
import { lastSeenLabel } from '../i18n/labels'
import { makeStyles } from '../lib/theme'

interface PresenceLineProps {
  /**
   * Absent means hidden, not unknown. `toPublicProfile` omits the field
   * entirely when `privacy.hideOnlineStatus` is set, so the privacy rule is
   * enforced by the shape of the payload and this component needs no second
   * check — there is nothing here to leak.
   */
  lastActiveAt?: string | undefined
}

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
 */
export function PresenceLine({ lastActiveAt }: PresenceLineProps) {
  const t = useT()
  const styles = useStyles()
  if (!lastActiveAt) return null

  const at = new Date(lastActiveAt)
  if (Number.isNaN(at.getTime())) return null

  if (isOnlineAt(at)) {
    return (
      <Text style={styles.online} numberOfLines={1}>
        {t('presence.online')}
      </Text>
    )
  }
  return (
    <Text style={styles.lastSeen} numberOfLines={1}>
      {lastSeenLabel(t, at)}
    </Text>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  // v3 drops the green dot: the colour of the word is the whole signal —
  // accent while they are here, faint once they are not.
  online: { ...font.caption, color: colors.accent, fontSize: 13 },
  lastSeen: { ...font.caption, color: colors.textFaint, fontSize: 13 },
}))
