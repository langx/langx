import { ERROR_CODES, GIFT_CODE_REJECTIONS, type GiftCodeRejection } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native'
import { ApiRequestError } from '../api/client'
import { keys, useRedeemGiftCode } from '../api/queries'
import { useT, type MessageKey } from '../i18n'
import { track } from '../lib/analytics'
import type { GiftCodeOutcome } from '../lib/analyticsEvents'
import { makeStyles } from '../lib/theme'
import { KeyboardResizeHost } from './KeyboardResizeHost'
import { Button } from './ui/Button'
import { FormField } from './ui/FormField'

/** One sentence per refusal the API can give, so each reads as what it is. */
const REJECTION_COPY: Record<GiftCodeRejection, MessageKey> = {
  unknown: 'giftCode.unknown',
  inactive: 'giftCode.inactive',
  expired: 'giftCode.expired',
  exhausted: 'giftCode.exhausted',
  used: 'giftCode.used',
  lifetime: 'giftCode.lifetime',
  official: 'giftCode.official',
  unavailable: 'giftCode.unavailable',
}

function isRejection(reason: string | undefined): reason is GiftCodeRejection {
  return (GIFT_CODE_REJECTIONS as readonly string[]).includes(reason ?? '')
}

/** The sentence under the field for a failed redemption. */
function errorKey(error: unknown): MessageKey {
  if (error instanceof ApiRequestError) {
    if (error.code === ERROR_CODES.GIFT_CODE_REJECTED && isRejection(error.reason)) {
      return REJECTION_COPY[error.reason]
    }
    if (error.code === ERROR_CODES.RATE_LIMITED) return 'giftCode.rateLimited'
  }
  return 'giftCode.failed'
}

/**
 * The funnel's word for a refusal, or `null` when the server never answered
 * one — a dropped connection is not an outcome of the code.
 */
function outcomeOf(error: unknown): GiftCodeOutcome | null {
  if (!(error instanceof ApiRequestError)) return null
  if (error.code === ERROR_CODES.RATE_LIMITED) return 'rate_limited'
  if (error.code !== ERROR_CODES.GIFT_CODE_REJECTED) return null
  switch (error.reason) {
    case 'used':
    case 'expired':
    case 'exhausted':
      return error.reason
    default:
      return 'invalid'
  }
}

/**
 * "Have a gift code?" — a quiet link and the small sheet it opens.
 *
 * Self-contained on purpose: it owns its request, its errors and its sheet,
 * and takes nothing from the screen around it, so it drops under whichever
 * paywall layout is current.
 *
 * A code that lands closes the sheet and *then* refetches `me`. The grant
 * left a `proWelcome` on the profile, and the refetch is what opens "You're
 * Pro now" (`ProWelcomeHost`) — a modal of its own, and iOS silently refuses
 * to present one modal while another is still on screen. So on iOS the
 * refetch waits for this sheet's `onDismiss`. A grant RevenueCat has not
 * confirmed yet says so in the sheet instead; the celebration then comes with
 * a later `me`, once the scheduler has granted it.
 *
 * A code gives time, never money off — see docs/decisions.md — so nothing
 * here speaks of a discount.
 */
export function GiftCodeEntry() {
  const styles = useStyles()
  const t = useT()
  const queryClient = useQueryClient()
  const redeem = useRedeemGiftCode()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<MessageKey | null>(null)
  const [pending, setPending] = useState(false)
  /** A code was redeemed while the sheet was up; `me` is owed a refetch once it is gone. */
  const owed = useRef(false)

  function refreshMe(): void {
    if (!owed.current) return
    owed.current = false
    void queryClient.invalidateQueries({ queryKey: keys.me })
  }

  function close(): void {
    setOpen(false)
    setCode('')
    setError(null)
    setPending(false)
    redeem.reset()
    // Everywhere but iOS a closed Modal is gone at once; iOS says when, in `onDismiss`.
    if (Platform.OS !== 'ios') refreshMe()
  }

  async function submit(): Promise<void> {
    if (code.trim().length === 0 || redeem.isPending) return
    setError(null)
    try {
      const redeemed = await redeem.mutateAsync(code)
      track({
        name: 'gift_code_redeemed',
        properties: { outcome: 'granted', months: redeemed.months },
      })
      owed.current = true
      if (redeemed.status === 'granted') close()
      else setPending(true)
    } catch (caught) {
      const outcome = outcomeOf(caught)
      if (outcome) track({ name: 'gift_code_redeemed', properties: { outcome, months: null } })
      setError(errorKey(caught))
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>{t('giftCode.link')}</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={close}
        onDismiss={refreshMe}
        accessibilityViewIsModal
      >
        {/*
         * A sheet with a text field in it: iOS is lifted by the avoiding
         * view, Android by the same measured pad the root uses — a Modal is
         * its own window, so the one at the root does not reach in here.
         */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.fill}
        >
          <KeyboardResizeHost>
            <Pressable
              style={styles.backdrop}
              accessibilityLabel={t('giftCode.close')}
              onPress={close}
            >
              {/* Swallows the press so tapping the sheet does not close it. */}
              <Pressable style={styles.sheet} onPress={() => undefined}>
                <Text style={styles.title}>{t('giftCode.title')}</Text>
                {pending ? (
                  <>
                    <Text style={styles.pending} accessibilityLiveRegion="polite">
                      {t('giftCode.pending')}
                    </Text>
                    <Button label={t('giftCode.close')} onPress={close} />
                  </>
                ) : (
                  <>
                    <Text style={styles.body}>{t('giftCode.body')}</Text>
                    <FormField
                      label={t('giftCode.label')}
                      value={code}
                      onChangeText={(next) => {
                        setCode(next)
                        if (error) setError(null)
                      }}
                      error={error ? t(error) : undefined}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={64}
                      returnKeyType="done"
                      onSubmitEditing={() => void submit()}
                      autoFocus
                    />
                    <View style={styles.actions}>
                      <Button
                        label={t('giftCode.redeem')}
                        disabled={code.trim().length === 0}
                        loading={redeem.isPending}
                        onPress={() => void submit()}
                      />
                      <Button variant="secondary" label={t('giftCode.close')} onPress={close} />
                    </View>
                  </>
                )}
              </Pressable>
            </Pressable>
          </KeyboardResizeHost>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.5 },
  fill: { flex: 1 },
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on a wide web window — see `EchoAboutSheet`.
  sheet: {
    alignSelf: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: spacing.md,
    maxWidth: 480,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    width: '100%',
  },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 22 },
  pending: { ...font.body, color: colors.text, fontWeight: '600', lineHeight: 22 },
  actions: { gap: spacing.sm },
}))
