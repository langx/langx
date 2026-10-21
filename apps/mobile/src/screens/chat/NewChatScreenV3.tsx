import Feather from '@expo/vector-icons/Feather'
import { useIsFocused } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Animated, ScrollView, Text, View } from 'react-native'
import { useQuota } from '../../api/queries'
import { ComposerHint } from '../../components/ComposerHint'
import { MessageBubble } from '../../components/MessageBubble'
import { ComposerV3 } from '../../components/thread/ComposerV3'
import { ThreadHeaderV3 } from '../../components/thread/ThreadHeaderV3'
import { PressableScale } from '../../components/ui/PressableScale'
import { Screen } from '../../components/ui/Screen'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { authClient } from '../../lib/auth-client'
import { chatsLeft } from '../../lib/chatsLeft'
import { pickStarters } from '../../lib/conversationStarters'
import { shouldGateGuest } from '../../lib/guestGate'
import { goBackTo, openProfile } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { useNewChat } from './useNewChat'

/**
 * A conversation that does not exist yet, in the redesign's look
 * (`V-NewChat`), behind `flags.v3Home`: the v3 thread's own band and
 * composer over an empty thread. Everything it does is `useNewChat`'s, the
 * hook the current page shares, so only the drawing differs.
 *
 * As there, nothing that needs a conversation id is drawn — no ⋯, no call,
 * no tray, no mic. The board's one change is the starters: rows in the
 * thread, under "Pick a first line", rather than chips over the field, and
 * gone once the field has text.
 */
export function NewChatScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const keyboardInset = useKeyboardInset()
  const focused = useIsFocused()
  const {
    partnerId,
    from,
    here,
    partner,
    partnerLoading,
    suspended,
    refused,
    draft,
    setDraft,
    sending,
    offerTopics,
    freeHello,
    send,
    busy,
  } = useNewChat()
  const { data: session } = authClient.useSession()
  const guest = shouldGateGuest(session?.user)
  const [topicRound, setTopicRound] = useState(0)
  const starters =
    offerTopics && draft === ''
      ? pickStarters(partnerId, topicRound, undefined, partner?.interests)
      : []

  return (
    /*
     * The band runs up behind the status bar, as the thread's does since it
     * learned to (`underStatusBar` on both): this screen is replaced by that
     * thread on the first send, and a band that starts a status bar lower
     * here would drop into place at the hand-over. This route is always
     * pushed full screen — no panel draws it — so there is no `embedded` case.
     */
    <Screen fluid style={styles.screen} ground={v3.colors.bg} underStatusBar>
      {/* Dark glyphs over the light hue while focused, as on the thread; see there. */}
      {focused && partner ? <StatusBar style="dark" /> : null}
      {/* Padded for the keyboard the same way the thread is — see `useKeyboardInset`. */}
      <Animated.View style={[styles.avoid, { paddingBottom: keyboardInset }]}>
        <ThreadHeaderV3
          partner={partner}
          loading={partnerLoading}
          typing={false}
          onBack={() => goBackTo('/(app)/(tabs)/discover', from)}
          onOpenProfile={() => partner && openProfile(partner.handle, here)}
          underStatusBar
        />

        <ScrollView
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
        >
          {sending ? null : (
            <View style={styles.opening}>
              <View
                style={styles.art}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View
                  style={[
                    styles.theirs,
                    {
                      backgroundColor: partner
                        ? v3.hues[partnerHueFor(partner._id)]
                        : v3.colors.line,
                    },
                  ]}
                >
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
                <View style={styles.mine}>
                  <View style={[styles.bar, styles.barLong]} />
                  <View style={[styles.bar, styles.barShort]} />
                </View>
              </View>
              <Text style={styles.openingText}>{t('chat.newChatStarts')}</Text>
            </View>
          )}

          {/* One opener at a time, as on the current page: the tip once the starters are gone. */}
          {offerTopics ? null : <ComposerHint slot="chat" style={styles.threadTip} />}

          {starters.length > 0 ? (
            <View style={styles.starters}>
              <View style={styles.startersHead}>
                <Text accessibilityRole="header" style={styles.startersTitle}>
                  {t('chat.pickFirstLine')}
                </Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.topicsShuffle')}
                  onPress={() => setTopicRound((round) => round + 1)}
                  style={styles.shuffle}
                >
                  <Feather name="shuffle" size={v3.icon.sm} color={v3.colors.fg} />
                  <Text style={styles.shuffleText}>{t('chat.topicsShuffle')}</Text>
                </PressableScale>
              </View>
              {starters.map((topic) => {
                const text = t(`chat.topics.${topic}`)
                return (
                  <PressableScale
                    key={topic}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.topicChip', { topic: text })}
                    onPress={() => setDraft(text)}
                    style={styles.starter}
                  >
                    <Text style={styles.starterText}>{text}</Text>
                    <View style={styles.starterMark}>
                      <Feather name="arrow-up" size={v3.icon.xs} color={v3.colors.fg} />
                    </View>
                  </PressableScale>
                )
              })}
            </View>
          ) : null}

          {sending ? (
            // At the foot of the column, where the thread that replaces this
            // draws it; every handler inert, as on the current page.
            <View style={styles.sending}>
              <MessageBubble
                message={sending}
                mine
                endsGroup
                partnerName={partner?.displayName ?? t('chat.them')}
                translating={false}
                speaking={false}
                hasReading={false}
                onReplayReading={ignore}
                highlighted={false}
                pending
                onLongPress={ignore}
                onEcho={ignore}
                onReply={ignore}
                canReply={false}
                canReact={false}
                onReact={ignore}
                onAnswerAsk={ignore}
                onRespondMeeting={ignore}
                onAnswerQuiz={ignore}
                onAnswerPoll={ignore}
                onCardAction={ignore}
                onAddToCalendar={ignore}
                onJumpTo={ignore}
                onOpenMedia={ignore}
                onOpenViewOnce={ignore}
                v3
                partnerHue={partner ? v3.hues[partnerHueFor(partner._id)] : undefined}
              />
            </View>
          ) : null}

          {/*
           * What this first message costs, at the foot of the empty thread as
           * the board draws it: People's allowance line, from the same
           * `/me/quota`. Only where it is true and still to come — not for Pro
           * (no limit, so `chatsLeft` gives nothing), not for a guest, not
           * once the message is on its way, not when the composer has given
           * way to a line, and not for a newcomer hello, whose own line says
           * it costs nothing.
           */}
          {sending || suspended || refused || freeHello || guest ? null : <ChatsLeftCard />}
        </ScrollView>

        {suspended ? (
          <Text style={styles.closed}>{t('chat.suspendedOnly')}</Text>
        ) : refused ? (
          <Text style={styles.closed}>
            {t('profile.newChatsRefused', { name: partner?.displayName ?? '' })}
          </Text>
        ) : (
          <>
            {freeHello ? <Text style={styles.freeHello}>{t('chat.newcomerHelloFree')}</Text> : null}
            <ComposerV3
              value={draft}
              onChangeText={setDraft}
              placeholder={
                partner ? t('chat.sayHello', { name: partner.displayName }) : t('chat.writeMessage')
              }
              onSend={() => void send()}
              busy={busy}
              partnerName={partner?.displayName ?? t('chat.them')}
              autoFocus
            />
          </>
        )}
      </Animated.View>
    </Screen>
  )
}

