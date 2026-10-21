import { Redirect, useLocalSearchParams } from 'expo-router'
import { Screen } from '../../../../src/components/ui/Screen'
import { useV3HomeDecision } from '../../../../src/hooks/useV3Home'
import { packFromParam, StickerPackScreenV3 } from '../../../../src/screens/StickerPackScreenV3'

/**
 * One sticker pack's page — `/wallet/stickers/paper` — behind `flags.v3Home`.
 *
 * Only v3 links here (the store and the sticker keyboard). With the flag off,
 * or for a pack this build does not carry, a stray link lands on today's
 * store, which lists every pack.
 */
export default function StickerPackRoute() {
  const v3Home = useV3HomeDecision()
  const { pack } = useLocalSearchParams<{ pack?: string }>()
  const found = packFromParam(pack)
  if (v3Home === undefined) return <Screen>{null}</Screen>
  if (!v3Home || !found) return <Redirect href="/(app)/wallet/store" />
  return <StickerPackScreenV3 pack={found} />
}
