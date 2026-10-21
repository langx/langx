import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'

/* Literal colours, as in `view-once.tsx`: the stage is black in both schemes. */
const ON_STAGE = '#ffffff'
const ON_STAGE_MUTED = 'rgba(255, 255, 255, 0.72)'
const STAGE = '#000000'
const SCRIM = 'rgba(12, 13, 16, 0.62)'

/**
 * The pill at the foot of an open view-once photo (`V-ViewOnce`), behind
 * `flags.v3Home`: what this is, and how to leave it.
 *
 * Only a drawing. It is not a screen of its own because everything the
 * view-once screen does — spending the open once, blocking a screenshot,
 * telling the sender about one, the uncached image — is privacy behaviour,
 * and a second copy of it to keep in step would be the riskiest kind of
 * twin. So the v3 look is the corner buttons `view-once.tsx` already draws
 * in the kit's discs, plus this, laid over the photo. It takes no touches:
 * a tap on it is a tap on the photo, which closes it.
 */
export function ViewOnceHintV3({
  bottomInset,
  replay,
}: {
  bottomInset: number
  /** Sent as "allow replay" rather than "view once" — the message's own `viewOnce.replay`. */
  replay: boolean
}) {
  const styles = useStyles()
  const t = useT()
  // The sender's choice, in the words the bubble uses for it.
  const title = t(replay ? 'viewOnce.sentReplay' : 'viewOnce.modeOnce')
  return (
    <View style={[styles.foot, { bottom: bottomInset + 36 }]} pointerEvents="none">
      {/*
        One stop for a screen reader, so the mode is heard as well as seen;
        the lines inside it are not read again on their own.
      */}
      <View
        style={styles.pill}
        accessible
        accessibilityRole="text"
        accessibilityLabel={title}
        accessibilityHint={t('viewOnce.tapToClose')}
      >
        <View style={styles.mark}>
          <Feather name={replay ? 'rotate-ccw' : 'eye'} size={16} color={STAGE} />
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.line}>{t('viewOnce.tapToClose')}</Text>
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  foot: { alignItems: 'center', end: 0, position: 'absolute', start: 0 },
  pill: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingEnd: v3.space[20],
    paddingStart: v3.space[14],
    paddingVertical: v3.space[10],
  },
  mark: {
    alignItems: 'center',
    backgroundColor: ON_STAGE,
    borderRadius: v3.radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  title: { ...v3.type.label, color: ON_STAGE, fontSize: 16, lineHeight: 20 },
  line: { ...v3.type.caption, color: ON_STAGE_MUTED, lineHeight: 18 },
}))
