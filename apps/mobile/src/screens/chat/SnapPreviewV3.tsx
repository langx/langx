import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Button } from '../../components/ui/Button'
import { PressableScale } from '../../components/ui/PressableScale'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { SNAP_MODES, type SnapMode } from '../../lib/viewOnce'

/*
 * Literal colours, as in `chat-camera.tsx`: the camera is black in both
 * schemes, so nothing here follows the app's.
 */
const ON_STAGE = '#ffffff'
const PANEL = 'rgba(12, 13, 16, 0.88)'
const OPTION_OFF = 'rgba(255, 255, 255, 0.14)'
const OPTION_OFF_SUB = 'rgba(255, 255, 255, 0.82)'
const GLYPH_OFF = 'rgba(255, 255, 255, 0.18)'
const RING_OFF = 'rgba(255, 255, 255, 0.6)'
const INK = '#14161b'
const INK_SUB = '#3d414a'

const GLYPH: Record<SnapMode, keyof typeof Feather.glyphMap> = {
  once: 'eye',
  replay: 'rotate-ccw',
  keep: 'message-circle',
}

/**
 * The step after the shutter in the redesign's look (`V-ChatCamera`), behind
 * `flags.v3Home`: what was shot, and a panel that says how it is sent.
 *
 * Only this step has a v3 drawing; the viewfinder, the permission screen and
 * the web's library-only screen stay `chat-camera.tsx`'s, as do the mode that
 * is remembered, the send and the retake — this is handed all of them. The
 * three modes are the same three, stacked so each can carry a plain line,
 * and Retake is the old corner ✕ made a button.
 */
export function SnapPreviewV3({
  picture,
  mode,
  bottomInset,
  onMode,
  onRetake,
  onSend,
}: {
  /** The photo or the looping clip, drawn by the route. */
  picture: ReactNode
  mode: SnapMode
  bottomInset: number
  onMode: (mode: SnapMode) => void
  onRetake: () => void
  onSend: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  // The heading and the options' titles are Nunito Black, which the root does not load yet.
  useFonts({ Nunito_900Black })
  const labels: Record<SnapMode, { title: string; body: string }> = {
    once: { title: t('viewOnce.modeOnce'), body: t('viewOnce.modeOnceBody') },
    replay: { title: t('viewOnce.modeReplay'), body: t('viewOnce.modeReplayBody') },
    keep: { title: t('viewOnce.modeKeep'), body: t('viewOnce.modeKeepBody') },
  }

  return (
    <>
      {picture}
      <View style={[styles.panel, { paddingBottom: v3.space[16] + bottomInset }]}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('viewOnce.modeHeading')}
        </Text>
        <View
          style={styles.options}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('viewOnce.modeHeading')}
        >
          {SNAP_MODES.map((option) => {
            const on = option === mode
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={labels[option].title}
                accessibilityHint={labels[option].body}
                onPress={() => onMode(option)}
                style={({ pressed }) => [
                  styles.option,
                  on && styles.optionOn,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.glyph, on && styles.glyphOn]}>
                  <Feather name={GLYPH[option]} size={v3.icon.md} color={ON_STAGE} />
                </View>
                <View style={styles.words}>
                  <Text style={[styles.title, on && styles.titleOn]}>{labels[option].title}</Text>
                  <Text style={[styles.body, on && styles.bodyOn]}>{labels[option].body}</Text>
                </View>
                <View style={[styles.ring, on && styles.ringOn]}>
                  {on ? <Feather name="check" size={v3.icon.xs} color={ON_STAGE} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.actions}>
          {/*
            The outline in the stage's white, by hand: the kit's outline
            takes the scheme's text colour, which is dark on a light phone
            and would vanish on the black stage.
          */}
          <PressableScale accessibilityRole="button" onPress={onRetake} style={styles.retake}>
            <Feather name="rotate-ccw" size={v3.icon.lg} color={ON_STAGE} />
            <Text style={styles.retakeLabel}>{t('viewOnce.retake')}</Text>
          </PressableScale>
          <View style={styles.grow}>
            <Button label={t('viewOnce.send')} icon="send" onPress={onSend} />
          </View>
        </View>
      </View>
    </>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  panel: {
    backgroundColor: PANEL,
    borderTopLeftRadius: v3.radius.block,
    borderTopRightRadius: v3.radius.block,
    bottom: 0,
    gap: v3.space[8],
    left: 0,
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[16],
    position: 'absolute',
    right: 0,
  },
  heading: {
    ...v3.type.headline,
    color: ON_STAGE,
    fontFamily: v3.type.title.fontFamily,
    fontSize: 20,
    lineHeight: 24,
    paddingStart: v3.space[6],
  },
  options: { gap: v3.space[8] },
  option: {
    alignItems: 'center',
    backgroundColor: OPTION_OFF,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 64,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[8],
  },
  optionOn: { backgroundColor: ON_STAGE },
  pressed: { opacity: 0.8 },
  glyph: {
    alignItems: 'center',
    backgroundColor: GLYPH_OFF,
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  glyphOn: { backgroundColor: INK },
  words: { flex: 1, gap: 1, minWidth: 0 },
  title: {
    ...v3.type.label,
    color: ON_STAGE,
    fontFamily: v3.type.title.fontFamily,
    fontSize: 17,
    lineHeight: 22,
  },
  titleOn: { color: INK },
  body: { ...v3.type.caption, color: OPTION_OFF_SUB, lineHeight: 18 },
  bodyOn: { color: INK_SUB },
  ring: {
    alignItems: 'center',
    borderColor: RING_OFF,
    borderRadius: v3.radius.pill,
    borderWidth: 2.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ringOn: { backgroundColor: v3.colors.blue, borderColor: v3.colors.blue },
  actions: { flexDirection: 'row', gap: v3.space[8], marginTop: v3.space[6] },
  retake: {
    alignItems: 'center',
    borderColor: ON_STAGE,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 56,
    justifyContent: 'center',
    marginVertical: 2,
    paddingEnd: v3.space[20],
    paddingStart: v3.space[16],
  },
  retakeLabel: { ...v3.type.button, color: ON_STAGE },
  grow: { flex: 1 },
}))
