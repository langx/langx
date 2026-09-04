import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Text, View } from 'react-native'
import { subscribeToSignInProgress, type SignInStage } from '../lib/signInProgress'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * The overlay `src/lib/signInProgress.ts` decides the timing of.
 *
 * A `Modal` rather than an absolutely positioned layer, for the reason
 * `AlertHost` is one: it has to take the touches of the whole screen. Somebody
 * whose sign-in is slow will otherwise press the button again, and a second
 * sign-in racing the first is exactly what nobody needs while their profile is
 * being written.
 *
 * Mounted inside the auth group rather than at the root: it has nothing to say
 * on any other screen, and the root is already crowded enough that a fourth
 * host there would be a fourth thing to reason about on every launch.
 */
export function SignInProgressHost() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const [stage, setStage] = useState<SignInStage>('idle')

  useEffect(() => subscribeToSignInProgress(setStage), [])

  return (
    <Modal visible={stage !== 'idle'} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.title}>
            {t(stage === 'restoring' ? 'welcomeBack.restoringTitle' : 'auth.signingIn')}
          </Text>
          {/*
            Only past the second threshold. Before it the wait is not yet
            evidence of anything, and guessing would mean telling people with
            no v1 account that their v1 account is coming back.
          */}
          {stage === 'restoring' ? (
            <Text style={styles.body}>{t('welcomeBack.restoringBody')}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    maxWidth: 320,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    width: '100%',
  },
  title: { ...font.heading, color: colors.text, fontSize: 17, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, lineHeight: 21, textAlign: 'center' },
}))
