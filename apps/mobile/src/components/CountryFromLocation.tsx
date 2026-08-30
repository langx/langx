import { countryFlag, getCountry } from '@langx/shared'
import * as Location from 'expo-location'
import { Linking, Platform, Text, View } from 'react-native'
import { useSetCountryFromLocation } from '../api/queries'
import { Button } from './ui/Button'
import { confirmAlert, showAlert } from '../lib/alert'
import { captureLocation, LOCATION_FAILURE_KEY } from '../lib/location'
import { makeStyles } from '../lib/theme'
import { showToast } from '../lib/toast'
import { useDisplayNames, useT } from '../i18n'

/**
 * Where you are, and the one way to change it.
 *
 * The country is read off the connection when the profile is created, because
 * a country somebody typed makes discovery's country filter meaningless. That
 * is right almost always and wrong in the cases people actually notice — a
 * VPN, a border town, the week after moving — so the device gets a say: grant
 * location permission once and the OS's own answer replaces it. No coordinates
 * are sent; the reverse geocoding happens on the phone and only the two-letter
 * code leaves it.
 *
 * On the web there is no `reverseGeocodeAsync` at all, so the button is not
 * drawn and the value stays as the connection read it.
 */
export function CountryFromLocation({ country }: { country: string | undefined }) {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const setCountry = useSetCountryFromLocation()

  async function useMyLocation(): Promise<void> {
    const fix = await captureLocation()
    if (!fix.ok) {
      if (fix.reason === 'denied') {
        // The OS will not ask twice. Explaining where the switch is beats an
        // error that says "denied" and leaves someone with nothing to do.
        const open = await confirmAlert({
          title: t('location.deniedTitle'),
          message: t(
            Platform.OS === 'ios' ? 'location.deniedBodyIos' : 'location.deniedBodyAndroid',
          ),
          confirmLabel: t('location.openSettings'),
        })
        if (open) await Linking.openSettings()
        return
      }
      await showAlert(t('location.failedTitle'), t(LOCATION_FAILURE_KEY[fix.reason]))
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
      <View style={styles.row}>
        <Text style={styles.value}>
          {named
            ? `${countryFlag(named.code)} ${names.country(named.code)}`
            : t('editProfile.countryUnknown')}
        </Text>
        {Platform.OS !== 'web' ? (
          <Button
            label={t('location.useMyLocation')}
            variant="secondary"
            loading={setCountry.isPending}
            onPress={() => void useMyLocation()}
          />
        ) : null}
      </View>
      <Text style={styles.hint}>{t('editProfile.countryHint')}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  container: { gap: 6, width: '100%' },
  label: { ...font.label, color: colors.textMuted },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  value: { ...font.body, color: colors.text },
  hint: { ...font.caption, color: colors.textFaint },
}))
