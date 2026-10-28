import Feather from '@expo/vector-icons/Feather'
import { ERROR_CODES, HANDLE_CHANGE_COOLDOWN_DAYS, handleChangeFreeAt } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api, ApiRequestError } from '../../api/client'
import { invalidateOwnPublicViews, keys, useMe, type MeProfile } from '../../api/queries'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import {
  SettingsFormScreenV3,
  SettingsLeadV3,
  SettingsNoteV3,
} from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { ICON_BUTTON_TARGET } from '../../components/ui/IconButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { useHandleAvailability, useHandleStatus } from '../../hooks/useHandleAvailability'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const BACK_TO = '/(app)/settings/account' as const

/**
 * Changing the username in the redesign's look (`V-SetUsername`), behind
 * `flags.v3Home`. Every rule, word and request is `settings/username.tsx`'s:
 * the cooldown from `handleChangeFreeAt`, the confirmation that names its
 * price, and the same three refusals told apart. Only the drawing differs.
 */
export function UsernameScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const me = useMe()
  const { from } = useLocalSearchParams<{ from?: string }>()
  const back = () => goBackTo(BACK_TO, from)

  const freeAt = me.data ? handleChangeFreeAt(me.data) : undefined

  if (!me.data || freeAt) {
    return (
      <SettingsFormScreenV3 title={t('settings.usernameTitle')} onBack={back}>
        {!me.data ? (
          <View style={styles.loading}>
            <Skeleton width="70%" />
            <Skeleton height={60} />
          </View>
        ) : (
          <SettingsNoteV3 icon="clock" hue="tangerine">
            {t('settings.usernameCooldown', {
              handle: me.data.handle,
              date: freeAt?.toLocaleDateString(locale) ?? '',
            })}
          </SettingsNoteV3>
        )}
      </SettingsFormScreenV3>
    )
  }
  return <ChangeForm profile={me.data} onDone={back} />
}

function ChangeForm({ profile, onDone }: { profile: MeProfile; onDone: () => void }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const queryClient = useQueryClient()

  const [handle, setHandle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const availability = useHandleAvailability(handle)
  const status = useHandleStatus(handle, availability, t('settings.usernameHint'))
  const toneColor =
    status.tone === 'good'
      ? v3.colors.correction
      : status.tone === 'bad'
        ? v3.colors.danger
        : v3.colors.muted

  // Only a definite "taken" blocks, as in `settings/username.tsx`.
  const canSubmit =
    availability.parsed.success &&
    availability.available !== false &&
    !availability.checking &&
    !saving

  const v1Named = Boolean(profile.restoredFromV1) && !profile.previousHandle

  async function submit(): Promise<void> {
    if (!canSubmit) return
    const ok = await confirmAlert({
      title: t('settings.usernameConfirmTitle'),
      message: t('settings.usernameConfirmBody', { handle, count: HANDLE_CHANGE_COOLDOWN_DAYS }),
      confirmLabel: t('settings.usernameSave'),
    })
    if (!ok) return
    setSaving(true)
    setError(undefined)
    try {
      await api.post('/profiles/me/handle', { handle })
      await queryClient.invalidateQueries({ queryKey: keys.me })
      invalidateOwnPublicViews(queryClient, profile)
      showToast(t('settings.usernameSaved', { handle }))
      onDone()
    } catch (caught) {
      const code = caught instanceof ApiRequestError ? caught.code : undefined
      if (code === ERROR_CODES.HANDLE_CHANGE_TOO_SOON) {
        await queryClient.invalidateQueries({ queryKey: keys.me })
        return
      }
      setError(
        code === ERROR_CODES.HANDLE_TAKEN
          ? t('onboarding.handleTaken', { handle })
          : code === ERROR_CODES.HANDLE_RESERVED
            ? t('settings.usernameReserved', { handle })
            : t('settings.usernameFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  const statusLine = (
    <View style={styles.statusLine}>
      {status.tone === 'good' ? (
        <Feather name="check-circle" size={v3.icon.xs} color={toneColor} />
      ) : null}
      <Text
        // The rule itself is quiet; only an answer about the name is bold.
        style={[status.tone === 'quiet' ? styles.statusQuiet : styles.status, { color: toneColor }]}
      >
        {status.text}
      </Text>
    </View>
  )

  return (
    <SettingsFormScreenV3
      title={t('settings.usernameTitle')}
      onBack={onDone}
      footer={
        <Button
          label={t('settings.usernameSave')}
          icon="check"
          disabled={!canSubmit}
          loading={saving}
          onPress={submit}
        />
      }
    >
      <SettingsLeadV3>
        {v1Named
          ? t('settings.usernameIntroV1', { handle: profile.handle })
          : t('settings.usernameIntro', { handle: profile.handle })}
      </SettingsLeadV3>

      <View style={styles.field}>
        <FieldV3
          large
          ltr
          label={t('onboarding.username')}
          accessibilityLabel={t('onboarding.username')}
          autoCapitalize="none"
          autoFocus
          value={handle}
          onChangeText={(value) => setHandle(value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder={t('onboarding.handlePlaceholder')}
          prefix={<Text style={styles.at}>@</Text>}
        />
        {status.retry ? (
          <Pressable
            accessibilityRole="button"
            onPress={availability.refetch}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            {statusLine}
          </Pressable>
        ) : (
          statusLine
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {/* Said before the tap, not only in the dialog: the cooldown is the part
          that cannot be taken back. */}
      <SettingsNoteV3 icon="clock" hue="tangerine">
        {t('settings.usernameEvery', { count: HANDLE_CHANGE_COOLDOWN_DAYS })}
      </SettingsNoteV3>
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  field: { gap: v3.space[8] },
  at: { ...v3.type.headline, color: v3.colors.muted },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[6],
    paddingHorizontal: v3.space[20],
  },
  status: { ...v3.type.callout, flexShrink: 1, fontWeight: '700' },
  statusQuiet: { ...v3.type.caption, flexShrink: 1 },
  retry: { justifyContent: 'center', minHeight: ICON_BUTTON_TARGET },
  error: { ...v3.type.caption, color: v3.colors.danger, paddingHorizontal: v3.space[20] },
  pressed: { opacity: 0.6 },
}))
