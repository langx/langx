import { useQueryClient } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { api, ApiRequestError } from '../../api/client'
import { keys, useStartConversation, type MessageDto } from '../../api/queries'
import type { PublicProfileDto } from '../../api/types'
import { useProfileCache, useProfileCacheStatus } from '../../hooks/useProfileCache'
import { useT } from '../../i18n'
import { authClient } from '../../lib/auth-client'
import { outgoingId } from '../../lib/outgoingMessages'
import { openPaywall } from '../../lib/paywall'
import { requireAccount } from '../../lib/requireAccount'
import { showToast } from '../../lib/toast'
import { addUnsent, newClientId } from '../../lib/unsentMessages'
import { loadUnsent, saveUnsent } from '../../lib/unsentStore'

/**
 * Everything `chat/new` does, apart from drawing it: who the partner is,
 * whether they can be written to, the draft, the stand-in bubble and the
 * first send with each of its refusals. One hook for both looks — the current
 * page and its v3 twin (`NewChatScreenV3`) — so the send that creates a
 * conversation, the paywall on the cap and the hand-over to a thread that
 * turned out to exist cannot drift apart between them.
 */
export function useNewChat() {
  const t = useT()
  const { to, from } = useLocalSearchParams<{ to: string; from?: string }>()
  const partnerId = to ?? ''
  const here = `/(app)/chat/new?to=${partnerId}`
  const { data: session } = authClient.useSession()
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
  /*
   * The same for somebody who takes messages only from people they already
   * talk to. Not while a conversation exists — the effect below hands that
   * one to its thread, where writing is still open.
   */
  const refused = !suspended && partner?.acceptsNewChats === false && !partner.conversationId
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
  /**
   * A conversation not started yet is the emptiest one there is, so starters
   * are always on offer until the first send — seeded by the partner, there
   * being no conversation id to seed them by.
   */
  const offerTopics = !suspended && !refused && !sending && partnerId !== ''
  /**
   * They are new, so this hello will not count against the day's new chats —
   * said before it is written, because it is the reason to write it now. Only
   * the server knows (the switch, the ceiling, both ages), so only its word
   * draws the line; a refusal after all still opens the paywall below.
   */
  const freeHello = partner?.freeHello === true && !sending

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
          openPaywall(undefined, here, 'gate', {
            limit: 'initiations',
            retryAt: caught.retryAt,
          })
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
        // Switched new chats off since the profile was read — same answer.
        if (caught.code === 'NEW_CHATS_REFUSED') {
          showToast(t('profile.newChatsRefused', { name: partner?.displayName ?? '' }))
          void queryClient.invalidateQueries({ queryKey: keys.profile(partnerId) })
          return
        }
        showToast(caught.message)
        return
      }
      showToast(t('profile.sendFailed'))
    }
  }

  return {
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
    busy: startConversation.isPending,
  }
}
