import Feather from '@expo/vector-icons/Feather'
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { ConversationDto } from '../../api/queries'
import type { RowPartner } from '../../hooks/useConversationPartners'
import { useLocale, useT } from '../../i18n'
import { callRowIcon, callRowLabel } from '../../lib/calls/callLabels'
import { acceptsSends } from '../../lib/conversationPicker'
import { relativeTimeCompact } from '../../lib/format'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { OfficialMark } from '../OfficialMark'
import { SwipeableRow, type SwipeableRowAction } from '../SwipeableRow'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Skeleton } from '../ui/Skeleton'

/*
 * The redesign's chat list, piece by piece: the colour block for somebody
 * waiting on you, the row for everyone else, the two headings and the row's
 * skeleton. Drawn from `V-Chats` on the design canvas.
 *
 * The blocks and rows are memoised, and everything they are handed is either
 * a value or a handler the screen keeps stable — so a new message re-renders
 * the one thread it changed, and opening one row's drawer re-renders the two
 * rows whose `open` flipped, not the list. Nothing here animates in or out:
 * the list recycles its cells, and Reanimated 4.5.1's layout animations crash
 * on recycled views (rule 13).
 */

/** The flags the row's drawer and menu change, one at a time. */
export type ChatFlags = { pinned: boolean } | { muted: boolean } | { archived: boolean }

/** What a block or a row can ask the screen to do. All stable across renders. */
export interface ChatHandlers {
  /** Open the thread: push it on a phone, put it in the panel on a wide window. */
  open: (conversationId: string) => void
  /** Pin, archive, mute or delete — the ⋯ and a long press. */
  menu: (thread: ConversationDto, name: string) => void
  flag: (conversationId: string, flags: ChatFlags) => void
  remove: (conversationId: string) => void
  /** Which row's drawer is open; only one is. */
  openChange: (conversationId: string, open: boolean) => void
}

/** "Waiting on you" or "Other chats", over the two halves of the list. */
export const ChatsHeading = memo(function ChatsHeading({ label }: { label: string }) {
  const styles = useStyles()
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {label}
    </Text>
  )
})

interface WaitingBlockProps {
  thread: ConversationDto
  /** Always there: `waitingThreads` keeps only threads whose partner is known. */
  partner: NonNullable<ConversationDto['partner']>
  /** The first block: bigger, with their words quoted whole and the yellow Reply. */
  lead: boolean
  /** Its thread is the one in the panel, on a wide window. */
  selected: boolean
  /** The screen's clock, in ms, that the time is read against. */
  now: number
  handlers: ChatHandlers
}

/**
 * Somebody who wrote last, as a block in their own colour — the same hue they
 * have on every screen (`partnerHueFor`). Ink on the hue in both schemes,
 * because the hues are light in both.
 *
 * The Reply button is the one way in, as on Home's next step: everything
 * above it is read rather than pressed. The ⋯ beside "Your turn" is the menu,
 * so archiving a hello you will not answer is a tap, not only a long press.
 */
