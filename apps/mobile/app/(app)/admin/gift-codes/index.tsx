import { GIFT_CODE_PATTERN, GIFT_CODE_RULES, normalizeGiftCode } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { useAdminCreateGiftCode, useAdminGiftCodes } from '../../../../src/api/queries'
import { ApiRequestError } from '../../../../src/api/client'
import { AdminGate } from '../../../../src/components/AdminGate'
import {
  AdminCaptionV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminRowV3,
  AdminRowsV3,
  AdminScreenV3,
  AdminSplitV3,
} from '../../../../src/components/admin/AdminKitV3'
import { Button } from '../../../../src/components/ui/Button'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { showToast } from '../../../../src/lib/toast'

/** `2026-12-31`, or nothing. Anything else is not a date this form takes. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The codes, and a form for a new one.
 *
 * A code is made live: there is no draft, because a code nobody has been
 * told about redeems nothing, and the one who tells people is the operator
 * after this screen. Switching one off is on its own screen, behind a tap.
 */
export default function AdminGiftCodesScreen() {
  useScreenInteractive()
  const list = useAdminGiftCodes()
  const create = useAdminCreateGiftCode()
  const [code, setCode] = useState('')
  const [months, setMonths] = useState('1')
  const [max, setMax] = useState('')
  const [lastDay, setLastDay] = useState('')
  const [note, setNote] = useState('')

  const spelled = normalizeGiftCode(code)
  const monthCount = Number(months)
  const maxCount = max.trim() === '' ? null : Number(max)
  const ready =
    GIFT_CODE_PATTERN.test(spelled) &&
    Number.isInteger(monthCount) &&
    monthCount >= 1 &&
    monthCount <= GIFT_CODE_RULES.maxMonths &&
    (maxCount === null || (Number.isInteger(maxCount) && maxCount >= 1)) &&
    (lastDay.trim() === '' || DAY.test(lastDay.trim()))

  async function onCreate() {
    try {
      const created = await create.mutateAsync({
        code: spelled,
        months: monthCount,
        maxRedemptions: maxCount,
        // The end of the day named, in UTC — "last day" means the whole of it.
        expiresAt: lastDay.trim() ? `${lastDay.trim()}T23:59:59.999Z` : null,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      setCode('')
      setMax('')
      setLastDay('')
      setNote('')
      showToast(ADMIN.giftCodes.created)
      router.push(`/(app)/admin/gift-codes/${created._id}`)
    } catch (error) {
      showToast(
        error instanceof ApiRequestError && error.status === 400
          ? ADMIN.giftCodes.taken
          : ADMIN.common.failed,
      )
    }
  }

  const items = list.data?.items ?? []

  const form = (
    <>
      <AdminHeadingV3 title={ADMIN.giftCodes.newTitle} />
      <AdminFieldV3
        label={ADMIN.giftCodes.code}
        hint={ADMIN.giftCodes.codeHint}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={32}
      />
      <AdminFieldV3
        label={ADMIN.giftCodes.months}
        hint={ADMIN.giftCodes.monthsHint}
        value={months}
        onChangeText={setMonths}
        keyboardType="number-pad"
      />
      <AdminFieldV3
        label={ADMIN.giftCodes.maxRedemptions}
        hint={ADMIN.giftCodes.maxRedemptionsHint}
        value={max}
        onChangeText={setMax}
        keyboardType="number-pad"
      />
      <AdminFieldV3
        label={ADMIN.giftCodes.expiresAt}
        hint={ADMIN.giftCodes.expiresAtHint}
        value={lastDay}
        onChangeText={setLastDay}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <AdminFieldV3 label={ADMIN.giftCodes.note} value={note} onChangeText={setNote} />
      {/* The screen's one yellow: making a code is what this page commits. */}
      <Button
        label={ADMIN.giftCodes.create}
        icon="gift"
        onPress={onCreate}
        disabled={!ready}
        loading={create.isPending}
      />
    </>
  )

  const codes = (
    <>
      <AdminHeadingV3 title={ADMIN.giftCodes.list} />
      {items.length ? (
        <AdminRowsV3>
          {items.map((item) => (
            <AdminRowV3
              key={item._id}
              title={item.code}
              subtitle={[
                ADMIN.giftCodes.monthsShort(item.months),
                ADMIN.giftCodes.used(item.redemptions, item.maxRedemptions),
                item.expiresAt
                  ? ADMIN.giftCodes.until(item.expiresAt.slice(0, 10))
                  : ADMIN.giftCodes.noExpiry,
              ].join(' · ')}
              value={ADMIN.giftCodes.state(
                item.active,
                item.expiresAt !== null && new Date(item.expiresAt) <= new Date(),
              )}
              onPress={() => router.push(`/(app)/admin/gift-codes/${item._id}`)}
            />
          ))}
        </AdminRowsV3>
      ) : (
        <AdminCaptionV3>
          {list.isPending ? ADMIN.common.loading : ADMIN.giftCodes.empty}
        </AdminCaptionV3>
      )}
    </>
  )

  return (
    <AdminGate>
      <AdminScreenV3
        title={ADMIN.giftCodes.title}
        back="/(app)/admin"
        onRefresh={() => void list.refetch()}
        refreshing={list.isFetching}
      >
        <AdminNoteV3 tone="info" icon="gift">
          {ADMIN.giftCodes.hint}
        </AdminNoteV3>
        <AdminSplitV3 start={form} end={codes} startWidth={440} />
      </AdminScreenV3>
    </AdminGate>
  )
}
