import type { SharedLocationPrecision } from '@langx/shared'
import { requireOptionalNativeModule } from 'expo'
import Constants from 'expo-constants'
import type * as ExpoMapsModule from 'expo-maps'
import { memo, useMemo } from 'react'
import { Linking, Platform, Pressable, View } from 'react-native'
import { canShowMapPreview, mapPreviewShape } from '../lib/locationMapPreview'
import { mapsUrl, type SharedPoint } from '../lib/sharedLocation'
import { makeStyles, useTheme } from '../lib/theme'

type ExpoMaps = typeof ExpoMapsModule

/*
 * Asked for by name rather than through `expo-maps`, because asking is the
 * only thing that is safe everywhere. A binary built before this module — an
 * older development client, Expo Go, or a store build if a runtime-version
 * change ever failed to keep this bundle away from it — has the JS and not
 * the native half, and `requireOptionalNativeModule` answers `null` there
 * instead of throwing. `ExpoAppleMaps` is also where iOS says whether the map
 * can draw at all (17+).
 */
const appleMaps =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<{ isMapsAvailable?: boolean }>('ExpoAppleMaps')
    : null
const googleMaps =
  Platform.OS === 'android' ? requireOptionalNativeModule<object>('ExpoGoogleMaps') : null

const AVAILABLE = canShowMapPreview({
  os: Platform.OS,
  hasNativeMaps:
    (appleMaps ?? googleMaps) !== null && requireOptionalNativeModule('ExpoMaps') !== null,
  appleMapsUsable: appleMaps?.isMapsAvailable === true,
  // A boolean, not the key: `android.config` is stripped from the config an
  // app can read. The fingerprint hashes both, so an update carrying `true`
  // only ever reaches a binary that was built with the key.
  androidKeyConfigured: Constants.expoConfig?.extra?.googleMapsAndroid === true,
})

/*
 * Required, not imported, and only once the check above has passed: the
 * package's entry calls `requireNativeModule('ExpoMaps')` as it loads, which
 * throws where the module is missing — at the top of this file, that would
 * take the whole chat down with it on exactly the builds the check exists for.
 */
const Maps: ExpoMaps | null = AVAILABLE
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded on purpose, see above
    (require('expo-maps') as ExpoMaps)
  : null

interface Props {
  point: SharedPoint
  precision: SharedLocationPrecision
  /** The bubble's own long press, so holding the map still opens the menu. */
  onLongPress: () => void
}

/**
 * A small map above a shared location's card, the way WhatsApp draws one.
 * Renders nothing where the build cannot draw a map — the web, an older
 * binary, iOS 16, an Android build without a key — and the card underneath is
 * then exactly the card it was before.
 */
export function LocationMapPreview({ point, precision, onLongPress }: Props) {
  const styles = useStyles()
  if (!Maps) return null

  return (
    <Pressable
      onPress={() => void Linking.openURL(mapsUrl(point, Platform.OS)).catch(() => {})}
      onLongPress={onLongPress}
      // The "Open in Maps" link under it does the same thing and says so; a
      // second, unlabelled target would only be noise to a screen reader.
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.frame}
    >
      {/*
        `pointerEvents: 'none'` is what makes it a picture: Apple's map has no
        switch for its gestures at all, and a map that pans under a finger
        would fight the list's scroll and the bubble's swipe-to-reply. Touches
        go to the Pressable instead.
      */}
      <View style={styles.map}>
        <StaticMap maps={Maps} lat={point.lat} lng={point.lng} precision={precision} />
      </View>
    </Pressable>
  )
}

interface StaticMapProps {
  maps: ExpoMaps
  lat: number
  lng: number
  precision: SharedLocationPrecision
}

/**
 * The native view, memoised on primitives alone. The bubble re-renders for
 * reasons of its own — a reaction, a read receipt — and hands down a new
 * long-press closure each time; every prop that reached a native map would be
 * a new array, and a native re-layout, with nothing on the map changed.
 */
const StaticMap = memo(function StaticMap({ maps, lat, lng, precision }: StaticMapProps) {
  // The app's own scheme, not the system's: somebody can pick dark in
  // Settings on a phone that is light, and a light map in a dark thread is a
  // lamp switched on in the middle of it.
  const { colors, scheme } = useTheme()
  const dark = scheme === 'dark'
  const styles = useStyles()
  const shape = mapPreviewShape(precision)

  const props = useMemo(() => {
    const coordinates = { latitude: lat, longitude: lng }
    return {
      cameraPosition: { coordinates, zoom: shape.zoom },
      markers: shape.pin ? [{ coordinates }] : [],
      circles: shape.radiusMetres
        ? [
            {
              center: coordinates,
              radius: shape.radiusMetres,
              // 8-digit hex: the accent at about a quarter, so the streets
              // under the circle stay legible.
              color: `${colors.accent}40`,
              lineColor: colors.accent,
              lineWidth: 1,
            },
          ]
        : [],
    }
  }, [lat, lng, shape.zoom, shape.pin, shape.radiusMetres, colors.accent])

  if (Platform.OS === 'ios') {
    return (
      <maps.AppleMaps.View
        style={styles.fill}
        {...props}
        colorScheme={
          dark ? maps.AppleMaps.MapColorScheme.DARK : maps.AppleMaps.MapColorScheme.LIGHT
        }
        uiSettings={APPLE_UI}
        properties={APPLE_PROPERTIES}
      />
    )
  }
  return (
    <maps.GoogleMaps.View
      style={styles.fill}
      {...props}
      colorScheme={
        dark ? maps.GoogleMaps.MapColorScheme.DARK : maps.GoogleMaps.MapColorScheme.LIGHT
      }
      uiSettings={GOOGLE_UI}
      properties={GOOGLE_PROPERTIES}
    />
  )
})

/*
 * Module constants so the memo above is not undone by a fresh object per
 * render. Every control off: nothing on this map can be used, so nothing on it
 * should look usable. The Android gesture switches are belt and braces behind
 * `pointerEvents` — the Maps SDK has no lite mode through expo-maps.
 */
const APPLE_UI = {
  compassEnabled: false,
  myLocationButtonEnabled: false,
  scaleBarEnabled: false,
  togglePitchEnabled: false,
}
const APPLE_PROPERTIES = { selectionEnabled: false }
const GOOGLE_UI = {
  compassEnabled: false,
  indoorLevelPickerEnabled: false,
  mapToolbarEnabled: false,
  myLocationButtonEnabled: false,
  rotationGesturesEnabled: false,
  scrollGesturesEnabled: false,
  tiltGesturesEnabled: false,
  zoomControlsEnabled: false,
  zoomGesturesEnabled: false,
  scaleBarEnabled: false,
}
const GOOGLE_PROPERTIES = { selectionEnabled: false, isIndoorEnabled: false }

const useStyles = makeStyles(({ colors, radius }) => ({
  // Fixed, so the inverted list never has to measure a map to lay out a row.
  frame: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    height: 132,
    marginBottom: 8,
    overflow: 'hidden',
    width: 240,
  },
  map: { flex: 1, pointerEvents: 'none' },
  fill: { flex: 1 },
}))