export const WaitingBlock = memo(function WaitingBlock({
  thread,
  partner,
  lead,
  selected,
  now,
  handlers,
}: WaitingBlockProps) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const name = partner.displayName
  const call = thread.lastMessage.call
  // They wrote last, so a call's row is theirs: worded for its callee.
  const callLabel = call ? callRowLabel(call, false) : null
  const quote = call ? null : thread.lastMessage.body || null
  const reply = () => handlers.open(thread._id)

  return (
    <Pressable
      // Not one element to a screen reader: the name, their words and the two
      // buttons are each reachable, and the long press is the ⋯'s shortcut.
      accessible={false}
      onLongPress={() => handlers.menu(thread, name)}
      style={[
        styles.block,
        lead ? styles.blockLead : styles.blockCompact,
        { backgroundColor: v3.hues[partnerHueFor(partner._id)] },
        selected && styles.blockSelected,
      ]}
    >
      <View style={styles.blockHead}>
        <Avatar
          url={partner.avatarUrl}
          name={name}
          seed={partner._id}
          size={lead ? LEAD_AVATAR : BLOCK_AVATAR}
        />
        <View style={styles.blockNames}>
          <Text style={styles.blockName} numberOfLines={1} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.blockMeta} numberOfLines={1}>
            {relativeTimeCompact(thread.lastMessage.createdAt, { t, locale, now: new Date(now) })}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{t('home.yourTurn')}</Text>
        </View>
        <IconButton
          icon="more-horizontal"
          iconSize={v3.icon.md}
          color={v3.colors.ink}
          accessibilityLabel={t('messageMenu.more')}
          onPress={() => handlers.menu(thread, name)}
        />
      </View>

      {lead ? (
        <>
          {callLabel && call ? (
            <CallLine call={call} label={t(callLabel.title)} />
          ) : quote ? (
            <Text style={styles.quoteLead} numberOfLines={3}>
              “{quote}”
            </Text>
          ) : null}
          <Button
            label={t('home.replyTo', { name })}
            icon="corner-up-left"
            haptic="press"
            onPress={reply}
          />
        </>
      ) : (
        <View style={styles.blockFoot}>
          <View style={styles.grow}>
            {callLabel && call ? (
              <CallLine call={call} label={t(callLabel.title)} />
            ) : quote ? (
              <Text style={styles.quoteCompact} numberOfLines={2}>
                {quote}
              </Text>
            ) : null}
          </View>
          {/* Ink, not yellow: the yellow is the lead block's, once a screen. */}
          <Button
            variant="ink"
            size="small"
            label={t('messageActions.reply')}
            accessibilityLabel={t('home.replyTo', { name })}
            icon="corner-up-left"
            onPress={reply}
            style={styles.replySmall}
          />
        </View>
      )}
    </Pressable>
  )
})

