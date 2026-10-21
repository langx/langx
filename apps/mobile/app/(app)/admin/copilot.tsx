import { COPILOT_RULES, type CopilotResponse } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
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
  useMe,
  useMessages,
  type ConversationDto,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { ConversationPicker } from '../../../src/components/ConversationPicker'
import { CopilotConsentSheet } from '../../../src/components/CopilotConsentSheet'
import { CopilotLabel } from '../../../src/components/CopilotLabel'
import { Button } from '../../../src/components/ui/Button'
import { Callout } from '../../../src/components/ui/Callout'
import { FormField } from '../../../src/components/ui/FormField'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useAppConfig } from '../../../src/hooks/useAppConfig'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

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
  const access = !data
    ? ADMIN.common.loading
    : data.available
      ? L.accessOk
      : data.reason === 'age'
        ? L.accessAge
        : L.accessOff

  return (
    <AdminGate>
      <Screen scroll>
        <ScreenHeader title={L.title} onBack={() => goBackTo('/(app)/admin')} />

        <Callout tone="info" icon="cpu">
          <Text style={styles.calloutBody}>{L.hint}</Text>
        </Callout>

        <View style={styles.facts}>
          <Fact label={L.service} value={service ? L.serviceOn : L.serviceOff} />
          <Fact label={L.access} value={access} />
          <Fact
            label={L.consent}
            value={
              data ? (data.consented ? L.consentGiven : L.consentMissing) : ADMIN.common.loading
            }
          />
          <Fact
            label={L.left}
            value={
              data ? L.leftValue(data.quota.remaining, data.quota.limit) : ADMIN.common.loading
            }
          />
        </View>

        <View style={styles.actions}>
          <Button label={L.showSheet} variant="blue" onPress={() => setSheet(true)} />
          {data?.consented ? (
            <Button
              label={L.withdraw}
              variant="secondary"
              onPress={() => withdraw.mutate()}
              loading={withdraw.isPending}
            />
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            label={chat ? L.picked(chat.partner?.displayName ?? chat._id) : L.pick}
            variant="secondary"
            onPress={() => setPicking(true)}
          />
          {chat ? (
            <>
              <FormField
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
            </>
          ) : null}
        </View>

        {refusal ? <Text style={styles.refusal}>{refusal}</Text> : null}
        {answer ? (
          <View style={styles.answer}>
            {/* The label people will see, exactly — so it is checked here too. */}
            <CopilotLabel />
            <Text style={styles.muted}>{answer.cached ? L.cached : L.fresh}</Text>
            <Text style={styles.answerText} selectable>
              {JSON.stringify(answer.result, null, 2)}
            </Text>
          </View>
        ) : null}

        <Text style={styles.heading}>{L.allowedTitle}</Text>
        <Fact
          label={L.you}
          value={
            !allowed.data || !me.data
              ? ADMIN.common.loading
              : allowedUsers.some((row) => row.userId === me.data?._id)
                ? L.youAllowed
                : L.youNotAllowed
          }
        />
        {allowed.data && allowedUsers.length === 0 ? (
          <Text style={styles.muted}>{L.allowedEmpty}</Text>
        ) : (
          <View>
            {allowedUsers.map((row, index) => (
              <ListRow
                key={row.userId}
                title={`${row.displayName} @${row.username}`}
                subtitle={L.allowedSince(row.at.slice(0, 10))}
                last={index === allowedUsers.length - 1}
                onPress={() =>
                  router.push(`/(app)/admin/users?q=${encodeURIComponent(row.username)}`)
                }
              />
            ))}
          </View>
        )}

        <Text style={styles.heading}>{L.whoTitle}</Text>
        {L.whoRules.map((rule) => (
          <Text key={rule} style={styles.rule}>
            {`• ${rule}`}
          </Text>
        ))}
        <Text style={styles.muted}>{L.whoPartner}</Text>

        <Text style={styles.muted}>{L.switchNote}</Text>

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
      </Screen>
    </AdminGate>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  const styles = useStyles()
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  calloutBody: { ...font.body, color: colors.text },
  facts: { gap: spacing.sm, marginTop: spacing.lg },
  fact: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  factLabel: { ...font.label, color: colors.textMuted },
  factValue: { ...font.body, color: colors.text, flexShrink: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  muted: { ...font.caption, color: colors.textMuted, marginTop: spacing.md },
  heading: { ...font.label, color: colors.textMuted, marginTop: spacing.xl },
  rule: { ...font.body, color: colors.text, marginTop: spacing.xs },
  refusal: { ...font.body, color: colors.danger, marginTop: spacing.lg },
  answer: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  answerText: { ...font.caption, color: colors.text },
}))
