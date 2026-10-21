import { View } from 'react-native'
import { makeStyles } from '../lib/theme'
import { CoachCard } from './ui/CoachCard'

interface TipV3Props {
  body: string
  spaced: boolean
  onDismiss: () => void
}

/**
 * `Tip`'s look under `flags.v3Home`: the Chats coach card's block — grey
 * surface, the mint disc, the sentence in callout, a 44/48 ✕ — without its
 * action pill, because a tip has nothing to open. One look for every hint on
 * every v3 screen, rather than the accent wash of today's tabs sitting next
 * to the coach card on Chats.
 *
 * Only the drawing. Which tip, the cursor, dismissal and analytics stay in
 * `Tip`, so both looks share them.
 */
export function TipV3({ body, spaced, onDismiss }: TipV3Props) {
  const styles = useStyles()
  return (
    <View style={spaced ? styles.spaced : undefined}>
      <CoachCard icon="zap" body={body} onDismiss={onDismiss} />
    </View>
  )
}

// The same gaps as today's tip, for the reason `Tip`'s `spaced` gives.
const useStyles = makeStyles(({ v3 }) => ({
  spaced: { marginBottom: v3.space[8], marginTop: v3.space[8] },
}))