/** A call in place of their words — "Missed voice call" — in ink, on the hue. */
function CallLine({
  call,
  label,
}: {
  call: NonNullable<ConversationDto['lastMessage']['call']>
  label: string
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.callLine}>
      <Feather name={callRowIcon(call, false)} size={v3.icon.sm} color={v3.colors.ink} />
      <Text style={styles.callLineText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

interface ChatRowProps {
  thread: ConversationDto
  /** Undefined while a list from an older API is still naming them. */
  partner: RowPartner | undefined
  meId: string | undefined
  /** This row's drawer is the open one. */
  open: boolean
  selected: boolean
  /** The screen's clock, in ms, that the time is read against. */
  now: number
  handlers: ChatHandlers
}

/**
 * Everyone not waiting on you: a face, a name, the last line and the time.
 *
 * Every action behind the swipe is also behind the ⋯ at the row's end, so
 * nothing is reachable by gesture alone — a screen reader cannot swipe, and
 * on a desktop browser the swipe is not offered at all. The drawer's buttons
 * are the row's `accessibilityActions` too.
 */
export const ChatRowV3 = memo(function ChatRowV3({
  thread,
  partner,
  meId,
  open,
  selected,
  now,
  handlers,
}: ChatRowProps) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const id = thread._id
  const name = partner?.displayName ?? ''
  const mine = thread.lastMessage.senderId === meId
  const call = thread.lastMessage.call
  const callLabel = call ? callRowLabel(call, mine) : null
  /*
   * "Your turn" on a row: read and not answered, on a thread past the first
   * page (the first page's are blocks) or one the server still calls theirs.
   * An unread thread's badge already says it. Not on a thread nobody can
   * write to — the arrow could never be crossed off.
   */
  const rowPartner = thread.partner ?? partner
  const awaitsReply =
    thread.unreplied && thread.unread === 0 && rowPartner !== undefined && acceptsSends(rowPartner)

  // Delete last, the furthest from a thumb that opened the drawer to archive.
  const right: SwipeableRowAction[] = [
    {
      id: 'pin',
      icon: thread.pinned ? 'chevrons-down' : 'chevrons-up',
      label: thread.pinned ? t('chats.unpin') : t('chats.pin'),
      colour: v3.colors.echoText,
      onAction: () => handlers.flag(id, { pinned: !thread.pinned }),
    },
    {
      id: 'mute',
      icon: thread.muted ? 'bell' : 'bell-off',
      label: thread.muted ? t('chats.unmute') : t('chats.mute'),
      colour: v3.colors.muted,
      onAction: () => handlers.flag(id, { muted: !thread.muted }),
    },
  ]
  const left: SwipeableRowAction[] = [
    {
      id: 'archive',
      icon: thread.archived ? 'inbox' : 'archive',
      label: thread.archived ? t('chats.unarchive') : t('chats.archive'),
      colour: v3.colors.muted,
      onAction: () => handlers.flag(id, { archived: !thread.archived }),
    },
    {
      id: 'delete',
      icon: 'trash-2',
      label: t('chats.delete'),
      colour: v3.colors.danger,
      destructive: true,
      onAction: () => handlers.remove(id),
    },
  ]

  return (
    <SwipeableRow
      right={right}
      left={left}
      open={open}
      onOpenChange={(next) => handlers.openChange(id, next)}
      ground={v3.colors.bg}
    >
      <View style={styles.rowWrap}>
        <Pressable
          accessibilityRole="button"
          // An open drawer closes rather than opening the thread: a tap on a
          // row holding its buttons out means "never mind".
          onPress={() => (open ? handlers.openChange(id, false) : handlers.open(id))}
          onLongPress={() => handlers.menu(thread, name)}
          style={({ pressed }) => [styles.row, (pressed || selected) && styles.rowFill]}
        >
          {partner ? (
            <Avatar
              url={partner.avatarUrl}
              name={partner.displayName}
              seed={partner._id}
              online={partner.isOnline}
              size={ROW_AVATAR}
            />
          ) : (
            <Skeleton width={ROW_AVATAR} height={ROW_AVATAR} radius={ROW_AVATAR / 2} />
          )}
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              {partner ? (
                <View style={styles.nameRow}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {partner.displayName}
                  </Text>
                  {partner.official ? <OfficialMark size={v3.icon.xs} /> : null}
                </View>
              ) : (
                <View style={styles.grow}>
                  <Skeleton width={132} height={17} />
                </View>
              )}
              {/*
                No pair flame: the streak two partners share is not built yet,
                and a number with nothing behind it is worse than none. It goes
                here, beside the name, when it is.
              */}
              {thread.pinned ? (
                <Feather name="bookmark" size={v3.icon.xs} color={v3.colors.muted} />
              ) : null}
              {/* The badge still counts a muted thread; this says why it never buzzed. */}
              {thread.muted ? (
                <Feather
                  name="bell-off"
                  size={v3.icon.xs}
                  color={v3.colors.muted}
                  accessibilityLabel={t('chats.muted')}
                />
              ) : null}
              <Text style={styles.time}>
                {relativeTimeCompact(thread.lastMessage.createdAt, {
                  t,
                  locale,
                  now: new Date(now),
                })}
              </Text>
            </View>
            <View style={styles.rowBottom}>
              {call && callLabel ? (
                <View style={styles.callPreview}>
                  <Feather
                    name={callRowIcon(call, mine)}
                    size={v3.icon.xs}
                    color={callLabel.missed ? v3.colors.danger : v3.colors.muted}
                  />
                  <Text
                    style={[styles.preview, callLabel.missed && styles.previewMissed]}
                    numberOfLines={1}
                  >
                    {t(callLabel.title)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.preview} numberOfLines={1}>
                  {mine ? `${t('chats.youPrefix')} ` : ''}
                  {thread.lastMessage.body}
                </Text>
              )}
              {thread.unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{thread.unread.toLocaleString(locale)}</Text>
                </View>
              ) : awaitsReply ? (
                <Feather
                  name="corner-up-left"
                  size={v3.icon.sm}
                  color={v3.colors.echoText}
                  accessibilityLabel={t('chats.awaitingReply')}
                />
              ) : null}
            </View>
          </View>
        </Pressable>
        <IconButton
          icon="more-horizontal"
          iconSize={v3.icon.md}
          color={v3.colors.muted}
          accessibilityLabel={t('messageMenu.more')}
          onPress={() => handlers.menu(thread, name)}
        />
      </View>
    </SwipeableRow>
  )
})

