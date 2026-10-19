import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { isInFirstWeek } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import {
  useConversationFlags,
  useConversations,
  useDeleteConversation,
  useMe,
  type ConversationDto,
} from '../api/queries'
import {
  ChatRowSkeletonV3,
  ChatRowV3,
  ChatsHeading,
  WaitingBlock,
  type ChatFlags,
  type ChatHandlers,
} from '../components/chats/ChatsV3Parts'
import { LoadFailed } from '../components/LoadFailed'
import { TwoPane } from '../components/TwoPane'
import { CoachCard } from '../components/ui/CoachCard'
import { EmptyStateV3 } from '../components/ui/EmptyStateV3'
import { IconButton } from '../components/ui/IconButton'
import { Screen } from '../components/ui/Screen'
import { useConversationPartners } from '../hooks/useConversationPartners'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { usePushPermissionPrompt } from '../hooks/usePushRegistration'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useTips } from '../hooks/useTips'
import { useTwoPane } from '../hooks/useTwoPane'
import { useLocale, useT } from '../i18n'
import { chooseAlert, confirmAlert, showAlert } from '../lib/alert'
import { track } from '../lib/analytics'
import { authClient } from '../lib/auth-client'
import { chatsListItems, chatsListKey, coachThread, type ChatsListItem } from '../lib/chatsList'
import { shouldGateGuest } from '../lib/guestGate'
import { listState } from '../lib/listState'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'
import { showToast } from '../lib/toast'
import { ChatScreen } from './ChatScreen'

type Item = ChatsListItem<ConversationDto>

/** Which list the screen is showing: everything live, or the archive. */
type Shelf = 'all' | 'archived'

/** Enough to fill a phone; the list scrolls before it needs more. */
const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const COACH = 'chatsCoachCorrect' as const

/** The finest step a row's time moves in: "now", then minutes. */
const CLOCK_STEP_MS = 60_000

/**
 * The redesign's Chats tab, behind `flags.v3Home`: the people waiting on you
 * first, as blocks in their own colours, then everyone else as rows. Drawn
 * from `V-Chats`; `app/(app)/(tabs)/chats.tsx` chooses between this and
 * today's list once per launch, so with the flag off nothing here runs.
 *
 * Today's three tabs are two places here. "Unreplied" is the blocks at the
 * top, which is the point of the drawing; the archive is a button in the
 * header beside the starred messages, and opens in place of the list.
 */
export function ChatsV3Screen() {
  const { data: session } = authClient.useSession()
  // A guest has no chats and no socket (rule 9), so they are not asked for.
  return shouldGateGuest(session?.user) ? <GuestChats /> : <MemberChats />
}

