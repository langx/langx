import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { ApiRequestError } from '../src/api/client'
import { useMe } from '../src/api/queries'
import { colors } from '../src/lib/theme'

/**
 * The gate `Stack.Protected` alone cannot express: signed out, signed in
 * *without* a profile, back from v1 and not yet told about it, and ready.
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

  /**
   * A restored v1 user skips the wizard entirely, so without this they would
   * land on a discovery feed holding a handle, a streak record and a token
   * balance nothing ever told them about. One check covers all three ways back
   * in — the password bridge, Google/Apple, and the email link — because all
   * three write the same field.
   */
  if (profile.restoredFromV1 && !profile.restoredFromV1.acknowledgedAt) {
    return <Redirect href="/(onboarding)/welcome-back" />
  }

  return <Redirect href="/(app)/discover" />
}
