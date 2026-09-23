import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import { useLinkPreview } from '../api/queries'
import { openExternal } from '../lib/openExternal'
import { makeStyles } from '../lib/theme'

interface LinkPreviewCardProps {
  url: string
  /** The bubble's long press — see `LinkedText` for why a child has to carry it. */
  onLongPress?: () => void
}

/**
 * What a linked page says about itself, under the message that links it.
 *
 * Draws nothing until there is something to draw, and nothing at all when the
 * page had no card to give — no skeleton, because most sentences with a link
 * in them read perfectly well without one, and a grey box that sometimes
 * turns into nothing would be the worse message of the two.
 *
 * The picture is our copy in the bucket, never the page's own address, so
 * scrolling past this tells no stranger's server who is reading.
 */
export function LinkPreviewCard({ url, onLongPress }: LinkPreviewCardProps) {
  const styles = useStyles()
  const { data: preview } = useLinkPreview(url)
  if (!preview) return null

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={preview.title}
      onPress={() => {
        void openExternal(preview.url)
      }}
      {...(onLongPress ? { onLongPress } : {})}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {preview.image ? (
        <Image
          source={{ uri: preview.image }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          accessible={false}
        />
      ) : null}
      <View style={styles.body}>
        <Text style={styles.site} numberOfLines={1}>
          {preview.siteName}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {preview.title}
        </Text>
        {preview.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font }) => ({
  /**
   * A fixed width, capped by the bubble: a message that is only a short
   * address would otherwise shrink the card to the address, and a card the
   * width of "x.com" has no room for a title. 260 is what a 78% bubble leaves
   * inside its padding on the narrowest phone we draw for.
   */
  card: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    marginTop: 10,
    maxWidth: '100%',
    overflow: 'hidden',
    width: 260,
  },
  pressed: { opacity: 0.85 },
  // Open Graph's own 1.91:1, so the usual share image is not cropped.
  image: { aspectRatio: 1.91, backgroundColor: colors.fill, width: '100%' },
  body: { gap: 2, paddingHorizontal: 12, paddingVertical: 10 },
  site: { ...font.caption, color: colors.textMuted },
  title: { ...font.label, color: colors.text, fontSize: 14, lineHeight: 19 },
  description: { ...font.caption, color: colors.textMuted, lineHeight: 17 },
}))