/**
 * "New chats left today: 3 of 5", in a card of its own. The words and the
 * numbers are People's (`ChatsLeftLine`): a plain count, said the same way on
 * both screens, with nothing to buy on it — the paywall comes only from the
 * cap itself, at the send. Nothing at all for an unlimited plan.
 */
function ChatsLeftCard() {
  const styles = useStyles()
  const t = useT()
  const quota = useQuota()
  const line = chatsLeft(quota.data?.initiations)
  if (!line) return null
  return (
    <View style={styles.chatsLeft}>
      <View style={styles.chatsLeftHead}>
        <Text style={styles.chatsLeftTitle}>
          {t('discover.chatsLeft', { count: line.left, total: line.total })}
        </Text>
        {line.pips ? (
          <View
            style={styles.pips}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {Array.from({ length: line.total }, (_, at) => (
              <View key={at} style={[styles.pip, at < line.left && styles.pipOn]} />
            ))}
          </View>
        ) : null}
      </View>
      <Text style={styles.chatsLeftNote}>{t('discover.chatsLeftNote')}</Text>
    </View>
  )
}

/** Every action a bubble offers needs a message the server has named. */
const ignore = () => undefined

const useStyles = makeStyles(({ v3 }) => ({
  screen: { paddingHorizontal: 0 },
  avoid: { flex: 1 },
  thread: { flex: 1 },
  threadContent: {
    flexGrow: 1,
    gap: v3.space[10],
    paddingBottom: v3.space[10],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[14],
  },
  opening: { alignItems: 'center', gap: v3.space[6], paddingBottom: v3.space[4] },
  art: { height: 84, width: 176 },
  theirs: {
    alignItems: 'center',
    borderRadius: 22,
    flexDirection: 'row',
    gap: v3.space[12],
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    start: 6,
    top: 4,
    width: 108,
  },
  dot: { backgroundColor: v3.colors.ink, borderRadius: v3.radius.pill, height: 9, width: 9 },
  mine: {
    backgroundColor: v3.colors.blue,
    borderRadius: 17,
    gap: v3.space[4],
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: v3.space[16],
    position: 'absolute',
    start: 86,
    top: 44,
    width: 84,
  },
  bar: { backgroundColor: v3.colors.onBlue, borderRadius: v3.radius.pill, height: 5 },
  barLong: { width: 52 },
  barShort: { opacity: 0.7, width: 30 },
  openingText: { ...v3.type.caption, color: v3.colors.muted, fontSize: 15, textAlign: 'center' },
  threadTip: {
    ...v3.type.caption,
    alignSelf: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.row,
    color: v3.colors.fg,
    maxWidth: 300,
    overflow: 'hidden',
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[10],
    textAlign: 'center',
  },
  starters: { gap: v3.space[8] },
  startersHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
    paddingStart: v3.space[6],
  },
  startersTitle: {
    ...v3.type.headline,
    color: v3.colors.fg,
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 22,
  },
  shuffle: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
  },
  shuffleText: { ...v3.type.label, color: v3.colors.fg, fontSize: 15 },
  starter: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[10],
  },
  starterText: { ...v3.type.body, color: v3.colors.fg, flex: 1, fontWeight: '600', lineHeight: 22 },
  starterMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  sending: { marginTop: 'auto' },
  chatsLeft: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[2],
    marginTop: 'auto',
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[12],
  },
  chatsLeftHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  chatsLeftTitle: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  chatsLeftNote: { ...v3.type.caption, color: v3.colors.muted },
  pips: { flexDirection: 'row', gap: v3.space[4] },
  pip: {
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  pipOn: { backgroundColor: v3.colors.fg, borderColor: v3.colors.fg },
  closed: {
    ...v3.type.caption,
    color: v3.colors.muted,
    padding: v3.space[16],
    textAlign: 'center',
  },
  freeHello: {
    ...v3.type.caption,
    color: v3.colors.muted,
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[16],
    textAlign: 'center',
  },
}))
