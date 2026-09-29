import { GIFT_CODE_PATTERN, GIFT_CODE_RULES, normalizeGiftCode } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useAdminCreateGiftCode, useAdminGiftCodes } from '../../../../src/api/queries'
import { ApiRequestError } from '../../../../src/api/client'
import { AdminGate } from '../../../../src/components/AdminGate'
import { Button } from '../../../../src/components/ui/Button'
import { Callout } from '../../../../src/components/ui/Callout'
import { FormField } from '../../../../src/components/ui/FormField'
import { ListRow } from '../../../../src/components/ui/ListRow'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles } from '../../../../src/lib/theme'
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
  const styles = useStyles()
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

  return (
    <AdminGate>
      <Screen scroll fluid onRefresh={() => void list.refetch()} refreshing={list.isFetching}>
        <ScreenHeader title={ADMIN.giftCodes.title} onBack={() => goBackTo('/(app)/admin')} />

        <Callout tone="info" icon="gift">
          <Text style={styles.calloutBody}>{ADMIN.giftCodes.hint}</Text>
        </Callout>

        <Text style={styles.heading}>{ADMIN.giftCodes.newTitle}</Text>
        <FormField
          label={ADMIN.giftCodes.code}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={32}
        />
        <Text style={styles.hint}>{ADMIN.giftCodes.codeHint}</Text>
        <FormField
          label={ADMIN.giftCodes.months}
          value={months}
          onChangeText={setMonths}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>{ADMIN.giftCodes.monthsHint}</Text>
        <FormField
          label={ADMIN.giftCodes.maxRedemptions}
          value={max}
          onChangeText={setMax}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>{ADMIN.giftCodes.maxRedemptionsHint}</Text>
        <FormField
          label={ADMIN.giftCodes.expiresAt}
          value={lastDay}
          onChangeText={setLastDay}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>{ADMIN.giftCodes.expiresAtHint}</Text>
        <FormField label={ADMIN.giftCodes.note} value={note} onChangeText={setNote} />
        <View style={styles.actions}>
          <Button
            label={ADMIN.giftCodes.create}
            onPress={onCreate}
            disabled={!ready}
            loading={create.isPending}
          />
        </View>

        <Text style={styles.heading}>{ADMIN.giftCodes.list}</Text>
        {items.length ? (
          <View>
            {items.map((item, index) => (
              <ListRow
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
                last={index === items.length - 1}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>
            {list.isPending ? ADMIN.common.loading : ADMIN.giftCodes.empty}
          </Text>
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  heading: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  actions: { marginTop: 8 },
}))