function MemberChats() {
  useScreenInteractive()
  usePushPermissionPrompt()
  const t = useT()
  const { isRtl } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [black] = useFonts({ Nunito_900Black })

  /*
   * Two panes on a wide window, exactly as today's list: the same parameter
   * (`chat/[id]` redirects here with `?open=` when there is room), the same
   * selection, and the same fall back to a pushed thread when the room goes.
   * See `ChatsScreen` in the route for the reasons; this is that, unchanged.
   */
  const twoPane = useTwoPane()
  const { open, at, call } = useLocalSearchParams<{ open?: string; at?: string; call?: string }>()
  const [selected, setSelected] = useState<string | undefined>(open)
  useEffect(() => {
    if (open) setSelected(open)
  }, [open])
  useEffect(() => {
    if (twoPane || selected === undefined) return
    setSelected(undefined)
    router.push(`/(app)/chat/${selected}`)
  }, [twoPane, selected])

  /*
   * The clock the rows' times are read against. The rows are memoised, so one
   * whose thread has not changed is not drawn again, and its "2m" from last
   * night would still say "2m" the next morning — today's list redrew every
   * row on any change at all, which is what kept its times right. So the
   * clock moves when the tab comes into view, when the app comes back to the
   * foreground and on a pull: each redraws every row once, and nothing a
   * message or a presence update does moves it. Under a minute it stays put,
   * since no time on a row is finer than that — so the focus that comes with
   * the first mount, or a quick look at another tab, redraws nothing.
   */
  const [now, setNow] = useState(Date.now)
  const tick = useCallback(
    () => setNow((prev) => (Date.now() - prev < CLOCK_STEP_MS ? prev : Date.now())),
    [],
  )
  useFocusEffect(tick)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') tick()
    })
    return () => subscription.remove()
  }, [tick])

  const me = useMe()
  const meId = me.data?._id
  const [shelf, setShelf] = useState<Shelf>('all')
  const conversations = useConversations(shelf)
  const pull = usePullToRefresh(() => {
    setNow(Date.now())
    return conversations.refetch()
  })
  const flags = useConversationFlags()
  const removeConversation = useDeleteConversation()
  /** One drawer at a time: two open is two sets of buttons and no telling them apart. */
  const [openRow, setOpenRow] = useState<string | null>(null)

  const items = useMemo(() => chatsListItems(conversations.data?.pages ?? []), [conversations.data])
  const threads = useMemo(
    () => items.flatMap((item) => (item.kind === 'heading' ? [] : [item.thread])),
    [items],
  )
  // The list names its own partners; see `useConversationPartners`.
  const partners = useConversationPartners(threads, meId)
  const state = listState({
    isPending: conversations.isPending,
    isError: conversations.isError,
    itemCount: items.length,
    isPaused: conversations.fetchStatus === 'paused',
  })

  /*
   * The handlers every block and row is given, kept stable so the memoised
   * cells skip a render they do not need: the latest closures live in a ref,
   * and the functions handed down only read it. Without this, opening one
   * drawer — which changes `openRow` — re-rendered every row on screen.
   */
  const latest = useRef({ twoPane, openRow })
  latest.current = { twoPane, openRow }

  async function confirmDelete(conversationId: string): Promise<void> {
    const yes = await confirmAlert({
      title: t('chats.deleteTitle'),
      message: t('chats.deleteBody'),
      confirmLabel: t('chats.delete'),
      destructive: true,
    })
    if (!yes) return
    removeConversation.mutate(conversationId, {
      onSuccess: () => showToast(t('chats.deleted')),
      onError: () => void showAlert(t('chats.deleteTitle'), t('common.retry')),
    })
  }

  /** The ⋯ and a long press: the same four as the drawer, on every platform. */
  function openMenu(thread: ConversationDto, title: string): void {
    void chooseAlert(title, undefined, [
      { label: thread.pinned ? t('chats.unpin') : t('chats.pin'), value: 'pin' },
      { label: thread.archived ? t('chats.unarchive') : t('chats.archive'), value: 'archive' },
      { label: thread.muted ? t('chats.unmute') : t('chats.mute'), value: 'mute' },
      { label: t('chats.delete'), value: 'delete', destructive: true },
    ]).then((choice) => {
      if (choice === 'pin') flags.mutate({ conversationId: thread._id, pinned: !thread.pinned })
      if (choice === 'archive') {
        flags.mutate({ conversationId: thread._id, archived: !thread.archived })
      }
      if (choice === 'mute') flags.mutate({ conversationId: thread._id, muted: !thread.muted })
      if (choice === 'delete') void confirmDelete(thread._id)
    })
  }

  const actions = useRef({ openMenu, confirmDelete, flags })
  actions.current = { openMenu, confirmDelete, flags }

  const handlers = useMemo<ChatHandlers>(
    () => ({
      open: (conversationId) => {
        setOpenRow(null)
        if (latest.current.twoPane) setSelected(conversationId)
        else router.push(`/(app)/chat/${conversationId}`)
      },
      menu: (thread, name) => actions.current.openMenu(thread, name),
      flag: (conversationId, change: ChatFlags) => {
        setOpenRow(null)
        actions.current.flags.mutate({ conversationId, ...change })
      },
      remove: (conversationId) => {
        setOpenRow(null)
        void actions.current.confirmDelete(conversationId)
      },
      openChange: (conversationId, next) => {
        if (next) setOpenRow(conversationId)
        else if (latest.current.openRow === conversationId) setOpenRow(null)
      },
    }),
    [],
  )

  /*
   * The first-week coach card: one thing worth learning in the first days,
   * with a button that does it. Stored with the tips (`chatsCoach`), so it is
   * gone once dismissed, and so is it when tips are off in Settings. Only on
   * the live list, and only when Show me has a thread to open.
   *
   * The first week is the one Me's checklist reads (`/me/tokens`'s
   * `firstWeek`): never a restored v1 account, which is new to this build
   * and not to correcting anybody.
   */
  const tips = useTips()
  const firstWeek =
    me.data !== undefined && !me.data.restoredFromV1 && isInFirstWeek(new Date(me.data.createdAt))
  const coachOn = shelf === 'all' && firstWeek && tips.settled && tips.pick('chatsCoach') === COACH
  const coachTarget = coachOn ? coachThread(items) : undefined

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.kind === 'heading') {
        return (
          <ChatsHeading
            label={item.heading === 'waiting' ? t('chats.waitingTitle') : t('chats.othersTitle')}
          />
        )
      }
      const { thread } = item
      const isSelected = twoPane && selected === thread._id
      if (item.kind === 'waiting' && thread.partner) {
        return (
          <WaitingBlock
            thread={thread}
            partner={thread.partner}
            lead={item.lead}
            selected={isSelected}
            now={now}
            handlers={handlers}
          />
        )
      }
      const partnerId = thread.participants.find((id) => id !== meId) ?? ''
      return (
        <ChatRowV3
          thread={thread}
          partner={thread.partner ?? partners[partnerId]}
          meId={meId}
          open={openRow === thread._id}
          selected={isSelected}
          now={now}
          handlers={handlers}
        />
      )
    },
    [t, twoPane, selected, now, handlers, meId, partners, openRow],
  )

  const archived = shelf === 'archived'
  const header = (
    <View style={styles.header}>
      {archived ? (
        <IconButton
          icon={isRtl ? 'arrow-right' : 'arrow-left'}
          accessibilityLabel={t('chats.backToChats')}
          onPress={() => setShelf('all')}
        />
      ) : null}
      <Text
        style={archived ? styles.titleArchived : [styles.title, !black && styles.titleFallback]}
        accessibilityRole="header"
        numberOfLines={2}
      >
        {archived ? t('chats.archivedChats') : t('tabs.chats')}
      </Text>
      {archived ? null : (
        <>
          {/* The only way into the starred list; a star with no read is a write nobody sees. */}
          <IconButton
            icon="star"
            iconSize={v3.icon.xl}
            accessibilityLabel={t('chats.starredMessages')}
            onPress={() => router.push('/(app)/starred')}
          />
          <IconButton
            icon="archive"
            iconSize={v3.icon.xl}
            accessibilityLabel={t('chats.archivedChats')}
            onPress={() => setShelf('archived')}
          />
        </>
      )}
    </View>
  )

  const list = (
    <Screen fluid tabbed ground={v3.colors.bg}>
      {header}
      {state === 'skeleton' ? (
        <View>
          {SKELETON_ROWS.map((key) => (
            <ChatRowSkeletonV3 key={key} />
          ))}
        </View>
      ) : state === 'failed' ? (
        <LoadFailed onRetry={() => void conversations.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={chatsListKey}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (conversations.hasNextPage && !conversations.isFetchingNextPage) {
              void conversations.fetchNextPage()
            }
          }}
          ListHeaderComponent={
            coachTarget ? (
              <ChatsCoach
                onShow={() => {
                  track({ name: 'tip_action', properties: { tip: COACH, slot: 'chatsCoach' } })
                  tips.dismiss(COACH)
                  handlers.open(coachTarget._id)
                }}
                onDismiss={() => {
                  track({ name: 'tip_dismissed', properties: { tip: COACH, slot: 'chatsCoach' } })
                  tips.dismiss(COACH)
                }}
              />
            ) : null
          }
          ListFooterComponent={
            conversations.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footer} />
            ) : !archived && items.length > 0 && !conversations.hasNextPage ? (
              <FindSomeone />
            ) : null
          }
          ListEmptyComponent={
            archived ? (
              <EmptyStateV3
                art="chats"
                line={t('chats.archivedEmptyBody')}
                actionLabel={t('chats.backToChats')}
                actionVariant="secondary"
                onAction={() => setShelf('all')}
              />
            ) : (
              <EmptyStateV3
                art="chats"
                line={t('chats.emptyLine')}
                actionLabel={t('chats.findSomeone')}
                onAction={goToPeople}
              />
            )
          }
        />
      )}
    </Screen>
  )

  if (!twoPane) return list

  // The panel is keyed on the thread, so a new choice never inherits the last
  // one's draft, scroll position or pending sends.
  return (
    <TwoPane
      list={list}
      empty={{ icon: 'message-circle', title: t('chats.pickTitle'), body: t('chats.pickBody') }}
      detail={
        selected === undefined ? null : (
          <ChatScreen
            key={selected}
            conversationId={selected}
            embedded
            onClose={() => setSelected(undefined)}
            {...(at && open === selected ? { at } : {})}
            {...(call && open === selected ? { call } : {})}
          />
        )
      }
    />
  )
}

