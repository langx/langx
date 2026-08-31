import { Ionicons } from '@expo/vector-icons'
import { isBigEmoji } from '../lib/singleEmoji'
import { useEffect, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { paginateActions, type MessageActionPage } from '../lib/messageActions'
import {
  resolveMessageMenu,
  subscribeToMessageMenu,
  type MessageMenuRequest,
} from '../lib/messageMenu'
import { messageMenuLayout } from '../lib/messageMenuLayout'
import { makeStyles, useTheme } from '../lib/theme'
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
  const { colors, spacing } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { isRtl } = useLocale()

  const [request, setRequest] = useState<MessageMenuRequest | null>(null)
  const [page, setPage] = useState<MessageActionPage>('primary')
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()

  useEffect(
    () =>
      subscribeToMessageMenu((next) => {
        // A new menu always opens on the first page; leaving it on `more`
        // would show the second page of a message nobody asked about.
        setPage('primary')
        setRequest(next)
      }),
    [],
  )

  if (!request) return null
  const dismiss = (): void => resolveMessageMenu(request.id, null)
  const wide = Platform.OS === 'web'

  const { actions, hasMore } = paginateActions(request.actions, page)

  // The rows on *this* page, plus whichever navigation row it carries. The
  // anchored layout derives its height from this, and the hairline dividers
  // need to know which row is last — the last one goes undivided, v3's rule.
  const rowCount = actions.length + (hasMore ? 1 : 0) + (page === 'more' ? 1 : 0)
  const rowOffset = page === 'more' ? 1 : 0

  const rows = (
    <>
      {page === 'more' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('messageMenu.backToFirstPage')}
          onPress={() => setPage('primary')}
          style={({ pressed }) => [
            styles.action,
            rowCount > 1 && styles.rowDivider,
            pressed && styles.actionPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
          <Text style={[styles.label, styles.muted]}>{t('common.backPlain')}</Text>
        </Pressable>
      ) : null}

      {actions.map((action, index) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          disabled={action.disabled === true}
          onPress={() => resolveMessageMenu(request.id, { kind: 'action', id: action.id })}
          style={({ pressed }) => [
            styles.action,
            rowOffset + index < rowCount - 1 && styles.rowDivider,
            pressed && !action.disabled && styles.actionPressed,
            action.disabled === true && styles.actionDisabled,
          ]}
        >
          <Ionicons
            // The icon set types its own names; the action table is plain data
            // and does not import them.
            name={action.icon as never}
            size={20}
            color={action.destructive ? colors.danger : colors.text}
          />
          <Text style={[styles.label, action.destructive && styles.destructive]}>
            {action.label}
          </Text>
        </Pressable>
      ))}

      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPage('more')}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          <Text style={[styles.label, styles.muted]}>{t('messageMenu.more')}</Text>
        </Pressable>
      ) : null}
    </>
  )

  const strip = request.reactions ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stripInner}
      style={styles.strip}
    >
      {request.reactions.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={t('messageMenu.reactWith', { emoji })}
          onPress={() => resolveMessageMenu(request.id, { kind: 'reaction', emoji })}
          style={[styles.emoji, request.myReaction === emoji && styles.emojiChosen]}
        >
          <Text style={styles.emojiGlyph}>{emoji}</Text>
        </Pressable>
      ))}
    </ScrollView>
  ) : null

  if (request.anchor) {
    /**
     * Heights are derived, not measured. Measuring after mounting means one
     * frame drawn in the wrong place and a visible jump on exactly the gesture
     * that has to feel immediate, so the flip is decided before first paint.
     */
    const menuHeight = rowCount * ROW_HEIGHT + MENU_CHROME
    const stripWidth = Math.min(STRIP_MAX_WIDTH, screen.width - 24)
    const layout = messageMenuLayout({
      anchor: request.anchor,
      screen: { width: screen.width, height: screen.height },
      insets: { top: insets.top, bottom: insets.bottom },
      menu: { width: MENU_WIDTH, height: menuHeight },
      strip: { width: stripWidth, height: STRIP_HEIGHT },
      mine: request.mine,
      rtl: isRtl,
    })

    return (
      <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
        <Pressable style={styles.anchoredBackdrop} onPress={dismiss}>
          {strip ? (
            <View
              style={[
                styles.stripHolder,
                { top: layout.strip.top, left: layout.strip.left, width: stripWidth },
              ]}
            >
              {strip}
            </View>
          ) : null}

          {/*
            A copy of the bubble rather than the bubble itself: the real one is
            still in the list under the scrim, and lifting it out would mean
            re-mounting a row that owns a pan responder and a measurement.
          */}
          <View
            style={[
              styles.copy,
              request.mine ? styles.copyMine : styles.copyTheirs,
              {
                top: layout.bubble.top,
                left: layout.bubble.left,
                maxWidth: Math.max(120, request.anchor.width),
              },
            ]}
          >
            {/*
              The menu draws its own copy of the bubble, so a message the thread
              shows as a hero has to look like one here too — otherwise holding
              an emoji shrinks it, which reads as the menu having replaced the
              message rather than lifted it.
            */}
            <Text
              style={[
                styles.copyText,
                request.mine && styles.copyTextMine,
                isBigEmoji(request.preview) && styles.copyHero,
              ]}
              numberOfLines={6}
            >
              {request.preview}
            </Text>
          </View>

          <View
            style={[
              styles.menu,
              { top: layout.menu.top, left: layout.menu.left, width: MENU_WIDTH },
            ]}
          >
            {rows}
          </View>
        </Pressable>
      </Modal>
    )
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <Pressable
        style={[styles.backdrop, wide ? styles.backdropCentred : styles.backdropBottom]}
        onPress={dismiss}
      >
        {/* Swallows the press so tapping the sheet itself does not close it. */}
        <Pressable
          style={[
            styles.sheet,
            wide ? styles.sheetCard : { paddingBottom: insets.bottom + spacing.md },
          ]}
          onPress={() => {}}
        >
          {strip}
          <Text style={styles.preview} numberOfLines={2}>
            {request.preview}
          </Text>
          {rows}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** Matches `action`'s padding and icon size below; the layout needs it up front. */
const ROW_HEIGHT = 46
/** The menu's own padding, top and bottom. */
const MENU_CHROME = 16
const MENU_WIDTH = 232
const STRIP_HEIGHT = 54
const STRIP_MAX_WIDTH = 336

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
  actionDisabled: { opacity: 0.45 },
  /** Between rows only — the last row of a page goes undivided. */
  rowDivider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  muted: { color: colors.textMuted },
  backdrop: { backgroundColor: colors.scrim, flex: 1 },
  backdropBottom: { justifyContent: 'flex-end' },
  backdropCentred: { alignItems: 'center', justifyContent: 'center' },
  anchoredBackdrop: { backgroundColor: colors.scrim, flex: 1 },
  destructive: { color: colors.danger },
  label: { ...font.body, color: colors.text },
  copyHero: { fontSize: 48, lineHeight: 58 },
  preview: {
    ...font.caption,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sheet: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
  },
  sheetCard: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    maxWidth: 360,
    paddingBottom: spacing.md,
    width: '100%',
  },
  stripHolder: { position: 'absolute' },
  strip: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    flexGrow: 0,
  },
  stripInner: { alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 6 },
  emoji: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emojiChosen: { backgroundColor: colors.fill },
  emojiGlyph: { fontSize: 24, lineHeight: 30 },
  copy: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    position: 'absolute',
  },
  // The lifted copy matches the v3 bubbles it stands in for.
  copyMine: { backgroundColor: colors.accentBg },
  copyTheirs: { backgroundColor: colors.fill },
  copyText: { ...font.body, color: colors.text, lineHeight: 22 },
  copyTextMine: { color: colors.text },
  menu: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    position: 'absolute',
  },
}))
