import { Redirect, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../../src/components/ui/Screen'
import { useV3HomeDecision } from '../../../src/hooks/useV3Home'
import {
  collectionKind,
  StoreCollectionScreenV3,
} from '../../../src/screens/StoreCollectionScreenV3'

/**
 * One of the redesign's store collections — `?kind=frame`, `title` or
 * `stickers`. Only the v3 store links here; with `flags.v3Home` off, today's
 * store already lists all three, so a stray link lands there instead.
 */
export default function StoreCollectionRoute() {
  const v3Home = useV3HomeDecision()
  const { kind } = useLocalSearchParams<{ kind?: string }>()
  if (v3Home === undefined) return <Screen>{null}</Screen>
  if (!v3Home) return <Redirect href="/(app)/wallet/store" />
  return <StoreCollectionScreenV3 kind={collectionKind(kind)} />
}
