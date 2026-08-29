import Feather from '@expo/vector-icons/Feather'
import type { LikeTargetType } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useSetLike } from '../api/queries'
import { useT } from '../i18n'
import { openLikers } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'

interface LikeButtonProps {
  targetType: LikeTargetType
  targetId: string
  likeCount: number
  likedByViewer: boolean
  /** Hidden on your own content, which the server refuses to like anyway. */
  disabled?: boolean
  from: string
}

/**
 * The heart and the count beside it, as two separate controls.
 *
 * They are separate on purpose: the heart says "this helped" and the count
 * opens who else thought so. Merging them into one target would make finding
 * out who liked something cost a like — which is the mistake that teaches
 * people not to tap counts.
 */
export function LikeButton({
  targetType,
  targetId,
  likeCount,
  likedByViewer,
  disabled,
  from,
}: LikeButtonProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const setLike = useSetLike()

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={likedByViewer ? t('feed.unlike') : t('feed.like')}
        accessibilityState={{ selected: likedByViewer, disabled: Boolean(disabled) }}
        disabled={disabled}
        hitSlop={8}
        onPress={() => setLike.mutate({ targetType, targetId, liked: !likedByViewer })}
        style={({ pressed }) => [styles.heart, pressed && styles.pressed]}
      >
        <Feather name="heart" size={17} color={likedByViewer ? colors.danger : colors.textMuted} />
      </Pressable>

      {likeCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => openLikers(targetType, targetId, from)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.count}>{t('feed.likes', { count: likeCount })}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  heart: { alignItems: 'center', justifyContent: 'center', minHeight: 28, minWidth: 28 },
  count: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
