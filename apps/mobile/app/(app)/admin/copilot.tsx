import { COPILOT_RULES, type CopilotResponse } from '@langx/shared'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import {
  useAskCopilot,
  useCopilotStatus,
  useWithdrawCopilotConsent,
  type CopilotAsk,
} from '../../../src/api/copilot'
import { ApiRequestError } from '../../../src/api/client'
import {
  useAdminCopilotAccess,
  useAdminUser,
  useMe,
  useSetAdminCopilotAccess,
  useMessages,
  type ConversationDto,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminBlockV3,
  AdminCaptionV3,
  AdminFactsV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminRowV3,
  AdminRowsV3,
  AdminScreenV3,
  AdminSplitV3,
} from '../../../src/components/admin/AdminKitV3'
import { ConversationPicker } from '../../../src/components/ConversationPicker'
import { CopilotConsentSheet } from '../../../src/components/CopilotConsentSheet'
import { CopilotLabel } from '../../../src/components/CopilotLabel'
import { Button } from '../../../src/components/ui/Button'
import { useAppConfig } from '../../../src/hooks/useAppConfig'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { adminLookupKey, adminLookupState } from '../../../src/lib/adminLookup'
import { ADMIN } from '../../../src/lib/adminStrings'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const L = ADMIN.copilot

/**
 * Explain, on the newest correction in the thread's first page — the lab
 * explains that one rather than asking for an id nobody can see. Its own
 * component so the thread is only read once a chat is picked.
 */
function ExplainNewest({
  conversationId,
  busy,
  onAsk,
}: {
  conversationId: string
  busy: boolean
  onAsk: (question: CopilotAsk) => void
}) {
  const styles = useStyles()
  const messages = useMessages(conversationId)
  const items = messages.data?.pages[0]?.items ?? []
  const correctionId = items.find((message) => message.type === 'correction')?._id
  if (!correctionId) return <Text style={styles.muted}>{L.noCorrection}</Text>
  return (
    <Button
      label={L.explain}
      variant="secondary"
      loading={busy}
      onPress={() => onAsk({ action: 'explain', conversationId, messageId: correctionId })}
    />
  )
}

/**
 * The Copilot lab: the one way into Copilot in the app until its screens
 * exist, and only for an operator.
 *
 * It is here so the plumbing can be tried end to end — the consent sheet the
 * person will see, the allowance, the cache, the label — on a real build,
 * against the operator's own chats, before anybody else can reach it. It is
 * not where Copilot is switched on: that is a script, on purpose, and the
 * screen says so.
 */
