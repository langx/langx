import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { isBigEmoji } from '../lib/singleEmoji'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useV3Home } from '../hooks/useV3Home'
import { impact, selection } from '../lib/haptics'
import { paginateActions, type MessageActionPage } from '../lib/messageActions'
import {
  MENU_MOTION,
  emojiDelay,
  menuOrigin,
  resolveMessageMenu,
  subscribeToMessageMenu,
  type MessageMenuRequest,
  type MessageMenuResult,
} from '../lib/messageMenu'
import { messageMenuLayout } from '../lib/messageMenuLayout'
import { stickerAsset } from '../lib/stickerAssets'
import { makeStyles, useTheme } from '../lib/theme'
import { EASE_OUT } from '../lib/theme/motionAnimated'
import { MediaGallery } from './MediaBubble'
import { ReactionPicker } from './ReactionPicker'
import { Button } from './ui/Button'
import { useLocale, useT } from '../i18n'

/**
 * Draws whatever `src/lib/messageMenu.ts` has open.
 *
 * Two shapes from one host. With a measured bubble it draws against it — a copy
 * of the bubble lifted out of the thread, the emoji strip over it and the
 * actions under it. Without one it falls back to the sheet, which is what a
 * caller with nothing to measure still gets, and what every caller got before.
 *
 * Still a `Modal`. The anchored layout is absolutely positioned *inside* it
 * rather than at the app root: `measureInWindow` and a full-screen Modal are
 * both in window coordinates, so they agree, and the Modal keeps two things
 * that would otherwise have to be rebuilt — it paints above the tab bar on
 * every platform without depending on mount order, and `onRequestClose` is
 * Android's back button. A root layer would need `BackHandler` for the second
 * and would sit under the tab bar if it were ever mounted before the navigator.
 */