/** People: where a new chat starts. The empty list's one next step, and the list's last. */
function goToPeople(): void {
  router.navigate('/(app)/(tabs)/discover')
}

/**
 * The coach card, counted as shown once per mount — the moment the tips'
 * own `Tip` counts one.
 */
function ChatsCoach({ onShow, onDismiss }: { onShow: () => void; onDismiss: () => void }) {
  const t = useT()
  const styles = useStyles()
  useEffect(() => {
    track({ name: 'tip_shown', properties: { tip: COACH, slot: 'chatsCoach' } })
  }, [])
  return (
    <View style={styles.coach}>
      <CoachCard
        icon="edit-3"
        title={t('chats.coachCorrectTitle')}
        body={t(`tips.${COACH}`)}
        action={{ label: t('chats.coachShowMe'), icon: 'play', onPress: onShow }}
        onDismiss={onDismiss}
      />
    </View>
  )
}

/** The dashed "Find someone" at the end of a list that has nothing more to load. */
function FindSomeone() {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={goToPeople}
      style={({ pressed }) => [styles.find, pressed && styles.findPressed]}
    >
      <Feather name="plus" size={v3.icon.lg} color={v3.colors.fg} />
      <Text style={styles.findLabel}>{t('chats.findSomeone')}</Text>
    </Pressable>
  )
}

