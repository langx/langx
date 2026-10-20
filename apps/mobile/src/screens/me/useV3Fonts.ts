import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'

/**
 * Whether Nunito Black has arrived, for the big titles these pages draw in
 * it. Loaded by the page that wants it rather than at launch, as the wallet
 * and Me pages do; until then the title is set one weight lighter.
 */
export function useV3Fonts(): boolean {
  const [loaded] = useFonts({ Nunito_900Black })
  return loaded
}