export function MessageMenuHost() {
  const { colors, spacing, v3 } = useTheme()
  const current = useStyles()
  const redesigned = useStylesV3()
  const v3Look = useV3Home()
  const styles = v3Look ? redesigned : current
  /** The rows' glyphs: muted in both looks, from each look's own palette. */
  const glyph = v3Look ? v3.colors.muted : colors.textMuted
  const t = useT()
  const { isRtl } = useLocale()

  const [request, setRequest] = useState<MessageMenuRequest | null>(null)
  const [page, setPage] = useState<MessageActionPage>('primary')
  /** The strip's "+" swaps the menu for the full picker, in the same Modal. */
  const [picking, setPicking] = useState(false)
  const insets = useSafeAreaInsets()
  const keyboardInset = useKeyboardInset()
  const screen = useWindowDimensions()

  /*
   * The v3 anchored menu lifts out of the bubble (`MENU_MOTION`) instead of
   * the whole Modal fading in: the scrim and the copy together, then the menu
   * and the strip growing from the bubble's side, the emoji one by one. RN
   * `Animated` on the native driver, since this host is mounted at the root.
   * The sheet, the picker and the current look keep the Modal's own fade.
   */
  const reduce = useReduceMotion()
  const lifts = v3Look && request?.anchor !== undefined && !picking
  const motion = useRef({
    scrim: new Animated.Value(0),
    lift: new Animated.Value(0),
    menu: new Animated.Value(0),
    emoji: [] as Animated.Value[],
  }).current

  useEffect(
    () =>
      subscribeToMessageMenu((next) => {
        // A new menu always opens on the first page; leaving it on `more`
        // would show the second page of a message nobody asked about.
        setPage('primary')
        setPicking(false)
        // Back to the start of the lift before the next menu's first commit.
        // A close that skipped the exit — through the full picker, or with
        // reduced motion — leaves them at 1, and the menu would be drawn
        // once at full size before its entrance reset it.
        for (const value of [motion.scrim, motion.lift, motion.menu, ...motion.emoji]) {
          value.setValue(0)
        }
        setRequest(next)
      }),
    [motion],
  )
  // One value per emoji, made the first time a strip that long is drawn.
  while (motion.emoji.length < (request?.reactions?.length ?? 0)) {
    motion.emoji.push(new Animated.Value(0))
  }
  /** Set once a pick or a dismissal is on its way out, so a second tap does nothing. */
  const closing = useRef(false)

  const requestId = request?.id
  // Before the first paint, so the menu is never drawn once at full size and
  // then snapped back to the start of its entrance.
  useLayoutEffect(() => {
    if (requestId === undefined) return
    closing.current = false
    // A long-press menu opening: the haptics policy's `medium`.
    void impact('medium')
    if (!lifts) return
    const values = [motion.scrim, motion.lift, motion.menu, ...motion.emoji]
    if (reduce) {
      values.forEach((value) => value.setValue(1))
      return
    }
    values.forEach((value) => value.setValue(0))
    Animated.parallel([
      fadeTo(motion.scrim, 1, MENU_MOTION.scrim),
      fadeTo(motion.lift, 1, MENU_MOTION.lift),
      fadeTo(motion.menu, 1, MENU_MOTION.menu),
      ...motion.emoji.map((value, index) => fadeTo(value, 1, MENU_MOTION.emoji, emojiDelay(index))),
    ]).start()
    // Once per menu: `lifts` and `reduce` are read at the moment it opens.
  }, [requestId])

  if (!request) return null

  /**
   * Every way out of the menu. A lifted menu plays its short exit first and
   * answers once it has gone — answering first would start the reply or the
   * delete under a menu still on screen.
   */
  const finish = (value: MessageMenuResult | null): void => {
    if (closing.current) return
    closing.current = true
    if (value?.kind === 'reaction') void selection()
    const id = request.id
    if (!lifts || reduce) {
      resolveMessageMenu(id, value)
      return
    }
    Animated.parallel([
      fadeTo(motion.scrim, 0, MENU_MOTION.close),
      fadeTo(motion.lift, 0, MENU_MOTION.close),
      fadeTo(motion.menu, 0, MENU_MOTION.close),
    ]).start(() => resolveMessageMenu(id, value))
  }
  const dismiss = (): void => finish(null)
  const wide = Platform.OS === 'web'
  /** The Modal's own fade, where the menu does not lift; none at all for reduced motion. */
  const modalFade = reduce ? 'none' : 'fade'

  const { actions, hasMore } = paginateActions(request.actions, page)

  // The rows on *this* page, plus whichever navigation row it carries. The
  // anchored layout derives its height from this, and the dividers need to
  // know which row is last — the last one goes undivided, v3's rule.
  const rowCount = actions.length + (hasMore ? 1 : 0) + (page === 'more' ? 1 : 0)
  const rowOffset = page === 'more' ? 1 : 0

  /**
   * The rows are one v3 row at two scales: the anchored menu's compact one —
   * `ROW_HEIGHT` is derived from it — and the sheet's taller one, every row
   * under its own rule. Everything else they share, including the rule the
   * rest of the app follows: the icon is muted whatever the label says, and
   * only the label carries the danger.
   */
  const anchored = request.anchor !== undefined
  const rowStyle = anchored ? styles.action : styles.sheetRow
  const labelStyle = anchored ? styles.label : styles.sheetLabel
  // A fill under the popover's rounded row, the sheet's own fade under a row
  // that spans the sheet — the way `AlertHost` presses its rows.
  const pressedStyle = anchored ? styles.actionPressed : styles.sheetPressed

  const rows = (
    <>
      {page === 'more' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('messageMenu.backToFirstPage')}
          onPress={() => setPage('primary')}
          style={({ pressed }) => [
            rowStyle,
            anchored && rowCount > 1 && styles.rowDivider,
            pressed && pressedStyle,
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={glyph} />
          <Text style={[labelStyle, styles.muted]}>{t('common.backPlain')}</Text>
        </Pressable>
      ) : null}

      {actions.map((action, index) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          disabled={action.disabled === true}
          onPress={() => finish({ kind: 'action', id: action.id })}
          style={({ pressed }) => [
            rowStyle,
            anchored && rowOffset + index < rowCount - 1 && styles.rowDivider,
            pressed && !action.disabled && pressedStyle,
            action.disabled === true && styles.actionDisabled,
          ]}
        >
          <Ionicons
            // The icon set types its own names; the action table is plain data
            // and does not import them.
            name={action.icon as never}
            size={20}
            color={glyph}
          />
          {/*
            One line in the popover: `ROW_HEIGHT` is derived rather than
            measured, so a label that wrapped — "Corrected — can't be edited",
            and its longer translations — would put every row below it in the
            wrong place. The sheet has the width to let it wrap.
          */}
          <Text
            numberOfLines={anchored ? 1 : undefined}
            style={[labelStyle, action.destructive && styles.destructive]}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}

      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPage('more')}
          style={({ pressed }) => [rowStyle, pressed && pressedStyle]}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={glyph} />
          <Text style={[labelStyle, styles.muted]}>{t('messageMenu.more')}</Text>
        </Pressable>
      ) : null}
    </>
  )

  /*
    The "+" sits outside the scroll: on a phone too narrow for the whole strip
    the emoji scroll under it, and the way to every other emoji stays in view.
  */
  const strip = request.reactions ? (
    <View style={styles.strip}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripInner}
        style={styles.stripScroll}
      >
        {request.reactions.map((emoji, index) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={t('messageMenu.reactWith', { emoji })}
            hitSlop={v3Look ? EMOJI_SLOP : undefined}
            onPress={() => finish({ kind: 'reaction', emoji })}
            style={[styles.emoji, request.myReaction === emoji && styles.emojiChosen]}
          >
            {/* The glyph arrives, not its cell: the strip's width never moves. */}
            <Animated.View style={lifts ? grow(motion.emoji[index], MENU_MOTION.emojiFrom) : null}>
              <Text style={styles.emojiGlyph}>{emoji}</Text>
            </Animated.View>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('messageMenu.moreReactions')}
        hitSlop={v3Look ? EMOJI_SLOP : undefined}
        onPress={() => setPicking(true)}
        style={[styles.emoji, styles.stripPlus]}
      >
        <Ionicons name="add" size={24} color={glyph} />
      </Pressable>
    </View>
  ) : null

  if (picking) {
    // A sheet whatever the menu was: the grid needs the width an anchored
    // popover does not have. Android's back button returns to the menu; the
    // scrim closes everything, as it does for the menu itself.
    return (
      <Modal transparent animationType={modalFade} visible onRequestClose={() => setPicking(false)}>
        <Pressable
          style={[styles.backdrop, wide ? styles.backdropCentred : styles.backdropBottom]}
          onPress={dismiss}
        >
          <Animated.View
            style={[
              styles.pickerHolder,
              wide && styles.pickerHolderWide,
              { paddingBottom: keyboardInset },
            ]}
          >
            <Pressable
              style={[
                styles.sheet,
                wide
                  ? styles.sheetCard
                  : { paddingBottom: insets.bottom + (v3Look ? v3.space[16] : spacing.lg) },
              ]}
              onPress={() => {}}
            >
              {wide ? null : <View style={styles.handle} />}
              <ReactionPicker onPick={(emoji) => finish({ kind: 'reaction', emoji })} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    )
  }

  /**
   * What the lifted copy draws.
   *
   * A picture when the bubble drew one, and the same components the thread
   * drew it with — a photo copied as a grey box with the word "Photo" in it is
   * a caption standing where the message was. `videoMode="preview"` is the
   * feed's still, muted frame: a copy is something to look at, not a second
   * set of transport controls under the first.
   */
  const bare = request.picture?.kind === 'sticker'
  const sticker =
    request.picture?.kind === 'sticker'
      ? stickerAsset(request.picture.packId, request.picture.stickerId)
      : undefined

  /** Their hue under v3, with the ink `MessageBubble` writes on it. */
  const tint = v3Look ? request.tint : undefined
  const tinted = tint ? { color: v3.colors.ink } : null

  const copyText = (
    /*
      A message the thread shows as a hero has to look like one here too —
      otherwise holding an emoji shrinks it, which reads as the menu having
      replaced the message rather than lifted it.
    */
    <Text
      style={[
        styles.copyText,
        request.mine && styles.copyTextMine,
        tinted,
        isBigEmoji(request.preview) && styles.copyHero,
      ]}
      numberOfLines={6}
    >
      {request.preview}
    </Text>
  )

  const copy =
    request.picture?.kind === 'media' ? (
      <>
        <MediaGallery items={request.picture.items} mine={request.mine} videoMode="preview" />
        {request.caption ? (
          <Text
            style={[
              styles.copyText,
              request.mine && styles.copyTextMine,
              tinted,
              styles.copyCaption,
            ]}
            numberOfLines={4}
          >
            {request.caption}
          </Text>
        ) : null}
      </>
    ) : sticker ? (
      <Image source={sticker} style={styles.copySticker} contentFit="contain" />
    ) : (
      // A pack this build does not carry falls back to the label, which is the
      // same answer `MessageBubble` gives it.
      copyText
    )

  if (request.anchor) {
    /**
     * Heights are derived, not measured. Measuring after mounting means one
     * frame drawn in the wrong place and a visible jump on exactly the gesture
     * that has to feel immediate, so the flip is decided before first paint.
     */
    const menuHeight = rowCount * ROW_HEIGHT + MENU_CHROME
    const menuWidth = v3Look ? MENU_WIDTH_V3 : MENU_WIDTH
    /**
     * The strip is as wide as the emoji it holds and no wider — a fixed width
     * left a tail of empty pill after the last one. The screen still caps it,
     * and past that the strip scrolls. A message that carries no strip — a
     * withdrawn one — reserves nothing, rather than a band of empty air.
     */
    const stripWidth = request.reactions
      ? Math.min(stripWidthFor(request.reactions.length + 1), screen.width - 24)
      : 0
    const layout = messageMenuLayout({
      anchor: request.anchor,
      screen: { width: screen.width, height: screen.height },
      insets: { top: insets.top, bottom: insets.bottom },
      menu: { width: menuWidth, height: menuHeight },
      strip: { width: stripWidth, height: request.reactions ? STRIP_HEIGHT : 0 },
      mine: request.mine,
      rtl: isRtl,
    })
    /** `messageMenuLayout`'s own rule for which edge of the bubble the menu hangs from. */
    const trailing = request.mine !== isRtl

    return (
      <Modal
        transparent
        animationType={lifts ? 'none' : modalFade}
        visible
        onRequestClose={dismiss}
      >
        <Pressable style={styles.anchoredBackdrop} onPress={dismiss}>
          {lifts ? (
            <Animated.View pointerEvents="none" style={[styles.scrim, { opacity: motion.scrim }]} />
          ) : null}
          {strip ? (
            <Animated.View
              style={[
                styles.stripHolder,
                { top: layout.strip.top, left: layout.strip.left, width: stripWidth },
                lifts
                  ? [
                      grow(motion.menu, MENU_MOTION.menuFrom),
                      { transformOrigin: menuOrigin(layout.placement, 'strip', trailing) },
                    ]
                  : null,
              ]}
            >
              {strip}
            </Animated.View>
          ) : null}

          {/*
            A copy of the bubble rather than the bubble itself: the real one is
            still in the list under the scrim, and lifting it out would mean
            re-mounting a row that owns a pan responder and a measurement.

            A sticker takes no bubble around it, exactly as the thread draws
            one: chrome around a sticker is what makes it look like a picture
            somebody attached rather than a thing they said.
          */}
          {/*
            Under v3 the copy fades with the scrim: it lands exactly over the
            real bubble, so as the thread dims the bubble seems to stay lit
            rather than a second one appearing. Then it lifts by 3%.
          */}
          <Animated.View
            style={[
              bare ? styles.copyBare : styles.copy,
              bare ? null : request.mine ? styles.copyMine : styles.copyTheirs,
              !bare && tint ? { backgroundColor: tint } : null,
              !bare &&
                request.tail === true &&
                (request.mine ? styles.copyTailMine : styles.copyTailTheirs),
              {
                top: layout.bubble.top,
                left: layout.bubble.left,
                maxWidth: Math.max(120, request.anchor.width),
              },
              lifts
                ? {
                    opacity: motion.scrim,
                    transform: [
                      {
                        scale: motion.lift.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, MENU_MOTION.liftScale],
                        }),
                      },
                    ],
                  }
                : null,
            ]}
          >
            {copy}
          </Animated.View>

          <Animated.View
            style={[
              styles.menu,
              { top: layout.menu.top, left: layout.menu.left, width: menuWidth },
              lifts
                ? [
                    grow(motion.menu, MENU_MOTION.menuFrom),
                    { transformOrigin: menuOrigin(layout.placement, 'menu', trailing) },
                  ]
                : null,
            ]}
          >
            {rows}
          </Animated.View>
        </Pressable>
      </Modal>
    )
  }

  return (
    <Modal transparent animationType={modalFade} visible onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, wide ? styles.backdropCentred : styles.backdropBottom]}
        onPress={dismiss}
      >
        {/* Swallows the press so tapping the sheet itself does not close it. */}
        <Pressable
          style={[
            styles.sheet,
            wide
              ? styles.sheetCard
              : { paddingBottom: insets.bottom + (v3Look ? v3.space[20] : spacing.xl) },
          ]}
          onPress={() => {}}
        >
          {/* The handle says "drag me"; on a centred card there is nothing to drag. */}
          {wide ? null : <View style={styles.handle} />}
          {strip}
          {/* The message stands where the prototype's sheet puts its title. */}
          <Text style={styles.title} numberOfLines={2}>
            {request.preview}
          </Text>
          {rows}
          <Button
            label={t('common.cancel')}
            variant="neutral"
            onPress={dismiss}
            style={styles.foot}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** One leg of the lift, on the native driver: `CURVE.out`, as everything else here. */
