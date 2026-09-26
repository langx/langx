import { Pressable, Text, View } from 'react-native'
import { useSharedProfile } from '../api/queries'
import { useDisplayNames } from '../i18n'
import { openProfile } from '../lib/navigation'
import { makeStyles } from '../lib/theme'
import { OfficialMark } from './OfficialMark'
import { Avatar } from './ui/Avatar'

interface ProfileLinkCardProps {
  handle: string
  /** The thread, so the profile's back arrow comes home to it. */
  from: string
  /** The bubble's long press — see `LinkedText` for why a child has to carry it. */
  onLongPress?: () => void
}

/**
 * The person a profile link points at, under the message that links them.
 *
 * In place of `LinkPreviewCard` for our own profile links: that card is what
 * the page says about itself, and the web build ships one empty shell for
 * every route, so it would say "LangX" for everybody. This one says who.
 *
 * Nothing until the profile arrives, and nothing if it never does — an
 * unknown or closed account leaves the link as a link, which still opens the
 * profile screen and its "not found".
 */
export function ProfileLinkCard({ handle, from, onLongPress }: ProfileLinkCardProps) {
  const styles = useStyles()
  const names = useDisplayNames()
  const { data: profile } = useSharedProfile(handle)
  if (!profile) return null

  // The same pair the boosted strip shows: what they speak, what they learn.
  const speaks = profile.nativeLanguages[0]
  const learns = profile.learning[0]

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={profile.displayName}
      // The handle the server answered with, not the one in the link: an old
      // v1 address resolves to whoever holds it now.
      onPress={() => openProfile(profile.handle, from)}
      {...(onLongPress ? { onLongPress } : {})}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Avatar url={profile.avatarUrl} name={profile.displayName} seed={profile._id} size={44} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.official ? <OfficialMark size={14} /> : null}
        </View>
        <Text style={styles.detail} numberOfLines={1}>
          @{profile.handle}
        </Text>
        {speaks && learns ? (
          <Text style={styles.detail} numberOfLines={1}>
            {`${names.language(speaks.code)} → ${names.language(learns.code)}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  // `LinkPreviewCard`'s frame, so the two read as the same kind of thing.
  card: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 260,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  name: { ...font.label, color: colors.text, flexShrink: 1, fontSize: 14, lineHeight: 19 },
  detail: { ...font.caption, color: colors.textMuted, lineHeight: 17 },
}))
