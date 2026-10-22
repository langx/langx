import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia'
import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ColorMatrix as Matrix } from '../../lib/cameraFilters'

/**
 * The shot on the preview step with its filter drawn exactly: the same
 * matrix over the same Skia decode that `bakeCameraFilter` writes into the
 * file that is sent, so the preview is the photo, not a guess at it.
 *
 * The plain image sits underneath until Skia's decode lands, so the step
 * never opens on an empty frame; once drawn, the canvas covers it.
 */
export function FilteredPhotoV3({ uri, matrix }: { uri: string; matrix: Matrix }) {
  const image = useImage(uri)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout
        setSize({ width, height })
      }}
      pointerEvents="none"
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      {image && size ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImage
            image={image}
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fit="contain"
          >
            <ColorMatrix matrix={[...matrix]} />
          </SkiaImage>
        </Canvas>
      ) : null}
    </View>
  )
}