function fadeTo(
  value: Animated.Value,
  toValue: number,
  duration: number,
  delay = 0,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration,
    delay,
    easing: EASE_OUT,
    useNativeDriver: true,
  })
}

/** Fades in while growing from `from` to full size, as `value` runs 0 → 1. */
function grow(value: Animated.Value | undefined, from: number) {
  if (!value) return null
  return {
    opacity: value,
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }],
  }
}

/** `action`'s padding plus its tallest content — the label's pinned 22. The layout needs it up front. */
const ROW_HEIGHT = 46
/** The menu's own padding, top and bottom, plus the outline on each. */
const MENU_CHROME = 18
/** Fits the longest label at 15 — Russian's "remove from starred", German's. */
const MENU_WIDTH = 264
/** The same labels a point larger, at v3's callout: 264 × 16 / 15, rounded up. */
const MENU_WIDTH_V3 = 282
/**
 * `emoji` and `stripInner`'s own numbers: a 38 cell, 1 between, 6 of padding
 * and an outline each side. The "+" is one more cell, counted in — and the
 * reason the cell is 38 rather than 42: at 42 the strip and its "+" no longer
 * fit a 390pt screen, and the strip that used to fill the pill would scroll.
 */
const EMOJI_CELL = 38
const EMOJI_GAP = 1
const STRIP_CHROME = 14
const STRIP_HEIGHT = EMOJI_CELL + STRIP_CHROME

