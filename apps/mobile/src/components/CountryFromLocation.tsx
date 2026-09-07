import { countryFlag, getCountry } from '@langx/shared'
import * as Location from 'expo-location'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
import { useSetCountryFromLocation } from '../api/queries'
import { showAlert } from '../lib/alert'
import { captureLocation, reportLocationFailure } from '../lib/location'
import { makeStyles, useTheme } from '../lib/theme'
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
 * On the web there is no `reverseGeocodeAsync` at all, so the link is not
 * drawn and the value stays as the connection read it.
 *
 * Drawn as v3's read-only field: the value in a `fill` pill with where it came
 * from beside it, and the correction as a plain blue link underneath rather
 * than a button — it is the second action on a screen whose one yellow is
 * Save, and most people never need it.
 */
export function CountryFromLocation({ country }: { country: string | undefined }) {
  const styles = useStyles()
  const { colors } = useTheme()
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
      <View style={styles.pill}>
        <Text style={styles.value} numberOfLines={1}>
          {named
            ? `${countryFlag(named.code)} ${names.country(named.code)}`
            : t('editProfile.countryUnknown')}
        </Text>
        <Text style={styles.source}>{t('editProfile.countryHint')}</Text>
      </View>
      {Platform.OS !== 'web' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: setCountry.isPending }}
          disabled={setCountry.isPending}
          onPress={() => void useMyLocation()}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          {setCountry.isPending ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          <Text style={styles.linkText}>{t('location.useMyLocation')}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  container: { gap: 6, width: '100%' },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  // The same 54px pill as a text field, without the field: nothing here is typed.
  pill: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.md,
    height: 54,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  value: { color: colors.text, flexShrink: 1, fontSize: 16 },
  source: { color: colors.textFaint, fontSize: 13 },
  link: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    height: 40,
  },
  pressed: { opacity: 0.6 },
  linkText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))
