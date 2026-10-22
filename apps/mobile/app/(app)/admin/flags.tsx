import { ADMIN_FLAG_NAMES, DEFAULT_APP_CONFIG, type AdminFlagName } from '@langx/shared'
import { Text, View } from 'react-native'
import { useAdminSetFlag, useAdminStats } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminCaptionV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminRowsV3,
  AdminScreenV3,
} from '../../../src/components/admin/AdminKitV3'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { Toggle } from '../../../src/components/ui/Toggle'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { confirmAlert } from '../../../src/lib/alert'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/** Widened so any flag can be looked up; only two have a caution. */
const CAUTIONS: Partial<Record<AdminFlagName, string>> = ADMIN.flags.cautions

/**
 * Every switchable `appConfig.flags` entry, one row each, with its value and
 * a switch.
 *
 * Each switch asks first, because every one of them reaches everybody at
 * once, and the server records it in the audit log with the name and the
 * value. The flags whose pull requests asked for a condition before they go on
 * carry that condition under their line — a caution, not a lock, because
 * whether the condition is met is the operator's call and not something the
 * app can see. `captchaRequired` is not here: it has its own control on the
 * System screen. Maintenance is not here either, and cannot be — the panel is
 * 503 while it is on.
 */
export default function AdminFlagsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const stats = useAdminStats()
  const flags = stats.data?.system.config.flags
  const setFlag = useAdminSetFlag()

  async function toggle(flag: AdminFlagName, value: boolean): Promise<void> {
    const caution = CAUTIONS[flag]
    const ok = await confirmAlert({
      title: ADMIN.flags.confirm(flag, value),
      message: caution
        ? `${ADMIN.flags.descriptions[flag]}\n\n${caution}`
        : ADMIN.flags.descriptions[flag],
      confirmLabel: value ? ADMIN.flags.turnOn : ADMIN.flags.turnOff,
      // Red when the switch moves away from where a fresh deployment starts:
      // a kill switch going off, or a rollout stage going on.
      destructive: value !== DEFAULT_APP_CONFIG.flags[flag],
    })
    if (!ok) return
    setFlag.mutate(
      { flag, value },
      {
        onSuccess: () => showToast(ADMIN.flags.done(flag, value)),
        onError: () => showToast(ADMIN.common.failed),
      },
    )
  }

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.flags.title} back="/(app)/admin">
        <AdminHeadingV3 title={ADMIN.flags.title} hint={ADMIN.flags.hint} />
        {stats.isPending || !flags ? (
          <View style={styles.loading}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : (
          <>
            <AdminRowsV3>
              {ADMIN_FLAG_NAMES.map((flag) => {
                const on = flags[flag]
                const caution = CAUTIONS[flag]
                const busy = setFlag.isPending && setFlag.variables?.flag === flag
                return (
                  <View key={flag} style={styles.row}>
                    <View style={styles.text}>
                      <Text style={styles.name}>
                        {flag}
                        <Text style={on ? styles.valueOn : styles.value}>
                          {` · ${on ? ADMIN.flags.on : ADMIN.flags.off}`}
                        </Text>
                      </Text>
                      <Text style={styles.description}>{ADMIN.flags.descriptions[flag]}</Text>
                      {caution ? <AdminNoteV3 tone="warning">{caution}</AdminNoteV3> : null}
                    </View>
                    <Toggle
                      value={on}
                      onValueChange={(next) => void toggle(flag, next)}
                      busy={busy}
                      disabled={setFlag.isPending && !busy}
                      accessibilityLabel={flag}
                    />
                  </View>
                )
              })}
            </AdminRowsV3>
            <AdminCaptionV3>{ADMIN.flags.captchaElsewhere}</AdminCaptionV3>
          </>
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  // The kit's row: a hairline on top, which `AdminRowsV3` tucks under its edge.
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  text: { flex: 1, gap: v3.space[4] },
  name: { ...v3.type.button, color: v3.colors.fg },
  value: { color: v3.colors.muted, fontWeight: '400' },
  valueOn: { color: v3.colors.fg, fontWeight: '400' },
  description: { ...v3.type.caption, color: v3.colors.muted },
}))
