import type { ReactNode } from 'react'
import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useMe } from '../api/queries'
import { Screen } from './ui/Screen'
import { ScreenHeader } from './ui/ScreenHeader'
import { Skeleton } from './ui/Skeleton'

/**
 * Draws a moderator's screen only for a moderator, or an operator. Cosmetic,
 * as `AdminGate` is and for its reasons: the server's `requireModerator` is
 * the gate, and this only decides whether a screen is worth drawing.
 */
export function ModeratorGate({ children }: { children: ReactNode }) {
  const me = useMe()

  if (me.isPending) {
    return (
      <Screen fluid>
        <ScreenHeader />
        <View style={{ gap: 12, padding: 16 }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      </Screen>
    )
  }

  if (!me.data?.moderator && !me.data?.admin) return <Redirect href="/(app)/(tabs)/me" />

  return <>{children}</>
}
