import { countryFlag, getCountry } from '@langx/shared'
import * as Location from 'expo-location'
import { Platform, Text, View } from 'react-native'
import { useSetCountryFromLocation } from '../api/queries'
import { showAlert } from '../lib/alert'
import { captureLocation, reportLocationFailure } from '../lib/location'
import { makeStyles } from '../lib/theme'
import { showToast } from '../lib/toast'
import { useDisplayNames, useT } from '../i18n'
import { Button } from './ui/Button'

/**
 * `CountryFromLocation` in V-EditProfile's look, behind `flags.v3Home`.
 *
 * The handler is the current one's, copied rather than shared so the current
 * file's diff stays a switch (`countryFromLocationV3.test.ts` holds the two
 * to the same calls and words). What changes is the drawing: the value sits
 * in the 18pt surface block the username uses above it, and the correction
 * is the kit's small outlined pill with a pin rather than a blue text link —
 * the redesign holds blue to one use a screen, and the screen's one yellow
 * stays on Save. Native only, as today: the web has no reverse geocoding.
 */
export function CountryFromLocationV3({ country }: { country: string | undefined }) {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const setCountry = useSetCountryFromLocation()

  async function useMyLocation(): Promise<void> {
    const fix = await captureLocation()
    if (!fix.ok) {
      await reportLocationFailure(fix.reason, t, 'location.failedTitle')
      return
    }

    const [place] = await Location.reverseGeocodeAsync({
      latitude: fix.lat,
      longitude: fix.lng,
    })
    const code = place?.isoCountryCode?.toUpperCase()
    if (!code || !getCountry(code)) {
      await showAlert(t('location.failedTitle'), t('location.noCountry'))
      return
    }

    setCountry.mutate(code, {
      onSuccess: () => showToast(t('location.countryUpdated')),
      onError: () => void showAlert(t('location.failedTitle'), t('common.retry')),
    })
  }

  const named = country ? getCountry(country) : undefined

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('editProfile.country')}</Text>
      <View style={styles.block}>
        <Text style={styles.value} numberOfLines={1}>
          {named
            ? `${countryFlag(named.code)} ${names.country(named.code)}`
            : t('editProfile.countryUnknown')}
        </Text>
        <Text style={styles.source}>{t('editProfile.countryHint')}</Text>
      </View>
      {Platform.OS !== 'web' ? (
        <Button
          label={t('location.useMyLocation')}
          icon="map-pin"
          variant="secondary"
          size="small"
          loading={setCountry.isPending}
          style={styles.auto}
          onPress={() => void useMyLocation()}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  container: { alignItems: 'flex-start', gap: v3.space[6], width: '100%' },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg },
  block: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[8],
  },
  value: { ...v3.type.body, color: v3.colors.fg, flexShrink: 1, flex: 1, fontWeight: '600' },
  source: { ...v3.type.caption, color: v3.colors.muted, lineHeight: 18 },
  auto: { width: 'auto' },
}))
