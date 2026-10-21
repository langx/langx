import { router } from 'expo-router'
import { useState } from 'react'
import { useAdminBroadcasts, useAdminCreateBroadcast } from '../../../../src/api/queries'
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

/**
 * Writing a broadcast, which is deliberately not sending one.
 *
 * This screen's only button makes a draft. Arming it is a second request on a
 * second screen — which is the whole reason a back gesture, a double tap or a
 * deep link cannot message five thousand people.
 */
export default function AdminBroadcastScreen() {
  useScreenInteractive()
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

  const form = (
    <>
      <AdminHeadingV3 title={ADMIN.broadcast.newTitle} />
      <AdminFieldV3
        label={ADMIN.broadcast.slug}
        hint={ADMIN.broadcast.slugHint}
        value={slug}
        onChangeText={(next) => setSlug(next.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
        autoCapitalize="none"
      />
      <AdminFieldV3
        label={ADMIN.broadcast.body}
        hint={ADMIN.broadcast.bodyHint}
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={6}
        maxLength={4000}
      />
      {/* The screen's one yellow. It makes a draft and nothing more. */}
      <Button
        label={ADMIN.broadcast.createDraft}
        onPress={onCreate}
        disabled={!ready}
        loading={create.isPending}
      />
    </>
  )

  const history = (
    <>
      <AdminHeadingV3 title={ADMIN.broadcast.history} />
      {list.data?.items.length ? (
        <AdminRowsV3>
          {list.data.items.map((item) => (
            <AdminRowV3
              key={item._id}
              title={item._id}
              subtitle={ADMIN.broadcast.progress(item.sent, item.total)}
              value={ADMIN.broadcast.status[item.status]}
              onPress={() => router.push(`/(app)/admin/broadcast/${item._id}`)}
            />
          ))}
        </AdminRowsV3>
      ) : (
        <AdminCaptionV3>{ADMIN.broadcast.empty}</AdminCaptionV3>
      )}
    </>
  )

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.broadcast.title} back="/(app)/admin">
        <AdminNoteV3 tone="warning" icon="users">
          {ADMIN.broadcast.audience(list.data?.audience ?? 0)}
        </AdminNoteV3>
        <AdminSplitV3 start={form} end={history} startWidth={520} />
      </AdminScreenV3>
    </AdminGate>
  )
}
