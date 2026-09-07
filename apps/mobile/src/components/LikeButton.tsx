import Feather from '@expo/vector-icons/Feather'
import type { LikeTargetType } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useSetLike } from '../api/queries'
import { useLocale, useT } from '../i18n'
import { compactCount } from '../lib/format'
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
  /** `small` is the reply rows' size — a 15 heart with a 13 count beside it. */
  size?: 'default' | 'small'
}

/**
 * The heart and the count beside it, as two separate controls.
 *
 * They are separate on purpose: the heart says "this helped" and the count
 * opens who else thought so. Merging them into one target would make finding
 * out who liked something cost a like — which is the mistake that teaches
 * people not to tap counts.
 *
 * The count is a bare number, shown even at zero: v3 draws it as part of the
 * heart, in the heart's colour, and a heart with nothing beside it reads as
 * decoration. The word "likes" survives for screen readers, on the count's
 * label.
 */
export function LikeButton({
  targetType,
  targetId,
  likeCount,
  likedByViewer,
  disabled,
  from,
  size = 'default',
}: LikeButtonProps) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const setLike = useSetLike()
  const small = size === 'small'
  // Heart and number take the same colour: red once you have liked it, muted
  // until then.
  const tint = likedByViewer ? colors.danger : colors.textMuted

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
        <Feather name="heart" size={small ? 15 : 18} color={tint} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('feed.likes', { count: likeCount })}
        hitSlop={8}
        onPress={() => openLikers(targetType, targetId, from)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={[small ? styles.countSmall : styles.count, { color: tint }]}>
          {compactCount(likeCount, locale)}
        </Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  heart: { alignItems: 'center', justifyContent: 'center', minHeight: 28, minWidth: 28 },
  count: { fontSize: 14, fontWeight: '600' },
  countSmall: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
