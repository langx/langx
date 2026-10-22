import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef } from 'react'
import { Animated, Pressable, ScrollView, Text, View } from 'react-native'
import type { HandleTone } from '../../hooks/useHandleAvailability'
import { useSelectPop } from '../../hooks/useSelectPop'
import { useLocale, useT } from '../../i18n'
import { selection } from '../../lib/haptics'
import { POP_FROM_GLYPH } from '../../lib/selectPop'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'
import { Screen } from '../ui/Screen'
import { FieldV3, WizardHeaderV3, WizardTitle, useWizardStyles } from './WizardV3'

/**
 * Step 4 in the redesign's look: the username large, with its "@" fixed in
 * front and a check inside the field once the name is free. The claim and
 * every rule about it stay in the route, which still lets the server have the
 * last word; this draws what the route knows.
 */
export function HandleV3({
  onBack,
  reserved,
  handle,
  onHandle,
  status,
  onRetry,
  submitError,
  inviteOpen,
  onOpenInvite,
  inviteCode,
  onInviteCode,
  inviter,
  canSubmit,
  submitting,
  onSubmit,
}: {
  onBack: () => void
  /** The v1 username kept for this person, when there is one. */
  reserved: string | undefined
  handle: string
  onHandle: (handle: string) => void
  status: { text: string; tone: HandleTone; retry?: true }
  onRetry: () => void
  submitError: string | undefined
  inviteOpen: boolean
  onOpenInvite: () => void
  inviteCode: string
  onInviteCode: (code: string) => void
  /** What the code resolved to, once there is a code: a name, or nobody. */
  inviter: { found: boolean; text: string } | undefined
  canSubmit: boolean
  submitting: boolean
  onSubmit: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const wizard = useWizardStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const toneColor =
    status.tone === 'good'
      ? v3.colors.correction
      : status.tone === 'bad'
        ? v3.colors.danger
        : v3.colors.muted
  // The rule under the field stays once the line above it has an answer to
  // give, so the screen does not lose the one sentence that says what a
  // username is for the moment one is typed.
  const rule = t('onboarding.handleBody')
  const isRule = status.text === rule
  const statusStyle = [isRule ? styles.statusQuiet : styles.status, { color: toneColor }]

  /*
   * The name turning out to be free is the step's one answer, so the check
   * lands with a pop and a tick — once per answer: a name typed on from a
   * free one goes back to checking, and its own answer ticks again.
   */
  const free = status.tone === 'good'
  const checkPop = useSelectPop(free, POP_FROM_GLYPH)
  const wasFree = useRef(free)
  useEffect(() => {
    if (free && !wasFree.current) void selection()
    wasFree.current = free
  }, [free])

  return (
    <Screen fluid ground={v3.colors.bg}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={wizard.column}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <WizardHeaderV3 step="handle" onBack={onBack} />
        <WizardTitle title={t('onboarding.handleTitle')} />

        {reserved ? (
          <View style={styles.reserved}>
            <Text style={styles.reservedTitle}>
              {t('onboarding.handleReserved', { handle: reserved })}
            </Text>
            <Text style={styles.reservedBody}>{t('onboarding.handleReservedBody')}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <FieldV3
            large
            ltr
            label={t('onboarding.username')}
            autoCapitalize="none"
            value={handle}
            onChangeText={onHandle}
            placeholder={t('onboarding.handlePlaceholder')}
            prefix={<Text style={styles.at}>@</Text>}
            suffix={
              free ? (
                <Animated.View style={[styles.check, { transform: [{ scale: checkPop }] }]}>
                  <Feather name="check" size={v3.icon.md} color={v3.colors.bg} />
                </Animated.View>
              ) : null
            }
          />
          {status.retry ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={statusStyle}>{status.text}</Text>
            </Pressable>
          ) : (
            <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={statusStyle}>
              {status.text}
            </Text>
          )}
          {/*
            Kept in the layout while the line above says the same thing, at
            opacity 0 and out of the reader's way, so the field's answers
            arriving and going never move the button under the finger.
          */}
          <Text
            style={[wizard.hint, isRule && styles.hidden]}
            accessibilityElementsHidden={isRule}
            aria-hidden={isRule}
            importantForAccessibility={isRule ? 'no-hide-descendants' : 'auto'}
          >
            {rule}
          </Text>
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        </View>

        <View style={wizard.footer}>
          {/*
            Not a step of its own, as today: one row until it is wanted, open
            by itself when a link already put a name there.
          */}
          {inviteOpen ? (
            <View style={styles.invite}>
              <FieldV3
                ltr
                label={t('onboarding.inviteCodeLabel')}
                value={inviteCode}
                onChangeText={onInviteCode}
                placeholder={t('onboarding.inviteCodePlaceholder')}
                autoCapitalize="none"
                hint={inviter && !inviter.found ? inviter.text : undefined}
              />
              {inviter?.found ? <Text style={styles.found}>{inviter.text}</Text> : null}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              onPress={onOpenInvite}
              style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}
            >
              <View style={styles.inviteMark}>
                <Feather name="user-plus" size={v3.icon.lg} color={v3.colors.ink} />
              </View>
              <Text style={styles.inviteText}>{t('onboarding.inviteCodeToggle')}</Text>
              <Feather name="plus" size={v3.icon.lg} color={v3.colors.fg} />
            </Pressable>
          )}

          <Button
            label={t('common.continue')}
            icon={isRtl ? 'arrow-left' : 'arrow-right'}
            iconPosition="end"
            disabled={!canSubmit}
            loading={submitting}
            onPress={onSubmit}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  // The app speaking for itself: Echo's tint, as the reserved name always was.
  reserved: {
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.card,
    gap: v3.space[2],
    padding: v3.space[16],
  },
  reservedTitle: { ...v3.type.button, color: v3.colors.echoText },
  reservedBody: { ...v3.type.caption, color: v3.colors.fg },
  field: { gap: v3.space[8], marginTop: v3.space[12] },
  at: { ...v3.type.headline, color: v3.colors.muted },
  check: {
    alignItems: 'center',
    backgroundColor: v3.colors.correction,
    borderRadius: v3.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  status: { ...v3.type.button, paddingHorizontal: v3.space[4] },
  statusQuiet: { ...v3.type.caption, paddingHorizontal: v3.space[4] },
  error: { ...v3.type.caption, color: v3.colors.danger, paddingHorizontal: v3.space[4] },
  pressed: { opacity: 0.6 },
  hidden: { opacity: 0 },
  // A one-line target, so its height is the platform's minimum rather than the line's.
  retry: { justifyContent: 'center', minHeight: ICON_BUTTON_TARGET },
  invite: { gap: v3.space[6] },
  found: { ...v3.type.caption, color: v3.colors.correction, paddingHorizontal: v3.space[4] },
  inviteRow: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 64,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[8],
  },
  inviteMark: {
    alignItems: 'center',
    backgroundColor: v3.hues.lime,
    borderRadius: v3.radius.icon,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  inviteText: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
}))
