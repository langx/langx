import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { authLandingHref } from '../../src/lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { useTheme } from '../../src/lib/theme'

/**
 * The signed-out entry point, and an exact sibling of `app/index.tsx`: read one
 * thing, then redirect. Expo Router treats `index` as a group's default route,
 * so adding this file is enough to put the intro in front of sign-in without
 * touching `unstable_settings`.
 *
 * Held on a spinner until the flag resolves rather than defaulting to one
 * branch: guessing "not seen" would replay the intro on every cold start for
 * everyone, and guessing "seen" would mean nobody ever sees it.
 */
export default function AuthIndex() {
  const { colors } = useTheme()
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void readBoolFlag(FLAG_KEYS.introSeen).then((value) => {
      if (!cancelled) setSeen(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (seen === null) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.bg,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return <Redirect href={authLandingHref(seen)} />
}
