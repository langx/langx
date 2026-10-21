import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { useLocale } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { Skeleton } from '../ui/Skeleton'
import { Avatar } from '../ui/Avatar'

/**
 * One person in a v3 list of people (`V-Likes`, `V-Follows`): the face, the
 * name over the handle, and the chevron that says it opens their profile.
 *
 * The list is one grey block drawn row by row, as `BlockedScreenV3` draws
 * its own: the first row and the last carry the block's corners, every row
 * after the first a hairline above it. No entering or leaving animation —
 * these sit in a virtualised list (rule 13).
 */
export function PersonRowV3({
  person,
  first,
  last,
  onPress,
}: {
  person: {
    _id: string
    handle: string
    displayName: string
    avatarUrl?: string | undefined
    defaultAvatarRev?: string | undefined
  }
  first: boolean
  last: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first && styles.first,
        last && styles.last,
        !first && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      <Avatar
        url={person.avatarUrl}
        name={person.displayName}
        seed={person._id}
        defaultAvatarRev={person.defaultAvatarRev}
        size={48}
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {person.displayName}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{person.handle}
        </Text>
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

/** The block's placeholder while the first page is on its way: grey rows of the same height. */
export function PersonRowsSkeletonV3({ rows }: { rows: readonly string[] }) {
  const styles = useStyles()
  return (
    <View style={styles.block}>
      {rows.map((key, index) => (
        <View key={key} style={[styles.row, index > 0 && styles.divided]}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={styles.body}>
            <Skeleton width="55%" height={18} />
            <Skeleton width="35%" height={14} />
          </View>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  block: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  first: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  last: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  pressed: { backgroundColor: v3.colors.line },
  body: { flex: 1, gap: v3.space[2], minWidth: 0 },
  name: { ...v3.type.button, color: v3.colors.fg },
  handle: { ...v3.type.caption, color: v3.colors.muted },
}))
