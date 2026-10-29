import { MAGIC_LINK_TTL_MINUTES } from '@langx/shared'
import { router } from 'expo-router'
import { useT } from '../../i18n'
import { Button } from '../ui/Button'
import { AuthNoticeV3, AuthWaitV3 } from './AuthKitV3'

/**
 * Where the mailed sign-in link lands, in the redesign's look
 * (`V-MagicLink`), behind `flags.v3Home`. `app/magic-link.tsx` keeps the
 * token, when it is spent and where the app goes after; see it for why the
 * web waits for a tap and a phone does not.
 */
export function MagicLinkV3({
  view,
  error,
  busy,
  onVerify,
  onOpenInApp,
}: {
  /** `failed`: no token or a refused one. `web`: waiting for the tap. `native`: spending it. */
  view: 'failed' | 'web' | 'native'
  error: string | null
  busy: boolean
  onVerify: () => Promise<void>
  onOpenInApp: () => void
}) {
  const t = useT()

  if (view === 'failed') {
    return (
      <AuthNoticeV3
        brand
        hue="tangerine"
        icon="clock"
        title={t('auth.linkExpiredTitle')}
        body={error ?? t('auth.signInLinkExpiredBody', { count: MAGIC_LINK_TTL_MINUTES })}
      >
        <Button
          icon="send"
          label={t('auth.requestNewLink')}
          onPress={() => router.replace('/(auth)/sign-in-link')}
        />
      </AuthNoticeV3>
    )
  }

  if (view === 'web') {
    return (
      <AuthNoticeV3
        brand
        hue="lilac"
        icon="link"
        title={t('auth.openLinkTitle')}
        body={t('auth.openLinkBody')}
      >
        <Button icon="log-in" label={t('auth.openLinkButton')} onPress={onVerify} loading={busy} />
        {/* For a phone where the https link opened a browser instead of the app. */}
        <Button
          variant="secondary"
          icon="smartphone"
          label={t('auth.openInApp')}
          onPress={onOpenInApp}
        />
      </AuthNoticeV3>
    )
  }

  return <AuthWaitV3 label={t('auth.signingIn')} />
}