/** A row's shape while the first page is on its way. */
export function ChatRowSkeletonV3() {
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <Skeleton width={ROW_AVATAR} height={ROW_AVATAR} radius={ROW_AVATAR / 2} />
      <View style={styles.rowBody}>
        <Skeleton width={140} height={17} />
        <Skeleton width="80%" height={14} />
      </View>
    </View>
  )
}

/** The drawing's faces: 48 on the lead block and on a row, 44 on a smaller block. */
const LEAD_AVATAR = 48
const BLOCK_AVATAR = 44
const ROW_AVATAR = 48
/** The ink ring round the block whose thread is in the panel. */
const BLOCK_RING = 3

const useStyles = makeStyles(({ v3 }) => ({
  heading: {
    ...v3.type.headline,
    color: v3.colors.fg,
    marginBottom: v3.space[8],
    marginTop: v3.space[12],
    paddingHorizontal: v3.space[6],
  },

  /*
   * The border is always there and only coloured when the block's thread is
   * in the panel, on a wide window — an ink ring, since the block's own
   * colour is already spoken for. Always there so choosing a block does not
   * grow it by the ring's width; the hue fills under a clear border, so at
   * rest it is not seen, and the padding gives the ring's width back.
   */
  block: {
    borderColor: 'transparent',
    borderWidth: BLOCK_RING,
    gap: v3.space[10],
    marginBottom: v3.space[10],
  },
  blockLead: {
    borderRadius: v3.radius.block,
    paddingBottom: v3.space[16] - BLOCK_RING,
    paddingHorizontal: v3.space[16] - BLOCK_RING,
    paddingTop: v3.space[14] - BLOCK_RING,
  },
  blockCompact: {
    borderRadius: v3.radius.badge,
    gap: v3.space[8],
    paddingBottom: v3.space[12] - BLOCK_RING,
    paddingEnd: v3.space[12] - BLOCK_RING,
    paddingStart: v3.space[14] - BLOCK_RING,
    paddingTop: v3.space[12] - BLOCK_RING,
  },
  blockSelected: { borderColor: v3.colors.ink },
  blockHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  blockNames: { flex: 1, minWidth: 0 },
  blockName: { ...v3.type.headline, color: v3.colors.ink },
  blockMeta: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },
  // Ink on the hue in both schemes, as on Home's next step; the label is
  // `onBlue` because it is the palette's one white that stays white at night.
  chip: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexShrink: 0,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[6],
  },
  chipLabel: { ...v3.type.label, color: v3.colors.onBlue },
  quoteLead: { ...v3.type.body, color: v3.colors.ink, fontWeight: '500' },
  quoteCompact: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '500' },
  blockFoot: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  replySmall: { flexShrink: 0, width: 'auto' },
  callLine: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  callLineText: { ...v3.type.callout, color: v3.colors.ink, flexShrink: 1, fontWeight: '600' },

  rowWrap: { alignItems: 'center', flexDirection: 'row', marginBottom: v3.space[2] },
  row: {
    alignItems: 'center',
    borderRadius: v3.radius.row,
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    minWidth: 0,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[10],
  },
  // Pressed, and the thread in the panel: the grey block, which is v3's own
  // way of saying "this one".
  rowFill: { backgroundColor: v3.colors.surface },
  rowBody: { flex: 1, gap: v3.space[2], minWidth: 0 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  nameRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: v3.space[6], minWidth: 0 },
  // The button step: Nunito at 17, the drawings' row name.
  rowName: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
  time: { ...v3.type.caption, color: v3.colors.muted },
  rowBottom: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  preview: { ...v3.type.callout, color: v3.colors.muted, flex: 1 },
  previewMissed: { color: v3.colors.danger },
  callPreview: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: v3.space[6] },
  // Blue, as the tab's own count is in the redesign's bar: a count is news.
  badge: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    minWidth: 22,
    paddingHorizontal: v3.space[6],
    paddingVertical: v3.space[2],
  },
  badgeText: { ...v3.type.label, color: v3.colors.onBlue },
  grow: { flex: 1 },
}))
