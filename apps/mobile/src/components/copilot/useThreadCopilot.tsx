import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import type { MessageDto } from '../../api/queries'
import {
  COPILOT_STATUS_KEY,
  copilotErrorKey,
  copilotRetryAt,
  useAskCopilot,
  useCopilotStatus,
  type CopilotAsk,
} from '../../api/copilot'
import { useAppConfig } from '../../hooks/useAppConfig'
import { useDisplayNames } from '../../i18n'
import { authClient } from '../../lib/auth-client'
import {
  copilotGate,
  copilotOffers,
  copilotTargetLanguage,
  type CopilotGate,
} from '../../lib/copilotGate'
import { copilotEmptyThread } from '../../lib/copilotErrors'
import { shouldGateGuest } from '../../lib/guestGate'
import { replyIdeasCache, replyIdeasFor } from '../../lib/replyIdeas'
import { makeStyles } from '../../lib/theme'
import { CopilotConsentSheet } from '../CopilotConsentSheet'
import type { ComposerCopilot } from '../thread/ComposerV3'
import { CopilotCard, type CopilotAnswerState } from './CopilotCard'
import { CopilotExplainSheet } from './CopilotExplainSheet'
import { ReplyIdeasChip, RiseIn } from './ReplyIdeasChip'

interface ThreadCopilotInput {
  /**
   * The v3 thread, and a thread somebody can write in. With `flags.v3Home`
   * off this is false, nothing below asks the server anything, and the
   * thread draws exactly what it drew before Copilot.
   */
  enabled: boolean
  conversationId: string
  draft: string
  /** A correction is being written: the draft is the other person's sentence. */
  correcting: boolean
  learning: readonly { code: string }[] | undefined
  partnerNative: readonly { code: string }[] | undefined
  /**
   * The thread newest first, sends on their way included — for Reply ideas,
   * which answers the other person's newest line. Undefined in a window
   * opened on an old message, whose "newest" is only the newest loaded.
   */
  items: readonly MessageDto[] | undefined
  viewerId: string | undefined
  /** "Use this", or an option tapped: into the draft, never sent. */
  onUse: (text: string) => void
}

interface ThreadCopilot {
  gate: CopilotGate
  /** For `ComposerV3`'s `copilot` prop; undefined when Copilot is off here. */
  composer: ComposerCopilot | undefined
  /** For the long-press menu: whether to offer Explain at all. */
  canExplain: boolean
  explain: (message: { _id: string }) => void
  /** The card above the composer — or Reply ideas, its chip or its answer — or nothing. */
  card: ReactNode
  /** The consent sheet and the Explain sheet, mounted with the thread's other sheets. */
  sheets: ReactNode
}

/**
 * Copilot in one v3 thread: whether it is offered, the questions, and the
 * card and sheets their answers land on.
 *
 * Three answers have to agree before anything is drawn — `flags.v3Home`
 * (`enabled`), the deployment's `copilotService`, and the server's "available
 * for you" (the allow-list, the exact 18+ check and consent), which is only
 * asked when the first two say yes. Every one of them says no for almost
 * everybody, and then this returns nothing to draw.
 *
 * One call per tap and nothing in the background: no question goes before
 * the person picks it, and the other person never sees any of it.
 */
