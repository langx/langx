import { router } from 'expo-router'
import { useState } from 'react'
import { useCopilotStatus, useWithdrawCopilotConsent } from '../../../api/copilot'
import { useAppConfig } from '../../../hooks/useAppConfig'
import { useT } from '../../../i18n'
import { confirmAlert } from '../../../lib/alert'
import { authClient } from '../../../lib/auth-client'
import { copilotGate } from '../../../lib/copilotGate'
import { shouldGateGuest } from '../../../lib/guestGate'
import { showToast } from '../../../lib/toast'
import { CopilotConsentSheet } from '../../CopilotConsentSheet'
import { Toggle } from '../../ui/Toggle'
import { SettingsGroupV3, SettingsItemV3 } from './SettingsKitV3'

/**
 * Copilot on the Privacy page: whether it is on for you, and the switch that
 * takes your agreement back — as easy to withdraw as it was to give, which
 * is what App Review 5.1.2(i) and Play's AI policy both ask for.
 *
 * Drawn only behind the thread's own gate (`copilotGate`): the deployment's
 * `copilotService` and the server's "available for you". For everybody else
 * — the switch off, no key, a guest — there is no row
 * at all, the same nothing the thread draws. Not in `SETTINGS_SECTIONS` for
 * that reason: the search would find a row most people's page does not have.
 *
 * Off withdraws consent on the server (`DELETE /copilot/consent`); nothing
 * more of theirs reaches the provider, and the next Copilot tap asks again.
 * On opens the same consent sheet the thread does — the only place consent is
 * ever recorded.
 *
 * Under the switch, the way to the Copilot page: a person deciding whether to
 * keep it on is the one who most wants to know what it does.
 */
export function CopilotSettingsV3() {
  const t = useT()
  const service = useAppConfig().data?.copilotService
  // A guest is never asked about: `GET /copilot` would answer GUEST_ACCOUNT.
  const session = authClient.useSession().data
  const member = session !== null && session !== undefined && !shouldGateGuest(session.user)
  const status = useCopilotStatus(member && service === true)
  const gate = member ? copilotGate(service, status.data) : 'off'
  const withdraw = useWithdrawCopilotConsent()
  const [consenting, setConsenting] = useState(false)

  if (gate === 'off') return null
  const on = gate === 'ready'

  const turnOff = async (): Promise<void> => {
    const ok = await confirmAlert({
      title: t('copilot.settingsOffTitle'),
      message: t('copilot.settingsOffBody'),
      confirmLabel: t('copilot.settingsOffConfirm'),
      destructive: true,
    })
    if (!ok) return
    withdraw.mutate(undefined, {
      onSuccess: () => showToast(t('copilot.settingsOffDone')),
      onError: () => showToast(t('common.retry')),
    })
  }

  return (
    <>
      <SettingsGroupV3>
        <SettingsItemV3
          icon="cpu"
          hue="sky"
          title={t('copilot.settingsTitle')}
          subtitle={t(on ? 'copilot.settingsOnBody' : 'copilot.settingsOffStateBody')}
          accessory={
            <Toggle
              accessibilityLabel={t('copilot.settingsTitle')}
              value={on}
              busy={withdraw.isPending}
              onValueChange={(next) => (next ? setConsenting(true) : void turnOff())}
            />
          }
        />
        <SettingsItemV3
          icon="info"
          title={t('copilot.settingsAbout')}
          onPress={() => router.push('/(app)/copilot')}
        />
      </SettingsGroupV3>
      <CopilotConsentSheet visible={consenting} onClose={() => setConsenting(false)} />
    </>
  )
}
