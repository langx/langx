import Feather from '@expo/vector-icons/Feather'
import { useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { api, ApiRequestError } from '../../../src/api/client'
import { keys, useStartConversation, type MessageDto } from '../../../src/api/queries'
import type { PublicProfileDto } from '../../../src/api/types'
import { ChatComposer } from '../../../src/components/ChatComposer'
import { ComposerHint } from '../../../src/components/ComposerHint'
import { MessageBubble } from '../../../src/components/MessageBubble'
import { PresenceLine } from '../../../src/components/PresenceLine'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useKeyboardInset } from '../../../src/hooks/useKeyboardInset'
import { useProfileCache, useProfileCacheStatus } from '../../../src/hooks/useProfileCache'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { authClient } from '../../../src/lib/auth-client'
import { goBackTo, openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { requireAccount } from '../../../src/lib/requireAccount'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'
import { outgoingId } from '../../../src/lib/outgoingMessages'
import { addUnsent, newClientId } from '../../../src/lib/unsentMessages'
import { loadUnsent, saveUnsent } from '../../../src/lib/unsentStore'

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
export default function NewChatScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { to, from } = useLocalSearchParams<{ to: string; from?: string }>()
  const partnerId = to ?? ''
  const here = `/(app)/chat/new?to=${partnerId}`
  const { data: session } = authClient.useSession()
  const keyboardInset = useKeyboardInset()
  const startConversation = useStartConversation()
  const queryClient = useQueryClient()
  // The cache the profile that pushed here has already filled, so the header
  // is drawn at once; the skeleton is for a deep link that arrives cold.
  const partner = useProfileCache(partnerId ? [partnerId] : [])[partnerId]
  const partnerLoading =
    useProfileCacheStatus(partnerId ? [partnerId] : [])[partnerId] === 'pending'
  /*
   * Nobody can write to a suspended account, the first message included, so
   * the composer gives way to the line the thread draws for one. The profile
   * no longer offers this screen for them; a profile cached from before the
   * suspension, or a link, still can.
   */
  const suspended = partner?.accountStatus === 'suspended'
  const [draft, setDraft] = useState('')
  /**
   * The sentence, drawn as its own bubble the moment Send is pressed, exactly
   * as the thread draws one.
   *
   * The thread has done this since the composer stopped locking: what was
   * typed moves into the conversation at once and the server's copy takes its
   * place. This screen was the one send that did not — it cleared the
   * composer, left the thread empty and waited out the round trip, which from
   * the other side of the screen reads as the message having gone nowhere. A
   * stand-in rather than the real thing: it carries no server id, so it is
   * drawn and nothing else, and the thread this screen is replaced by has the
   * real message in it.
   */
  const [sending, setSending] = useState<MessageDto | null>(null)

  /*
   * A conversation these two already have makes this the wrong screen: the
   * server refuses a second one, so anything written here would be refused at
   * the send. The profile that pushed here can be seconds out of date — the
   * thread may have been opened from another device, or by the other person
   * writing first — so the decision is taken again here, off the profile this
   * screen fetches for its own header.
   *
   * Only while the composer is empty: mid-sentence the send below hands the
   * words to the thread rather than dropping them, and that is the better of
   * the two. And only before a send has been made — `isIdle`, not merely "not
   * in flight": the send that succeeds invalidates the profiles, which fills
   * in `conversationId` here a beat before the screen is gone, and this must
   * not answer it with a second `replace` behind the one the send makes.
   */
  const existingConversationId = partner?.conversationId
  useEffect(() => {
    if (existingConversationId && !draft && startConversation.isIdle) {
      router.replace(`/(app)/chat/${existingConversationId}`)
    }
  }, [existingConversationId, draft, startConversation.isIdle])

  /**
   * Moves what was typed into the conversation that turned out to exist.
   *
   * The refusal does not carry its id, so it is read from the profile — the
   * same request the header is drawn from. The body is left as an unsent row
   * rather than sent: that row is what a thread already has for a sentence the
   * server never took, and one tap on it sends it. Before this the words went
   * nowhere and the chats list appeared instead, which from the composer reads
   * as the message having been swallowed.
   */
  async function handOverToExisting(body: string): Promise<void> {
    let conversationId: string | undefined
    try {
      conversationId = (await api.get<PublicProfileDto>(`/profiles/${partnerId}`)).conversationId
    } catch {
      // Nothing to add to the refusal that already happened.
    }
    if (!conversationId) {
      router.replace('/(app)/(tabs)/chats')
      return
    }
    // Added to what is stored rather than written over it: a thread reached
    // this way can already be holding rows from a tunnel.
    const stored = await loadUnsent(conversationId)
    await saveUnsent(
      conversationId,
      addUnsent(stored, {
        clientId: newClientId(Date.now(), Math.random()),
        body,
        failedAt: new Date().toISOString(),
      }),
    )
    router.replace(`/(app)/chat/${conversationId}`)
  }

  async function send(): Promise<void> {
    const body = draft.trim()
    if (!body || !partnerId || startConversation.isPending) return
    // The gate at the call site, where the screen knows what was being tried;
    // the transport catches a forgotten one only as a duller version of this.
    if (!requireAccount(session?.user, { action: 'message', toUserId: partnerId })) return
    // Cleared at once, like a send in a thread. Put back if the send fails,
    // so nothing typed is lost to a cap or a dropped connection.
    setDraft('')
    setSending({
      _id: outgoingId(newClientId(Date.now(), Math.random())),
      // No conversation to belong to yet — that is what this request creates.
      conversationId: '',
      senderId: session?.user.id ?? '',
      type: 'text',
      body,
      createdAt: new Date().toISOString(),
    })
    try {
      const conversation = await startConversation.mutateAsync({ toUserId: partnerId, body })
      // `inPlace`: the thread takes this screen's place without the stack's
      // slide — this screen was drawn as that thread, and a second screen
      // sliding in over it reads as the app opening the chat twice.
      router.replace(`/(app)/chat/${conversation._id}?inPlace=1`)
    } catch (caught) {
      setDraft(body)
      // The words are back in the composer, so the bubble holding them would
      // be a second copy of a message that was not sent.
      setSending(null)
      if (caught instanceof ApiRequestError) {
        // The free tier's daily cap is the single most important thing this
        // screen has to explain well — a generic failure here reads as a bug.
        // `openPaywall` rather than the raw route: it is the one place that
        // knows how the paywall is reached.
        if (caught.code === 'QUOTA_EXCEEDED') {
          openPaywall(undefined, here)
          return
        }
        // Somebody else got there first — from another device, or the other
        // person wrote. The thread exists, so what was typed goes to it.
        if (caught.code === 'CONVERSATION_EXISTS') {
          await handOverToExisting(body)
          return
        }
        // Suspended since the profile behind this screen was read. Reading it
        // again swaps the composer for the line that says so.
        if (caught.code === 'RECIPIENT_SUSPENDED') {
          showToast(t('chat.suspendedOnly'))
          void queryClient.invalidateQueries({ queryKey: keys.profile(partnerId) })
          return
        }
        showToast(caught.message)
        return
      }
      showToast(t('profile.sendFailed'))
    }
  }

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
            <Feather name="arrow-left" size={22} color={colors.text} />
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
                  <PresenceLine lastActiveAt={partner?.lastActiveAt} />
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
          <ComposerHint slot="chat" style={styles.threadTip} />
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
                onAddToCalendar={ignore}
                onJumpTo={ignore}
                onOpenMedia={ignore}
              />
            </View>
          ) : null}
        </View>

        {suspended ? (
          <View style={styles.suspendedNote}>
            <Text style={styles.suspendedNoteText}>{t('chat.suspendedOnly')}</Text>
          </View>
        ) : (
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
            placeholder={
              partner ? t('chat.sayHello', { name: partner.displayName }) : t('chat.writeMessage')
            }
            onSend={() => void send()}
            busy={startConversation.isPending}
            autoFocus
          />
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