export function useThreadCopilot({
  enabled,
  conversationId,
  draft,
  correcting,
  learning,
  partnerNative,
  items,
  viewerId,
  onUse,
}: ThreadCopilotInput): ThreadCopilot {
  const styles = useStyles()
  const names = useDisplayNames()
  const queryClient = useQueryClient()
  const service = useAppConfig().data?.copilotService
  // A guest is never asked about: `GET /copilot` would answer GUEST_ACCOUNT,
  // and the transport would take them to sign-up from inside the thread.
  const session = authClient.useSession().data
  const member = session !== null && session !== undefined && !shouldGateGuest(session.user)
  const status = useCopilotStatus(enabled && member && service === true)
  const gate: CopilotGate = enabled && member ? copilotGate(service, status.data) : 'off'
  const ask = useAskCopilot()

  const [card, setCard] = useState<CopilotAnswerState | null>(null)
  const [explained, setExplained] = useState<CopilotAnswerState | null>(null)
  const [consenting, setConsenting] = useState(false)
  /** The question the consent sheet stands in front of, asked once it is accepted. */
  const pending = useRef<(() => void) | null>(null)
  /*
   * Which question each surface is waiting on. Closing a card or a sheet, or
   * asking again, moves it on, so an answer that arrives after the person
   * has moved on is dropped rather than opening what they just closed.
   */
  const turn = useRef({ card: 0, sheet: 0, ideas: 0 })

  /*
   * Reply ideas: the message they would answer, and what its strip shows.
   * `ideas` belongs to `ideasFor` — a newer message, a draft or a send makes
   * the target go or change, and the strip goes with it.
   */
  const ideasTarget = replyIdeasFor(items ?? [], viewerId, draft, correcting)
  const [ideas, setIdeas] = useState<{ for: string; state: CopilotAnswerState } | null>(null)
  /** Messages the server found nothing to reply to: no chip for them again. */
  const [nothingFor, setNothingFor] = useState<ReadonlySet<string>>(() => new Set())

  // Another thread is another conversation: nothing carries over.
  useEffect(() => {
    turn.current.card += 1
    turn.current.sheet += 1
    turn.current.ideas += 1
    setCard(null)
    setExplained(null)
    setIdeas(null)
  }, [conversationId])

  // Copilot went off for this person: whatever was open goes with it.
  useEffect(() => {
    if (gate !== 'off') return
    setCard(null)
    setExplained(null)
    setIdeas(null)
  }, [gate])

  // Typing, a send, or a newer message: the strip has nothing left to answer.
  const ideasTargetId = ideasTarget?._id
  useEffect(() => {
    turn.current.ideas += 1
    setIdeas(null)
  }, [ideasTargetId])

  /** The draft the card's question was asked about, trimmed as it was sent. */
  const cardAsked = useRef<string | null>(null)
  /*
   * The card answers one draft. A send empties it, and typing on changes it:
   * either way the card has nothing left to say — and "Use this" on a
   * sentence that has grown since would throw away what was typed after the
   * question went.
   */
  useEffect(() => {
    if (cardAsked.current === null || draft.trim() === cardAsked.current) return
    cardAsked.current = null
    turn.current.card += 1
    setCard(null)
  }, [draft])

  const target = copilotTargetLanguage(learning, partnerNative)
  const offers = copilotOffers(draft, correcting, target)

  function withConsent(run: () => void): void {
    if (gate === 'consent') {
      pending.current = run
      setConsenting(true)
      return
    }
    run()
  }

  async function run(question: CopilotAsk, surface: 'card' | 'sheet'): Promise<void> {
    const show = surface === 'card' ? setCard : setExplained
    if (surface === 'card') cardAsked.current = 'text' in question ? question.text : null
    turn.current[surface] += 1
    const mine = turn.current[surface]
    const current = () => turn.current[surface] === mine
    show({ kind: 'loading' })
    try {
      const response = await ask.mutateAsync(question)
      if (!current()) return
      show({
        kind: 'answer',
        result: response.result,
        asked: 'text' in question ? question.text : '',
      })
    } catch (error) {
      if (!current()) return
      const key = copilotErrorKey(error)
      if (key === 'off' || key === 'consent') {
        show(null)
        // Ask again, so the button goes (off) or the gate reads consent.
        void queryClient.invalidateQueries({ queryKey: COPILOT_STATUS_KEY })
        if (key === 'consent') {
          pending.current = () => void run(question, surface)
          setConsenting(true)
        }
        return
      }
      show({ kind: 'error', key, retryAt: copilotRetryAt(error) })
    }
  }

  const check = (): void => {
    const text = draft.trim()
    withConsent(() => void run({ action: 'check', conversationId, text }, 'card'))
  }
  const sayIt = (): void => {
    const text = draft.trim()
    if (!target) return
    withConsent(
      () => void run({ action: 'sayIt', conversationId, text, targetLanguage: target }, 'card'),
    )
  }
  const explain = (message: { _id: string }): void => {
    withConsent(
      () => void run({ action: 'explain', conversationId, messageId: message._id }, 'sheet'),
    )
  }

  /*
   * One call per message: an answer already in hand is drawn again from the
   * session's cache, and the server's own cache dedupes the rest.
   */
  async function askIdeas(messageId: string): Promise<void> {
    const viewer = viewerId
    if (!viewer) return
    turn.current.ideas += 1
    const mine = turn.current.ideas
    const current = () => turn.current.ideas === mine
    const kept = replyIdeasCache.get(viewer, messageId)
    if (kept) {
      setIdeas({ for: messageId, state: answerOf(kept) })
      return
    }
    setIdeas({ for: messageId, state: { kind: 'loading' } })
    try {
      const response = await ask.mutateAsync({ action: 'replyIdeas', conversationId })
      if (!current()) return
      if (response.result.action !== 'replyIdeas') {
        setIdeas({ for: messageId, state: { kind: 'error', key: 'copilot.errNoAnswer' } })
        return
      }
      replyIdeasCache.set(viewer, messageId, response.result.ideas)
      setIdeas({ for: messageId, state: answerOf(response.result.ideas) })
    } catch (error) {
      if (!current()) return
      // Nothing to reply to after all: no sentence, and no chip for this one.
      if (copilotEmptyThread(error)) {
        setIdeas(null)
        setNothingFor((set) => new Set(set).add(messageId))
        return
      }
      const key = copilotErrorKey(error)
      if (key === 'off' || key === 'consent') {
        setIdeas(null)
        void queryClient.invalidateQueries({ queryKey: COPILOT_STATUS_KEY })
        if (key === 'consent') {
          pending.current = () => void askIdeas(messageId)
          setConsenting(true)
        }
        return
      }
      setIdeas({
        for: messageId,
        state: { kind: 'error', key, retryAt: copilotRetryAt(error) },
      })
    }
  }

  const openIdeas = (messageId: string): void => {
    withConsent(() => void askIdeas(messageId))
  }
  const closeIdeas = (): void => {
    turn.current.ideas += 1
    setIdeas(null)
  }

  const closeCard = (): void => {
    cardAsked.current = null
    turn.current.card += 1
    setCard(null)
  }
  const closeSheet = (): void => {
    turn.current.sheet += 1
    setExplained(null)
  }

  const composer: ComposerCopilot | undefined =
    gate === 'off'
      ? undefined
      : {
          gate,
          ...(offers.check ? { onCheck: check } : {}),
          ...(offers.sayIt && target
            ? { onSayIt: sayIt, targetLanguageName: names.language(target) }
            : {}),
          loading: card?.kind === 'loading',
        }

  const offered =
    ideasTarget && card === null && !nothingFor.has(ideasTarget._id) ? ideasTarget : undefined
  const openIdeasState = offered && ideas?.for === offered._id ? ideas.state : null

  return {
    gate,
    composer,
    canExplain: gate !== 'off',
    explain,
    card:
      gate === 'off' ? null : card ? (
        <View style={styles.cardSlot}>
          <CopilotCard
            state={card}
            quota={status.data?.quota}
            onUse={(text) => {
              closeCard()
              onUse(text)
            }}
            onClose={closeCard}
          />
        </View>
      ) : openIdeasState ? (
        <View style={styles.cardSlot}>
          <RiseIn>
            <CopilotCard
              state={openIdeasState}
              quota={status.data?.quota}
              onUse={(text) => {
                closeIdeas()
                onUse(text)
              }}
              onClose={closeIdeas}
            />
          </RiseIn>
        </View>
      ) : offered ? (
        <View style={styles.cardSlot}>
          <ReplyIdeasChip onPress={() => openIdeas(offered._id)} />
        </View>
      ) : null,
    sheets: enabled ? (
      <>
        <CopilotConsentSheet
          visible={consenting}
          onClose={() => setConsenting(false)}
          onConsented={() => {
            const next = pending.current
            pending.current = null
            next?.()
          }}
        />
        <CopilotExplainSheet state={explained} quota={status.data?.quota} onClose={closeSheet} />
      </>
    ) : null,
  }
}

function answerOf(ideas: readonly string[]): CopilotAnswerState {
  return { kind: 'answer', result: { action: 'replyIdeas', ideas: [...ideas] }, asked: '' }
}

const useStyles = makeStyles(({ v3 }) => ({
  // The composer's own gutter and ground, so the card reads as part of it.
  cardSlot: {
    backgroundColor: v3.colors.bg,
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[8],
  },
}))