export default function AdminCopilotScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const service = useAppConfig().data?.copilotService === true
  const status = useCopilotStatus(true)
  const withdraw = useWithdrawCopilotConsent()
  const ask = useAskCopilot()
  const me = useMe()
  const allowed = useAdminCopilotAccess()
  const allowedUsers = allowed.data?.users ?? []
  const setAccess = useSetAdminCopilotAccess()
  const meAllowed = allowedUsers.some((row) => row.userId === me.data?._id)

  // Adding from here, not only from Find someone: the switch at the foot of a
  // user's page was the only way in, and it was not found. Typed, then looked
  // up after a pause — Find someone's reason: submit does not fire on web.
  const [handle, setHandle] = useState('')
  const [lookup, setLookup] = useState('')
  const found = useAdminUser(lookup)
  useEffect(() => {
    const timer = setTimeout(() => setLookup(adminLookupKey(handle)), 400)
    return () => clearTimeout(timer)
  }, [handle])
  const lookupState = adminLookupState({
    typed: handle,
    lookup,
    hasData: found.data !== undefined,
    isFetching: found.isFetching,
    error: found.error,
  })
  // Which account a button is pressing for, so only that one spins. Every
  // other button waits too: `variables` only knows the latest press.
  const pendingId = setAccess.isPending ? setAccess.variables?.userId : undefined

  const allow = (userId: string, next: boolean): void => {
    setAccess.mutate(
      { userId, allowed: next },
      {
        onSuccess: () =>
          showToast(next ? ADMIN.users.copilot.allowed : ADMIN.users.copilot.revoked),
        onError: () => showToast(ADMIN.common.failed),
      },
    )
  }

  const [sheet, setSheet] = useState(false)
  const [picking, setPicking] = useState(false)
  const [chat, setChat] = useState<ConversationDto | null>(null)
  const [sentence, setSentence] = useState('')
  const [answer, setAnswer] = useState<CopilotResponse | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  const run = (question: CopilotAsk): void => {
    setAnswer(null)
    setRefusal(null)
    ask.mutate(question, {
      onSuccess: setAnswer,
      onError: (error) =>
        setRefusal(
          error instanceof ApiRequestError
            ? L.refused(error.code, error.reason)
            : L.refused(ADMIN.common.failed),
        ),
    })
  }

  const data = status.data
  const access = !data ? ADMIN.common.loading : data.available ? L.accessOk : L.accessOff

  const lab = (
    <>
      <AdminFactsV3
        rows={[
          { key: 'service', label: L.service, value: service ? L.serviceOn : L.serviceOff },
          { key: 'access', label: L.access, value: access },
          {
            key: 'consent',
            label: L.consent,
            value: data
              ? data.consented
                ? L.consentGiven
                : L.consentMissing
              : ADMIN.common.loading,
          },
          {
            key: 'left',
            label: L.left,
            value: data
              ? L.leftValue(data.quota.remaining, data.quota.limit)
              : ADMIN.common.loading,
          },
        ]}
      />

      {/* The screen's one blue: the sheet a person will see, shown as they see it. */}
      <Button label={L.showSheet} variant="blue" onPress={() => setSheet(true)} />
      {data?.consented ? (
        <Button
          label={L.withdraw}
          variant="secondary"
          onPress={() => withdraw.mutate()}
          loading={withdraw.isPending}
        />
      ) : null}

      <Button
        label={chat ? L.picked(chat.partner?.displayName ?? chat._id) : L.pick}
        variant="secondary"
        icon="message-circle"
        onPress={() => setPicking(true)}
      />
      {chat ? (
        <AdminBlockV3>
          <AdminFieldV3
            inBlock
            label={L.sentence}
            value={sentence}
            onChangeText={setSentence}
            maxLength={COPILOT_RULES.maxCheckChars}
          />
          <Button
            label={L.check}
            variant="secondary"
            disabled={sentence.trim().length === 0}
            loading={ask.isPending}
            onPress={() => run({ action: 'check', conversationId: chat._id, text: sentence })}
          />
          <Button
            label={L.replyIdeas}
            variant="secondary"
            loading={ask.isPending}
            onPress={() => run({ action: 'replyIdeas', conversationId: chat._id })}
          />
          <ExplainNewest conversationId={chat._id} busy={ask.isPending} onAsk={run} />
        </AdminBlockV3>
      ) : null}

      {refusal ? (
        <AdminNoteV3 tone="danger" icon="slash">
          {refusal}
        </AdminNoteV3>
      ) : null}
      {answer ? (
        <View style={styles.answer}>
          {/* The label people will see, exactly — so it is checked here too. */}
          <CopilotLabel />
          <Text style={styles.answerMeta}>{answer.cached ? L.cached : L.fresh}</Text>
          <Text style={styles.answerText} selectable>
            {JSON.stringify(answer.result, null, 2)}
          </Text>
        </View>
      ) : null}
    </>
  )

  const list = (
    <>
      <AdminHeadingV3 title={L.allowedTitle} />
      <AdminFactsV3
        rows={[
          {
            key: 'you',
            label: L.you,
            value:
              !allowed.data || !me.data
                ? ADMIN.common.loading
                : meAllowed
                  ? L.youAllowed
                  : L.youNotAllowed,
          },
        ]}
      />
      {allowed.data && me.data && !meAllowed ? (
        <Button
          label={L.allowMe}
          loading={pendingId === me.data._id}
          disabled={setAccess.isPending}
          onPress={() => me.data && allow(me.data._id, true)}
        />
      ) : null}
      <AdminFieldV3
        label={L.addLabel}
        placeholder={L.addPlaceholder}
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {lookupState === 'found' && found.data ? (
        <>
          <AdminRowsV3>
            <AdminRowV3
              title={`${found.data.user.displayName} @${found.data.user.handle}`}
              subtitle={found.data.user.copilotAccess ? L.youAllowed : L.notAllowed}
              mark={{ id: found.data.user.userId, label: found.data.user.displayName }}
            />
          </AdminRowsV3>
          <Button
            label={found.data.user.copilotAccess ? L.remove : L.allow}
            variant={found.data.user.copilotAccess ? 'secondary' : 'primary'}
            loading={pendingId === found.data.user.userId}
            disabled={setAccess.isPending}
            onPress={() =>
              found.data && allow(found.data.user.userId, !found.data.user.copilotAccess)
            }
          />
        </>
      ) : lookupState === 'searching' ? (
        <AdminCaptionV3>{L.addSearching}</AdminCaptionV3>
      ) : lookupState === 'notFound' ? (
        <AdminCaptionV3>{L.addNone}</AdminCaptionV3>
      ) : lookupState === 'error' ? (
        <>
          <AdminNoteV3 tone="danger" icon="alert-triangle">
            {L.addFailed}
          </AdminNoteV3>
          <Button label={L.addRetry} variant="secondary" onPress={() => void found.refetch()} />
        </>
      ) : null}
      {allowed.data && allowedUsers.length === 0 ? (
        <AdminCaptionV3>{L.allowedEmpty}</AdminCaptionV3>
      ) : allowedUsers.length > 0 ? (
        <AdminRowsV3>
          {allowedUsers.map((row) => (
            <AdminRowV3
              key={row.userId}
              title={`${row.displayName} @${row.username}`}
              subtitle={L.allowedSince(row.at.slice(0, 10))}
              mark={{ id: row.userId, label: row.displayName }}
              onPress={() =>
                router.push(`/(app)/admin/users?q=${encodeURIComponent(row.username)}`)
              }
              action={
                <Button
                  label={L.removeShort}
                  variant="secondary"
                  size="small"
                  style={styles.rowAction}
                  loading={pendingId === row.userId}
                  disabled={setAccess.isPending}
                  onPress={() => allow(row.userId, false)}
                />
              }
            />
          ))}
        </AdminRowsV3>
      ) : null}

      {/* Numbered, because every one of them has to hold at once. */}
      <AdminHeadingV3 title={L.whoTitle} />
      <AdminRowsV3>
        {L.whoRules.map((rule, index) => (
          <View key={rule} style={styles.rule}>
            <Text style={styles.ruleNumber}>{index + 1}</Text>
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </AdminRowsV3>
      <AdminCaptionV3>{L.switchNote}</AdminCaptionV3>
    </>
  )

  return (
    <AdminGate>
      <AdminScreenV3 title={L.title} back="/(app)/admin">
        <AdminNoteV3 tone="info" icon="cpu">
          {L.hint}
        </AdminNoteV3>
        <AdminSplitV3 start={lab} end={list} endWidth={460} />

        <CopilotConsentSheet visible={sheet} onClose={() => setSheet(false)} />
        <ConversationPicker
          visible={picking}
          title={L.pickTitle}
          onPick={(conversation) => {
            setChat(conversation)
            setAnswer(null)
            setRefusal(null)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      </AdminScreenV3>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  muted: { ...v3.type.caption, color: v3.colors.muted },
  // In a row, the button is as wide as its word rather than the column.
  rowAction: { width: 'auto' },
  // Copilot's own blue, as everywhere a suggestion is drawn.
  answer: {
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  answerMeta: { ...v3.type.caption, color: v3.colors.echoText },
  answerText: { ...v3.type.caption, color: v3.colors.fg },
  rule: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  ruleNumber: {
    ...v3.type.label,
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    color: v3.colors.pillText,
    height: 26,
    lineHeight: 26,
    overflow: 'hidden',
    textAlign: 'center',
    width: 26,
  },
  ruleText: { ...v3.type.callout, color: v3.colors.fg, flex: 1 },
}))
