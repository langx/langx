import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useAdminBroadcasts, useAdminCreateBroadcast } from '../../../../src/api/queries'
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

/**
 * Writing a broadcast, which is deliberately not sending one.
 *
 * This screen's only button makes a draft. Arming it is a second request on a
 * second screen — which is the whole reason a back gesture, a double tap or a
 * deep link cannot message five thousand people.
 */
export default function AdminBroadcastScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const list = useAdminBroadcasts()
  const create = useAdminCreateBroadcast()
  const [slug, setSlug] = useState('')
  const [body, setBody] = useState('')

  const ready = /^[a-z0-9][a-z0-9-]{2,}$/.test(slug) && body.trim().length > 0

  async function onCreate() {
    try {
      const job = await create.mutateAsync({ id: slug, bodies: { en: body.trim() } })
      setSlug('')
      setBody('')
      router.push(`/(app)/admin/broadcast/${job._id}`)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <AdminGate>
      <Screen scroll fluid>
        <ScreenHeader title={ADMIN.broadcast.title} onBack={() => goBackTo('/(app)/admin')} />

        <Callout tone="warning" icon="users">
          {ADMIN.broadcast.audience(list.data?.audience ?? 0)}
        </Callout>

        <Text style={styles.heading}>{ADMIN.broadcast.newTitle}</Text>
        <FormField
          label={ADMIN.broadcast.slug}
          value={slug}
          onChangeText={(next) => setSlug(next.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>{ADMIN.broadcast.slugHint}</Text>

        <FormField
          label={ADMIN.broadcast.body}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          maxLength={4000}
        />
        <Text style={styles.hint}>{ADMIN.broadcast.bodyHint}</Text>

        <Button
          label={ADMIN.broadcast.createDraft}
          onPress={onCreate}
          disabled={!ready}
          loading={create.isPending}
        />

        <Text style={styles.heading}>{ADMIN.broadcast.title}</Text>
        {list.data?.items.length ? (
          <View>
            {list.data.items.map((item, index) => (
              <ListRow
                key={item._id}
                title={item._id}
                subtitle={ADMIN.broadcast.progress(item.sent, item.total)}
                value={ADMIN.broadcast.status[item.status]}
                onPress={() => router.push(`/(app)/admin/broadcast/${item._id}`)}
                last={index === list.data.items.length - 1}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>{ADMIN.broadcast.empty}</Text>
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
}))
