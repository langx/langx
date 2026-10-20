import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { ActivityIndicator, Platform, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { useBlackFont } from '../onboarding/WizardV3'
import { Button } from '../ui/Button'
import { AuthScreenV3, AuthTitleV3 } from './AuthKitV3'

/** Stands in for the bold path while the body is translated, as `qr.tsx` does. */
const PATH_MARK = String.fromCharCode(0)

export type QrSignInState = 'starting' | 'waiting' | 'approved' | 'expired' | 'error'

/**
 * Signing in by approving it on a phone, in the redesign's look
 * (`V-QrSignIn`), behind `flags.v3Home`. `app/(auth)/qr.tsx` keeps the
 * device flow — the codes, the poll, the countdown and the wait for the
 * session — and hands its state here.
 *
 * The code is drawn a character to a tile, so it can be read out to a phone
 * one at a time; a screen reader hears the same characters spaced out.
 */
export function QrSignInV3({
  state,
  userCode,
  qrUri,
  time,
  onNewCode,
}: {
  state: QrSignInState
  userCode: string
  /** The QR of the approval link, once there is a code to put in it. */
  qrUri: string | undefined
  /** What is left of the code, as `m:ss`. */
  time: string
  onNewCode: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  const black = useBlackFont()
  const [pathBefore = '', pathAfter = ''] = t('qrSignIn.bodyScan', { path: PATH_MARK }).split(
    PATH_MARK,
  )
  const canRenew = state === 'waiting' || state === 'expired' || state === 'error'

  return (
    <AuthScreenV3
      onBack={() => router.replace('/')}
      footer={
        <>
          {canRenew ? (
            <Button
              variant="secondary"
              icon="refresh-cw"
              label={t('qrSignIn.newCode')}
              onPress={onNewCode}
            />
          ) : null}
          {Platform.OS !== 'web' ? <Text style={styles.hint}>{t('qrSignIn.webOnly')}</Text> : null}
        </>
      }
    >
      <AuthTitleV3
        title={t('linkDevice.title')}
        body={
          state === 'waiting' ? (
            <>
              {pathBefore}
              <Text style={styles.strong}>{t('qrSignIn.scanPath')}</Text>
              {pathAfter}
            </>
          ) : undefined
        }
      />

      {state === 'starting' ? <ActivityIndicator color={v3.colors.fg} style={styles.wait} /> : null}

      {state === 'approved' ? (
        <View style={styles.wait}>
          <ActivityIndicator color={v3.colors.fg} />
          <Text style={styles.message}>{t('auth.signingIn')}</Text>
        </View>
      ) : null}

      {state === 'waiting' ? (
        <>
          {/* White in both schemes, inside the hue: a camera needs the contrast. */}
          <View style={[styles.qrBlock, { backgroundColor: v3.hues.sky }]}>
            <View style={styles.qrCard}>
              {qrUri ? (
                <Image
                  source={{ uri: qrUri }}
                  style={styles.qr}
                  contentFit="contain"
                  accessibilityLabel={t('qrSignIn.qrAccessibility')}
                />
              ) : null}
            </View>
          </View>
          <View style={styles.codeBlock}>
            <Text style={styles.kicker}>{t('qrSignIn.orEnterCode')}</Text>
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={userCode.split('').join(' ')}
              style={styles.tiles}
            >
              {userCode.split('').map((character, index) => (
                <View key={`${index}-${character}`} style={styles.tile}>
                  <Text style={[styles.tileText, !black && styles.fallback]}>{character}</Text>
                </View>
              ))}
            </View>
            <View style={styles.expires}>
              <Feather name="clock" size={v3.icon.xs} color={v3.colors.muted} />
              <Text style={styles.expiresText}>{t('qrSignIn.expiresIn', { time })}</Text>
            </View>
          </View>
        </>
      ) : null}

      {state === 'expired' || state === 'error' ? (
        <Text style={styles.message}>
          {t(state === 'expired' ? 'qrSignIn.expired' : 'qrSignIn.failed')}
        </Text>
      ) : null}
    </AuthScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  strong: { color: v3.colors.fg, fontWeight: '700' },
  wait: { alignItems: 'center', gap: v3.space[8], marginTop: v3.space[32] },
  message: { ...v3.type.body, color: v3.colors.muted, textAlign: 'center' },
  qrBlock: {
    alignItems: 'center',
    borderRadius: v3.radius.hero,
    justifyContent: 'center',
    marginTop: v3.space[4],
    paddingVertical: v3.space[24],
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: v3.radius.tile,
    height: 212,
    padding: v3.space[14],
    width: 212,
  },
  qr: { height: 184, width: 184 },
  codeBlock: { gap: v3.space[8], marginTop: v3.space[6] },
  // Not upper-cased: a transform is never done in the app's language (`Button` says why).
  kicker: { ...v3.type.label, color: v3.colors.muted },
  tiles: { flexDirection: 'row', gap: v3.space[8] },
  tile: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 64,
  },
  tileText: { ...v3.type.title, color: v3.colors.fg },
  fallback: { fontFamily: DISPLAY_FONT },
  expires: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  expiresText: { ...v3.type.caption, color: v3.colors.muted },
  hint: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
}))
