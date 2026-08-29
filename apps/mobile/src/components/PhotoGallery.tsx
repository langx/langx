import { Image } from 'expo-image'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { makeStyles } from '../lib/theme'

/**
 * A profile's photos, and a full-screen viewer for them.
 *
 * `photos` has been returned by `toPublicProfile()` all along and drawn by
 * nothing — they were visible only on the screen where you edit them, so the
 * gallery existed for its owner and for nobody else. v1 showed it on both your
 * own profile and other people's, and on a product where strangers pick each
 * other out of a list it is most of what a profile is.
 *
 * The viewer is the app's first `Modal`. It earns it: a gallery you cannot open
 * is a row of thumbnails too small to judge a person by, which is the one thing
 * they are there for.
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

      <Modal
        visible={openAt !== null}
        transparent
        animationType="fade"
        // Android's hardware back has to close the viewer, or it closes the
        // screen behind it and the user loses their place.
        onRequestClose={() => setOpenAt(null)}
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.close} onPress={() => setOpenAt(null)} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          {openAt !== null ? (
            <Image source={{ uri: photos[openAt]!.url }} style={styles.full} contentFit="contain" />
          ) : null}
          {photos.length > 1 && openAt !== null ? (
            <View style={styles.pager}>
              <Pressable
                onPress={() => setOpenAt((openAt + photos.length - 1) % photos.length)}
                hitSlop={12}
              >
                <Text style={styles.pagerArrow}>‹</Text>
              </Pressable>
              <Text style={styles.pagerCount}>
                {openAt + 1} / {photos.length}
              </Text>
              <Pressable onPress={() => setOpenAt((openAt + 1) % photos.length)} hitSlop={12}>
                <Text style={styles.pagerArrow}>›</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  strip: { gap: spacing.sm, paddingVertical: spacing.sm },
  thumb: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 96,
    width: 96,
  },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.94)', flex: 1, justifyContent: 'center' },
  close: { position: 'absolute', right: spacing.lg, top: spacing.xxl, zIndex: 1 },
  closeText: { color: '#fff', fontSize: 24 },
  full: { flex: 1, width: '100%' },
  pager: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  pagerArrow: { color: '#fff', fontSize: 32 },
  pagerCount: { ...font.caption, color: '#fff', fontVariant: ['tabular-nums'] },
}))
