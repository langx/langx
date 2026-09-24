import type Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { EmptyState } from './ui/EmptyState'
import { listPaneWidth } from '../hooks/useTwoPane'
import { makeStyles } from '../lib/theme'

interface TwoPaneProps {
  /** The list, exactly as the tab draws it on a phone. */
  list: ReactNode
  /** What the list picked, or `null` when nothing is picked yet. */
  detail: ReactNode | null
  /** Drawn in place of the detail while nothing is picked. */
  empty: { icon: keyof typeof Feather.glyphMap; title: string; body: string }
}

/**
 * A list and what it opened, side by side.
 *
 * Three tabs draw this — the chat list with a thread, Discover with a profile,
 * the feed with a post — and they drew it three times before this existed.
 * The arrangement is the same every time and so are the mistakes available in
 * it, which is the argument for one copy: the width is set on the list and
 * the detail takes what is left, and the ground has to be painted here because
 * neither half paints it (`Screen` paints its own, and the panel's is the
 * detail screen's).
 *
 * It does not decide *whether* there are two panes. That is `useTwoPane`, and
 * it is asked in the tab, because the tab is also what changes when the answer
 * is no — a row pushes a route instead of filling a panel.
 */
export function TwoPane({ list, detail, empty }: TwoPaneProps) {
  const styles = useStyles()
  const { width } = useWindowDimensions()

  return (
    <View style={styles.panes}>
      <View style={{ width: listPaneWidth(width) }}>{list}</View>
      <View style={styles.detailPane}>
        {detail ?? (
          <View style={styles.pick}>
            <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
          </View>
        )}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  panes: { backgroundColor: colors.bg, flex: 1, flexDirection: 'row' },
  detailPane: { borderLeftColor: colors.border, borderLeftWidth: 1, flex: 1 },
  /** The empty card, centred in the half that is waiting. */
  pick: { alignItems: 'center', flex: 1, justifyContent: 'center' },
}))
