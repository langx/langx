import Feather from '@expo/vector-icons/Feather'
import { Animated, Pressable, Text, View } from 'react-native'
import { ChatComposer } from '../../../src/components/ChatComposer'
import { ComposerHint } from '../../../src/components/ComposerHint'
import { MessageBubble } from '../../../src/components/MessageBubble'
import { PresenceLine } from '../../../src/components/PresenceLine'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useKeyboardInset } from '../../../src/hooks/useKeyboardInset'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useV3Home } from '../../../src/hooks/useV3Home'
import { useLocale, useT } from '../../../src/i18n'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { NewChatScreenV3 } from '../../../src/screens/chat/NewChatScreenV3'
import { useNewChat } from '../../../src/screens/chat/useNewChat'

/**
 * A conversation that does not exist yet, drawn as the one it is about to be.
 *
 * "Send a message" on a profile used to unfold a form on the profile itself.
 * v3 opens this instead: the thread's own header and composer over an empty
 * thread, so the first sentence is written where the reply will arrive. The
 * first send is what creates the conversation (`POST /conversations`), and the
 * screen is then replaced by the real thread — there is nothing to come back
 * to here.
 *
 * Everything that needs a conversation id — attachments, voice, the ⋯ menu —
 * is absent rather than disabled: the thread has them the moment it exists.
 */
export default function NewChatRoute() {
  // The redesign's page under `flags.v3Home`, read once per launch.
  return useV3Home() ? <NewChatScreenV3 /> : <NewChatScreen />
}

function NewChatScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { isRtl } = useLocale()
  const keyboardInset = useKeyboardInset()
  const {
    partnerId,
    from,
    here,
    partner,
    partnerLoading,
    suspended,
    deleted,
    refused,
    draft,
    setDraft,
    sending,
    offerTopics,
    freeHello,
    send,
    busy,
  } = useNewChat()

  return (
    <Screen fluid style={styles.screen}>
      {/* Padded for the keyboard the same way the thread is — see `useKeyboardInset`. */}
      <Animated.View style={[styles.avoid, { paddingBottom: keyboardInset }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.backPlain')}
            onPress={() => goBackTo('/(app)/(tabs)/discover', from)}
            hitSlop={12}
            style={styles.back}
          >
            <Feather name={isRtl ? 'arrow-right' : 'arrow-left'} size={22} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerUser}
            onPress={() => partner && openProfile(partner.handle, here)}
          >
            {partnerLoading ? (
              <Skeleton width={40} height={40} radius={20} />
            ) : (
              <Avatar
                url={partner?.avatarUrl}
                name={partner?.displayName ?? '?'}
                seed={partner?._id}
                size={40}
                online={partner?.isOnline ?? false}
              />
            )}
            <View style={styles.headerText}>
              {partnerLoading ? (
                <>
                  <Skeleton width={120} height={14} />
                  <Skeleton width={80} height={12} style={styles.headerSkeletonGap} />
                </>
              ) : (
                <>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {partner?.displayName ?? t('chat.title')}
                  </Text>
                  <PresenceLine
                    lastActiveAt={partner?.lastActiveAt}
                    timezone={partner?.timezone}
                    accountStatus={partner?.accountStatus}
                  />
                </>
              )}
            </View>
          </Pressable>
        </View>

        {/*
          The empty thread. The opening tip sits where the thread draws it on
          a short conversation — at the top of the column, under the header —
          so the screen already looks like the thread it is about to become.
        */}
        <View style={styles.thread}>
          {/* One opener at a time: while the composer offers conversation
            starters they are the invitation. Once a send is on its way the
            tip comes back, as it will be in the thread that replaces this. */}
          {offerTopics ? null : <ComposerHint slot="chat" style={styles.threadTip} />}
          {sending ? (
            /*
              At the bottom of the column, which is where the thread that
              replaces this screen draws it — the list is inverted, so its
              newest row sits nearest the composer. Drawing it under the tip
              instead would move the sentence up the screen and back down
              again in the time it takes to answer.

              Every handler is `ignore`: a long press, a reply or an echo on a
              message the server has not named yet has nothing to act on. The
              thread does the same for its own stand-ins.
            */
            <View style={styles.sending}>
              <MessageBubble
                message={sending}
                mine
                endsGroup
                partnerName={partner?.displayName ?? t('chat.them')}
                translating={false}
                // A message still on its way out has nothing to read aloud;
                // the long-press menu is inert on this stand-in anyway.
                speaking={false}
                hasReading={false}
                onReplayReading={ignore}
                highlighted={false}
                pending
                onLongPress={ignore}
                onEcho={ignore}
                onReply={ignore}
                // Nothing to swipe towards: the stand-in's handlers are all inert.
                canReply={false}
                // And nothing to heart: the server has not named this message
                // yet, so there is no id to send a reaction against.
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
              />
            </View>
          ) : null}
        </View>

        {suspended || deleted ? (
          <View style={styles.suspendedNote}>
            <Text style={styles.suspendedNoteText}>
              {t(deleted ? 'chat.deletedOnly' : 'chat.suspendedOnly')}
            </Text>
          </View>
        ) : refused ? (
          <View style={styles.suspendedNote}>
            <Text style={styles.suspendedNoteText}>
              {t('profile.newChatsRefused', { name: partner?.displayName ?? '' })}
            </Text>
          </View>
        ) : (
          <>
            {freeHello ? <Text style={styles.freeHello}>{t('chat.newcomerHelloFree')}</Text> : null}
            <ChatComposer
              value={draft}
              onChangeText={setDraft}
              placeholder={
                partner ? t('chat.sayHello', { name: partner.displayName }) : t('chat.writeMessage')
              }
              onSend={() => void send()}
              topicSeed={offerTopics ? partnerId : undefined}
              topicInterests={partner?.interests}
              busy={busy}
              autoFocus
            />
          </>
        )}
      </Animated.View>
    </Screen>
  )
}

/** Every action a bubble offers needs a message the server has named. */
const ignore = () => undefined

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  screen: { paddingHorizontal: 0 },
  avoid: { flex: 1 },
  // The thread's header, without the ⋯ — every entry in that menu needs a conversation.
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
  },
  back: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerUser: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minWidth: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { ...font.heading, color: colors.text, fontSize: 17 },
  headerSkeletonGap: { marginTop: 6 },
  thread: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  // Pushed to the bottom of the column — see the note at the call site.
  sending: { marginTop: 'auto' },
  // The thread's `channelNote`, so the two lines read as one rule.
  suspendedNote: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  suspendedNoteText: { ...font.caption, color: colors.textFaint, textAlign: 'center' },
  // The same caption, a step darker: it is good news rather than a closed door.
  freeHello: {
    ...font.caption,
    color: colors.textMuted,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  threadTip: {
    ...font.caption,
    alignSelf: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 300,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    textAlign: 'center',
  },
}))