const stripWidthFor = (count: number): number =>
  count * EMOJI_CELL + (count - 1) * EMOJI_GAP + STRIP_CHROME

/**
 * `MessageBubble`'s hero glyph, in both looks: v3 does not restyle the thread's
 * hero (`bubbleLookV3`), and the lifted copy has to be the size of the one
 * under the finger.
 */
const HERO_TEXT = { fontSize: 48, lineHeight: 58 } as const

/**
 * The strip's emoji, in both looks. An emoji is a picture set in a 38 cell
 * the two looks share, not a line of type: v3's nearest step (headline, 22)
 * shrank it inside an unchanged cell.
 */
const EMOJI_TEXT = { fontSize: 24, lineHeight: 30 } as const

/**
 * Lifts a 38 cell to v3's 44pt target without moving it: 3 above and below
 * stays inside the strip's 6 of padding, so a press never lands outside the
 * scroll that holds the cell (Android drops those).
 */
const EMOJI_SLOP = { top: 3, bottom: 3 } as const

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  action: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionPressed: { backgroundColor: colors.fill },
  sheetPressed: { opacity: 0.6 },
  actionDisabled: { opacity: 0.45 },
  /** Between rows only — the last row of a page goes undivided. */
  rowDivider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  muted: { color: colors.textMuted },
  backdrop: { backgroundColor: colors.scrim, flex: 1 },
  backdropBottom: { justifyContent: 'flex-end' },
  backdropCentred: { alignItems: 'center', justifyContent: 'center' },
  anchoredBackdrop: { backgroundColor: colors.scrim, flex: 1 },
  /** v3's faded scrim; the current look's is the backdrop above, under the Modal's fade. */
  scrim: {
    backgroundColor: colors.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  destructive: { color: colors.danger },
  /**
   * v3's row type at the popover's scale: the sheet's 17 leaves no air in a
   * 46px row. `lineHeight` is pinned because `ROW_HEIGHT` is derived from it.
   */
  label: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  copyHero: HERO_TEXT,
  title: { ...font.heading, color: colors.text, marginBottom: 6 },
  // v3's sheet, as `AlertHost` draws it: the roundest corners in the app,
  // 24 at the sides, 10 above the handle.
  sheet: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
  },
  sheetCard: {
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    maxWidth: 360,
    paddingBottom: spacing.xl,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 4,
    marginBottom: 18,
    width: 38,
  },
  /** v3's sheet row: 17 above and below, a rule under every one. */
  sheetRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 17,
  },
  sheetLabel: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '600' },
  foot: { marginTop: 18 },
  stripHolder: { position: 'absolute' },
  // The pill the thread already draws reactions in: hairline outline over the
  // quiet shadow, because in v3 a floating surface is bounded rather than lifted.
  strip: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stripScroll: { flexGrow: 0, flexShrink: 1 },
  // The three numbers `stripWidthFor` counts with, so the pill it sizes and the
  // cells it holds cannot drift apart. The trailing gap is the one before "+".
  stripInner: {
    alignItems: 'center',
    gap: EMOJI_GAP,
    paddingStart: 6,
    paddingEnd: EMOJI_GAP,
    paddingVertical: 6,
  },
  stripPlus: { marginEnd: 6 },
  // Full width, so the sheet inside keeps the width it has without a holder;
  // centred on web, where the sheet is a card of its own width.
  pickerHolder: { width: '100%' },
  pickerHolderWide: { alignItems: 'center' },
  emoji: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: EMOJI_CELL,
    justifyContent: 'center',
    width: EMOJI_CELL,
  },
  // Blue carries everything chosen in v3; a grey fill would read as disabled.
  emojiChosen: { backgroundColor: colors.accentBg },
  emojiGlyph: EMOJI_TEXT,
  copy: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    position: 'absolute',
  },
  // The lifted copy matches the v3 bubbles it stands in for.
  copyMine: { backgroundColor: colors.accentBg },
  copyTheirs: { backgroundColor: colors.fill },
  // And its squared corner, when the bubble that was pressed had one.
  copyTailMine: { borderBottomEndRadius: 6 },
  copyTailTheirs: { borderBottomStartRadius: 6 },
  // 16 on 23, exactly `MessageBubble`'s: a copy that shrinks the text is a
  // second bubble, not the one that was pressed.
  copyText: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 23 },
  copyTextMine: { color: colors.text },
  /** Under the picture, at the thread's own distance from it. */
  copyCaption: { marginTop: spacing.xs },
  /** `MessageBubble`'s sticker, and its lack of a bubble. */
  copyBare: { position: 'absolute' },
  copySticker: { height: 112, width: 112 },
  // Outlined at the app's card radius, the way `AlertHost`'s card is drawn.
  menu: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    position: 'absolute',
  },
}))

