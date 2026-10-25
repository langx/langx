import {
  Canvas,
  ColorMatrix,
  Group,
  Image as SkiaImage,
  useVideo,
} from '@shopify/react-native-skia'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ColorMatrix as Matrix } from '../../lib/cameraFilters'

/**
 * The clip on the preview step with its filter drawn exactly, looping with
 * its sound: the video twin of `FilteredPhotoV3`. Skia decodes the frames so
 * the same matrix `filterVideo` writes into the sent file is laid over them
 * here, rather than a tint that only leans the same way.
 *
 * Skia hands frames over as stored, so a phone held upright gives a clip
 * stored on its side with a quarter turn to apply: the frame is turned back
 * about the frame's centre and fitted whole, as the plain player's `contain`.
 */
export function FilteredVideoV3({ uri, matrix }: { uri: string; matrix: Matrix }) {
  const { currentFrame, rotation, size: stored } = useVideo(uri, { looping: true, volume: 1 })
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const turned = rotation === 90 || rotation === 270
  const upright = turned
    ? { width: stored.height, height: stored.width }
    : { width: stored.width, height: stored.height }
  const scale =
    box && upright.width > 0 && upright.height > 0
      ? Math.min(box.width / upright.width, box.height / upright.height)
      : 0
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setBox({ width, height })
      }}
      pointerEvents="none"
    >
      {box && scale > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group
            transform={[
              { translateX: box.width / 2 },
              { translateY: box.height / 2 },
              { rotate: (rotation * Math.PI) / 180 },
              { scale },
            ]}
          >
            <SkiaImage
              image={currentFrame}
              x={-stored.width / 2}
              y={-stored.height / 2}
              width={stored.width}
              height={stored.height}
              fit="fill"
            >
              <ColorMatrix matrix={[...matrix]} />
            </SkiaImage>
          </Group>
        </Canvas>
      ) : null}
    </View>
  )
}
