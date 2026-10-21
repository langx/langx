import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'
import { useAdminGiftCode, useAdminSetGiftCodeActive } from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import {
  AdminBlockV3,
  AdminCaptionV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminQuoteV3,
  AdminRowV3,
  AdminRowsV3,
  AdminScreenV3,
  AdminStatV3,
  AdminStatsV3,
} from '../../../../src/components/admin/AdminKitV3'
import { Button } from '../../../../src/components/ui/Button'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { confirmAlert } from '../../../../src/lib/alert'
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
      <AdminScreenV3
        title={code?.code ?? ADMIN.giftCodes.title}
        back="/(app)/admin/gift-codes"
        onRefresh={() => void detail.refetch()}
        refreshing={detail.isFetching}
      >
        {detail.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={80} />
            <Skeleton height={120} />
          </View>
        ) : !data || !code ? (
          <AdminNoteV3 tone="danger" icon="alert-circle">
            {ADMIN.giftCodes.notFound}
          </AdminNoteV3>
        ) : (
          <>
            <AdminStatsV3>
              <AdminStatV3
                value={ADMIN.giftCodes.used(code.redemptions, code.maxRedemptions)}
                label={ADMIN.giftCodes.maxRedemptions}
              />
              <AdminStatV3
                value={ADMIN.giftCodes.monthsShort(code.months)}
                label={ADMIN.giftCodes.months}
              />
            </AdminStatsV3>
            <AdminCaptionV3>
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
            </AdminCaptionV3>
            {code.note ? (
              <AdminBlockV3>
                <AdminQuoteV3>{code.note}</AdminQuoteV3>
              </AdminBlockV3>
            ) : null}

            {/* Off is the red outline, because it turns people away; on is the
                screen's one yellow. */}
            <Button
              label={code.active ? ADMIN.giftCodes.deactivate : ADMIN.giftCodes.activate}
              variant={code.active ? 'danger' : 'primary'}
              loading={toggle.isPending}
              onPress={() => setActive(!code.active)}
            />

            <AdminHeadingV3 title={ADMIN.giftCodes.redemptions} />
            {data.redemptions.length === 0 ? (
              <AdminCaptionV3>{ADMIN.giftCodes.noRedemptions}</AdminCaptionV3>
            ) : (
              <AdminRowsV3>
                {data.redemptions.map((row) => (
                  <AdminRowV3
                    key={row.userId}
                    title={row.handle ? `@${row.handle}` : ADMIN.giftCodes.deletedAccount}
                    subtitle={[
                      row.displayName ?? '—',
                      row.at.slice(0, 16).replace('T', ' '),
                      row.giftStatus ?? '—',
                    ].join(' · ')}
                    mark={{ id: row.userId, label: row.displayName ?? row.handle ?? '—' }}
                    onPress={
                      row.handle
                        ? () =>
                            router.push(
                              `/(app)/admin/users?q=${encodeURIComponent(row.handle ?? '')}`,
                            )
                        : undefined
                    }
                  />
                ))}
              </AdminRowsV3>
            )}
          </>
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
}))