/**
 * A guest: no chats to list and no account to have them on, so the one
 * thing to do is the same as an empty list's — find somebody in People,
 * where a hello asks for the account and remembers who it was for.
 */
function GuestChats() {
  useScreenInteractive()
  const t = useT()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [black] = useFonts({ Nunito_900Black })
  return (
    <Screen fluid tabbed ground={v3.colors.bg}>
      <View style={styles.header}>
        <Text
          style={[styles.title, !black && styles.titleFallback]}
          accessibilityRole="header"
          numberOfLines={2}
        >
          {t('tabs.chats')}
        </Text>
      </View>
      <EmptyStateV3
        art="chats"
        line={t('chats.emptyLine')}
        actionLabel={t('chats.findSomeone')}
        onAction={goToPeople}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[4],
    minHeight: 56,
    paddingBottom: v3.space[8],
    paddingTop: v3.space[8],
  },
  title: { ...v3.type.title, color: v3.colors.fg, flex: 1, paddingStart: v3.space[6] },
  // A step down beside the back arrow: "Discussions archivées" at the tab
  // title's size would not fit a phone on one line.
  titleArchived: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  // ExtraBold at Black's size until Black has loaded, as on Home, so the
  // line thickens rather than reflows when the face arrives.
  titleFallback: { fontFamily: DISPLAY_FONT },
  list: { paddingBottom: v3.space[32] },
  footer: { paddingVertical: v3.space[16] },
  coach: { marginBottom: v3.space[10] },
  find: {
    alignItems: 'center',
    // `muted`, not the drawing's lighter dash: the outline is the button's
    // whole edge, and an edge has to clear 3:1 on the ground.
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.tile,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'center',
    marginTop: v3.space[12],
    minHeight: 60,
    paddingHorizontal: v3.space[16],
  },
  findPressed: { backgroundColor: v3.colors.surface },
  findLabel: { ...v3.type.button, color: v3.colors.fg },
}))
