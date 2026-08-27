import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { ApiRequestError } from '../src/api/client'
import { useMe } from '../src/api/queries'
import { colors } from '../src/lib/theme'

/**
 * The three-way gate the app needs and `Stack.Protected` alone cannot express:
 * signed out, signed in *without* a profile, and ready.
 *
 * The middle state is real and common — Better Auth creates the account, but
 * `profiles` is ours and onboarding writes it. Routing straight to the app
 * would land a user on a discovery feed built from a profile that does not
 * exist. A 404 from `/profiles/me` is that state, not an error.
 */
export default function Index() {
  const { data: profile, isPending, error } = useMe()

  if (isPending) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.bg,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    )
  }

  const needsOnboarding = !profile || (error instanceof ApiRequestError && error.status === 404)
  if (needsOnboarding) return <Redirect href="/(onboarding)/languages" />

  return <Redirect href="/(app)/discover" />
}