/**
 * v3's look for the same menu, behind `flags.v3Home` with the rest of the
 * thread (no board draws it, so it follows `CallMenu` and `WhatsProSheet`):
 * flat — an outline in the line colour where the current look lifts with a
 * shadow — the lifted copy in v3's bubble colours (`bubbleLookV3`), and the
 * chosen emoji on the selected-tab pill. Every number `ROW_HEIGHT`,
 * `MENU_CHROME` and `stripWidthFor` count with is the current look's, so the
 * derived layout holds in both looks. What opens, what it offers and what a
 * press does are the host's own.
 */
const useStylesV3 = makeStyles(({ v3 }) => ({
  // Square: a row runs edge to edge under its rule, and a rounded row bends
  // the rule up at both ends.
  action: {
    alignItems: 'center',
    borderRadius: 0,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[12],
  },
  actionPressed: { backgroundColor: v3.colors.surface },
  sheetPressed: { opacity: 0.6 },
  actionDisabled: { opacity: 0.45 },
  rowDivider: { borderBottomColor: v3.colors.line, borderBottomWidth: 1 },
  muted: { color: v3.colors.muted },
  backdrop: { backgroundColor: v3.colors.scrim, flex: 1 },
  backdropBottom: { justifyContent: 'flex-end' },
  backdropCentred: { alignItems: 'center', justifyContent: 'center' },
  // Clear: the anchored menu lifts, and its scrim fades in on its own (`scrim`).
  anchoredBackdrop: { flex: 1 },
  scrim: {
    backgroundColor: v3.colors.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  destructive: { color: v3.colors.danger },
  // Callout on the current look's pinned 22, which `ROW_HEIGHT` is derived from.
  label: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600', lineHeight: 22 },
  copyHero: HERO_TEXT,
  title: { ...v3.type.headline, color: v3.colors.fg, marginBottom: v3.space[6] },
  sheet: {
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.block,
    borderTopRightRadius: v3.radius.block,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[10],
  },
  sheetCard: {
    borderBottomLeftRadius: v3.radius.block,
    borderBottomRightRadius: v3.radius.block,
    maxWidth: 360,
    paddingBottom: v3.space[20],
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 4,
    marginBottom: v3.space[16],
    width: 38,
  },
  // A 56pt row: 16 above and below a 24 line.
  sheetRow: {
    alignItems: 'center',
    borderBottomColor: v3.colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: v3.space[14],
    paddingVertical: v3.space[16],
  },
  sheetLabel: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  foot: { marginTop: v3.space[16] },
  stripHolder: { position: 'absolute' },
  strip: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
  },
  stripScroll: { flexGrow: 0, flexShrink: 1 },
  stripInner: {
    alignItems: 'center',
    gap: EMOJI_GAP,
    paddingStart: 6,
    paddingEnd: EMOJI_GAP,
    paddingVertical: 6,
  },
  stripPlus: { marginEnd: 6 },
  pickerHolder: { width: '100%' },
  pickerHolderWide: { alignItems: 'center' },
  emoji: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: EMOJI_CELL,
    justifyContent: 'center',
    width: EMOJI_CELL,
  },
  // A pill behind a glyph rather than the ink one: an emoji on ink is a hole.
  emojiChosen: { backgroundColor: v3.colors.tabOn },
  emojiGlyph: EMOJI_TEXT,
  copy: {
    borderRadius: v3.radius.tile,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
    position: 'absolute',
  },
  copyMine: { backgroundColor: v3.colors.blue },
  // The grey the thread itself draws until the partner is known; once it is,
  // the request's `tint` paints their hue over it.
  copyTheirs: { backgroundColor: v3.colors.surface },
  copyTailMine: { borderBottomEndRadius: v3.space[8] },
  copyTailTheirs: { borderBottomStartRadius: v3.space[8] },
  copyText: { ...v3.type.body, color: v3.colors.fg, lineHeight: 23 },
  copyTextMine: { color: v3.colors.onBlue },
  copyCaption: { marginTop: v3.space[4] },
  copyBare: { position: 'absolute' },
  copySticker: { height: 112, width: 112 },
  menu: {
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.row,
    borderWidth: 1,
    paddingVertical: v3.space[8],
    position: 'absolute',
  },
}))
