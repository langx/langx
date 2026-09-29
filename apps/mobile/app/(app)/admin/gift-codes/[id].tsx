import { router, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { useAdminGiftCode, useAdminSetGiftCodeActive } from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import { Button } from '../../../../src/components/ui/Button'
import { Callout } from '../../../../src/components/ui/Callout'
import { ListRow } from '../../../../src/components/ui/ListRow'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { StatTile } from '../../../../src/components/ui/StatTile'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { confirmAlert } from '../../../../src/lib/alert'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

/**
 * One code: how far through its redemptions it is, the switch, and who has
 * been through it.
 *
 * Switching off asks first and switching on does not — off is the one that
 * turns people away. Neither takes back anything already given; the gifts
 * are their own rows and end on their own dates.
 */
export default function AdminGiftCodeScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const detail = useAdminGiftCode(id)
  const toggle = useAdminSetGiftCodeActive()

  const data = detail.data
  const code = data?.code

  async function setActive(active: boolean) {
    if (!code) return
    if (!active) {
      const ok = await confirmAlert({
        title: ADMIN.giftCodes.confirmDeactivate(code.code),
        confirmLabel: ADMIN.giftCodes.deactivate,
        destructive: true,
      })
      if (!ok) return
    }
    try {
      await toggle.mutateAsync({ id: code._id, active })
      showToast(active ? ADMIN.giftCodes.switchedOn : ADMIN.giftCodes.switchedOff)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <AdminGate>
      <Screen scroll fluid onRefresh={() => void detail.refetch()} refreshing={detail.isFetching}>
        <ScreenHeader
          title={code?.code ?? ADMIN.giftCodes.title}
          onBack={() => goBackTo('/(app)/admin/gift-codes')}
        />

        {detail.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={80} />
            <Skeleton height={120} />
          </View>
        ) : !data || !code ? (
          <Callout tone="error">
            <Text style={styles.calloutBody}>{ADMIN.giftCodes.notFound}</Text>
          </Callout>
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile
                value={ADMIN.giftCodes.used(code.redemptions, code.maxRedemptions)}
                label={ADMIN.giftCodes.maxRedemptions}
              />
              <StatTile
                value={ADMIN.giftCodes.monthsShort(code.months)}
                label={ADMIN.giftCodes.months}
              />
            </View>
            <Text style={styles.muted}>
              {[
                ADMIN.giftCodes.state(
                  code.active,
                  code.expiresAt !== null && new Date(code.expiresAt) <= new Date(),
                ),
                code.expiresAt
                  ? ADMIN.giftCodes.until(code.expiresAt.slice(0, 10))
                  : ADMIN.giftCodes.noExpiry,
                ADMIN.giftCodes.createdOn(code.createdAt.slice(0, 10)),
              ].join(' · ')}
            </Text>
            {code.note ? <Text style={styles.note}>{code.note}</Text> : null}

            <View style={styles.actions}>
              <Button
                label={code.active ? ADMIN.giftCodes.deactivate : ADMIN.giftCodes.activate}
                variant={code.active ? 'danger' : 'primary'}
                loading={toggle.isPending}
                onPress={() => setActive(!code.active)}
              />
            </View>

            <Text style={styles.heading}>{ADMIN.giftCodes.redemptions}</Text>
            {data.redemptions.length === 0 ? (
              <Text style={styles.muted}>{ADMIN.giftCodes.noRedemptions}</Text>
            ) : (
              <View>
                {data.redemptions.map((row, index) => (
                  <ListRow
                    key={row.userId}
                    title={row.handle ? `@${row.handle}` : ADMIN.giftCodes.deletedAccount}
                    subtitle={[
                      row.displayName ?? '—',
                      row.at.slice(0, 16).replace('T', ' '),
                      row.giftStatus ?? '—',
                    ].join(' · ')}
                    onPress={
                      row.handle
                        ? () =>
                            router.push(
                              `/(app)/admin/users?q=${encodeURIComponent(row.handle ?? '')}`,
                            )
                        : undefined
                    }
                    last={index === data.redemptions.length - 1}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  heading: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  muted: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20 },
  note: { fontSize: 14, color: theme.colors.text, lineHeight: 20, marginTop: 8 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  actions: { marginTop: 16 },
}))
