import type { ReactNode } from 'react'
import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useMe } from '../api/queries'
import { Screen } from './ui/Screen'
import { ScreenHeader } from './ui/ScreenHeader'
import { Skeleton } from './ui/Skeleton'

/**
 * Draws an operator screen only for an operator.
 *
 * **This is cosmetic.** The real gate is `requireAdmin` on the server, which
 * refuses every `/admin/*` route with `ADMIN_REQUIRED`; what this decides is
 * whether a screen is worth drawing, not whether the data can be had. The web
 * build exports every route as a static shell anyway (`web: { output:
 * 'static' }`), so the existence of these paths is public and nothing here
 * pretends otherwise.
 *
 * The pending branch draws a skeleton rather than redirecting. A cold deep
 * link on the web resolves `useMe` after the first render, and redirecting on
 * "not yet" would throw a real operator out of the screen they just opened.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const me = useMe()

  if (me.isPending) {
    return (
      <Screen fluid>
        <ScreenHeader />
        <View style={{ gap: 12, padding: 16 }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      </Screen>
    )
  }

  // Settled and not an operator — including a 401 or a 404, which the root
  // gate has its own answer for.
  if (!me.data?.admin) return <Redirect href="/(app)/(tabs)/me" />

  return <>{children}</>
}
