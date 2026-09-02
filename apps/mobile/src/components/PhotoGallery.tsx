import { Image } from 'expo-image'
import { useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { PhotoViewer } from './PhotoViewer'
import { makeStyles } from '../lib/theme'

/**
 * A profile's photos, and a way into the full-screen viewer.
 *
 * `photos` has been returned by `toPublicProfile()` all along and drawn by
 * nothing — they were visible only on the screen where you edit them, so the
 * gallery existed for its owner and for nobody else. v1 showed it on both your
 * own profile and other people's, and on a product where strangers pick each
 * other out of a list it is most of what a profile is.
 *
 * The viewer used to live in this file, which meant the only way to have one
 * was to also have a thumbnail strip. `PhotoViewer` is that half on its own,
 * and a chat bubble and a feed card now open the same one.
 */
export function PhotoGallery({ photos }: { photos: { url: string }[] }) {
  const styles = useStyles()

  const [openAt, setOpenAt] = useState<number | null>(null)
  if (photos.length === 0) return null

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {photos.map((photo, index) => (
          <Pressable key={photo.url} onPress={() => setOpenAt(index)}>
            <Image source={{ uri: photo.url }} style={styles.thumb} contentFit="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <PhotoViewer
        photos={photos}
        index={openAt}
        onClose={() => setOpenAt(null)}
        onIndexChange={setOpenAt}
      />
    </>
  )
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  strip: { gap: spacing.sm, paddingVertical: spacing.sm },
  // `fill` is v3's photo-placeholder grey; `surface` is the ground now and
  // would leave a loading thumb invisible.
  thumb: {
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    height: 96,
    width: 96,
  },
}))
