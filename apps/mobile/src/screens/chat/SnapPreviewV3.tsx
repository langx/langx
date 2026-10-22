import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import Feather from '@expo/vector-icons/Feather'
import { useFonts } from 'expo-font'
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Button } from '../../components/ui/Button'
import { ICON_BUTTON_TARGET, IconButton } from '../../components/ui/IconButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, TIMING, unlessReduced } from '../../lib/theme/motion'
import { SNAP_MODES, type SnapMode } from '../../lib/viewOnce'
import { StageTopBar } from './SnapCameraV3'

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

/** A spring's settle can overshoot for a frame; opacity and height must not. */
function clamp01(value: number): number {
  'worklet'
  return Math.min(1, Math.max(0, value))
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
 *
 * The panel folds down to a chip naming the chosen mode, because the three
 * stacked options cover most of a portrait photo and the person wants to see
 * what they shot before sending it. Retake and Send stay out either way: the
 * fold hides a choice already made, never the way forward. Folded or not is
 * this screen's alone and is not remembered, so the next shot opens with the
 * options showing.
 *
 * Save, at the top end, is the story camera's download: the shot into the
 * phone's own photos (or the browser's downloads) before it goes, which a
 * view-once photo otherwise never is. The route does the saving, and leaves
 * it out for a pick from the library, which would only be a second copy.
 */
export function SnapPreviewV3({
  picture,
  mode,
  bottomInset,
  saving,
  onMode,
  onRetake,
  onSend,
  onSave,
}: {
  /** The photo or the looping clip, drawn by the route. */
  picture: ReactNode
  mode: SnapMode
  bottomInset: number
  /** A save is under way; the button waits for it rather than saving twice. */
  saving: boolean
  onMode: (mode: SnapMode) => void
  onRetake: () => void
  onSend: () => void
  /** Absent when the shot came from the library: there is nothing to save. */
  onSave?: (() => void) | undefined
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  // The heading and the options' titles are Nunito Black, which the root does not load yet.
  useFonts({ Nunito_900Black })
  const labels: Record<SnapMode, { title: string; body: string }> = {
    once: { title: t('viewOnce.modeOnce'), body: t('viewOnce.modeOnceBody') },
    replay: { title: t('viewOnce.modeReplay'), body: t('viewOnce.modeReplayBody') },
    keep: { title: t('viewOnce.modeKeep'), body: t('viewOnce.modeKeepBody') },
  }

  const [open, setOpen] = useState(true)
  // 1 open, 0 folded; the options' height and both header layers follow it.
  const shown = useSharedValue(1)
  // The options' own height once laid out. 0 until then, when the block is
  // left to size itself rather than being clamped to nothing.
  const fullHeight = useSharedValue(0)

  // Started from an effect, never during render (see `motion.ts`).
  useEffect(() => {
    shown.set(unlessReduced(reduce, open ? 1 : 0, (to) => withSpring(to, SPRING.sheet)))
  }, [open, reduce, shown])

  const optionsMotion = useAnimatedStyle(() => {
    const full = fullHeight.get()
    const progress = clamp01(shown.get())
    return full === 0 ? { opacity: progress } : { height: full * progress, opacity: progress }
  })
  // The step fades in over the viewfinder it replaces rather than cutting to it.
  const entered = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    entered.set(unlessReduced(reduce, 1, (to) => withTiming(to, TIMING.crossfade)))
  }, [reduce, entered])
  const enterMotion = useAnimatedStyle(() => ({ opacity: entered.get() }))

  const headingMotion = useAnimatedStyle(() => ({ opacity: clamp01(shown.get()) }))
  const chipMotion = useAnimatedStyle(() => ({ opacity: clamp01(1 - shown.get()) }))

  return (
    <Animated.View style={[styles.fill, enterMotion]}>
      {picture}
      {/*
        Discard at the top start, where a story camera keeps it, as well as
        Retake at the foot, where a one-handed thumb already is. Both go
        back to the viewfinder.
      */}
      <StageTopBar onClose={onRetake} closeLabel={t('viewOnce.retake')}>
        {onSave ? (
          <IconButton
            icon="download"
            iconSize={22}
            look="hue"
            accessibilityLabel={t('photo.save')}
            onPress={onSave}
            disabled={saving}
            hitSlop={10}
          />
        ) : null}
      </StageTopBar>
      <View style={[styles.panel, { paddingBottom: v3.space[16] + bottomInset }]}>
        <View style={styles.head}>
          <Animated.View
            style={[styles.headLayer, headingMotion]}
            pointerEvents={open ? 'box-none' : 'none'}
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              {t('viewOnce.modeHeading')}
            </Text>
            <IconButton
              icon="chevron-down"
              iconSize={22}
              look="hue"
              accessibilityLabel={t('viewOnce.hideOptions')}
              onPress={() => setOpen(false)}
              hitSlop={10}
            />
          </Animated.View>
          <Animated.View
            style={[styles.headLayer, chipMotion]}
            pointerEvents={open ? 'none' : 'box-none'}
            accessibilityElementsHidden={open}
            importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
          >
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={labels[mode].title}
              accessibilityHint={t('viewOnce.showOptions')}
              accessibilityState={{ expanded: false }}
              onPress={() => setOpen(true)}
              hitSlop={6}
              style={styles.chip}
            >
              <Feather name={GLYPH[mode]} size={v3.icon.sm} color={INK} />
              <Text style={styles.chipLabel} numberOfLines={1}>
                {labels[mode].title}
              </Text>
              <Feather name="chevron-up" size={v3.icon.sm} color={INK} />
            </PressableScale>
          </Animated.View>
        </View>
        <Animated.View
          style={[styles.clip, optionsMotion]}
          pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          <View
            style={styles.options}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('viewOnce.modeHeading')}
            onLayout={(event) => fullHeight.set(event.nativeEvent.layout.height)}
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
        </Animated.View>
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
    </Animated.View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  fill: { bottom: 0, end: 0, position: 'absolute', start: 0, top: 0 },
  panel: {
    backgroundColor: PANEL,
    borderTopLeftRadius: v3.radius.block,
    borderTopRightRadius: v3.radius.block,
    bottom: 0,
    left: 0,
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[12],
    position: 'absolute',
    right: 0,
  },
  /*
   * One row holding two layers that crossfade: the heading with its fold
   * button, and the folded chip. Both stay laid out, so neither moves the
   * panel's top edge when the other takes over.
   */
  head: { height: ICON_BUTTON_TARGET },
  headLayer: {
    alignItems: 'center',
    bottom: 0,
    end: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: ON_STAGE,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 36,
    paddingHorizontal: v3.space[14],
  },
  chipLabel: { ...v3.type.buttonSmall, color: INK },
  // Clips the options as they fold. The gap above them is inside it, so the gap folds too.
  clip: { overflow: 'hidden' },
  heading: {
    ...v3.type.headline,
    color: ON_STAGE,
    fontFamily: v3.type.title.fontFamily,
    fontSize: 20,
    lineHeight: 24,
    paddingStart: v3.space[6],
  },
  options: { gap: v3.space[8], paddingTop: v3.space[8] },
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
  actions: { flexDirection: 'row', gap: v3.space[8], marginTop: v3.space[14] },
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
