import Feather from '@expo/vector-icons/Feather'
import { isPaidTier, PLAN_LIMITS, TIER_NAMES } from '@langx/shared'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { keys, useEffectiveTier, useMe, type MessageDto } from '../api/queries'
import { useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import type { ConversationPageDto } from '../lib/conversationCache'
import { shouldGateGuest } from '../lib/guestGate'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import { openPaywall } from '../lib/paywall'
import {
  firstReplyShownTo,
  isAnsweredFirstReply,
  noOtherTwoWayThread,
  showsFirstReplyCard,
  withFirstReplyShown,
} from '../lib/proRoads'
import { makeStyles, useTheme } from '../lib/theme'
import { partnerHueFor } from '../lib/theme/partnerHue'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

/**
 * Accounts shown the card in this run of the app. The stored flag is the
 * record; this covers a store that cannot be written, and a second thread
 * opened before the write has landed.
 */
const shownThisRun = new Set<string>()

async function rememberShown(accountId: string): Promise<void> {
  try {
    const stored = await readJsonFlag<unknown>(FLAG_KEYS.firstReplyCardShown)
    await writeJsonFlag(FLAG_KEYS.firstReplyCardShown, withFirstReplyShown(stored, accountId))
  } catch {
    // Not remembered on disk: `shownThisRun` still holds it until the app closes.
  }
}

/**
 * The `first_reply` road: a card at the foot of the thread in which somebody
 * first wrote back, once the viewer has answered them.
 *
 * Inline and quiet — not a sheet, not a toast, nothing that takes focus or
 * moves the reply — because a reply after a first hello is the moment this
 * app exists for, and the card is read in the pause after it rather than in
 * its place (`isAnsweredFirstReply`). It says first that replying stays free,
 * then what Pro would add: no daily limit on starting new chats, the number
 * read off `PLAN_LIMITS`. The ✕ closes it in one tap.
 *
 * Once per account on this device, written the moment it is drawn — closed,
 * tapped or ignored, it does not come back. Never for Pro, paid, gifted or
 * lifetime, and never for a guest; `showsFirstReplyCard` has every rule.
 */
export function FirstReplyCard({
  conversationId,
  partnerId,
  partnerName,
  partnerIsPerson,
  messages,
  hasOlder,
}: {
  conversationId: string
  partnerId: string
  partnerName: string
  /** Not an official account, and one that can still be written to. */
  partnerIsPerson: boolean
  /** The live thread, newest first, without the sends still in flight. */
  messages: readonly MessageDto[]
  hasOlder: boolean
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const queryClient = useQueryClient()
  const me = useMe()
  const tier = useEffectiveTier()
  const { data: session } = authClient.useSession()
  const viewerId = me.data?._id

  // `null` while the device is asked, so the card never flashes up first.
  const [seen, setSeen] = useState<boolean | null>(null)
  const [shown, setShown] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!viewerId) return
    let live = true
    void readJsonFlag<unknown>(FLAG_KEYS.firstReplyCardShown).then((stored) => {
      if (live) setSeen(shownThisRun.has(viewerId) || firstReplyShownTo(stored, viewerId))
    })
    return () => {
      live = false
    }
  }, [viewerId])

  const answered = useMemo(
    () => (viewerId ? isAnsweredFirstReply({ viewerId, messages, hasOlder }) : false),
    [viewerId, messages, hasOlder],
  )

  const eligible = showsFirstReplyCard({
    viewer: {
      loaded: me.data !== undefined,
      tier,
      guest: shouldGateGuest(session?.user),
    },
    seen,
    partnerIsPerson,
    answeredFirstReply: answered,
    // The chat list's cache, read and never fetched: the card is not worth a
    // request, and a list nobody has loaded leaves it out.
    firstTwoWay: noOtherTwoWayThread(
      conversationId,
      queryClient.getQueryData<InfiniteData<ConversationPageDto>>(keys.conversations('all')),
    ),
  })

  // Spent the moment it is first drawn; it stays up for the rest of this visit.
  useEffect(() => {
    if (!eligible || shown || !viewerId) return
    setShown(true)
    shownThisRun.add(viewerId)
    void rememberShown(viewerId)
  }, [eligible, shown, viewerId])

  // Gone the moment Pro is held — a purchase from this very card included.
  if (!(eligible || shown) || closed || isPaidTier(tier)) return null

  const plan = TIER_NAMES.pro
  const count = PLAN_LIMITS.free.initiationsPer24h ?? 0

  return (
    <View style={styles.card}>
      <View style={[styles.tile, { backgroundColor: v3.hues[partnerHueFor(partnerId)] }]}>
        <Feather name="message-circle" size={v3.icon.md} color={v3.colors.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t('chat.firstReplyTitle', { name: partnerName })}</Text>
        <Text style={styles.text}>{t('chat.firstReplyBody', { count, plan })}</Text>
        <Button
          variant="secondary"
          size="small"
          label={t('settings.upgrade')}
          onPress={() => {
            setClosed(true)
            openPaywall(undefined, `/(app)/chat/${conversationId}`, 'first_reply')
          }}
          style={styles.button}
        />
      </View>
      <IconButton
        icon="x"
        iconSize={v3.icon.md}
        color={v3.colors.muted}
        accessibilityLabel={t('common.close')}
        onPress={() => setClosed(true)}
        style={styles.close}
      />
    </View>
  )
}

const TILE = 40

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    alignItems: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    flexDirection: 'row',
    gap: v3.space[12],
    marginVertical: v3.space[12],
    paddingStart: v3.space[14],
    paddingVertical: v3.space[14],
  },
  tile: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: TILE,
    justifyContent: 'center',
    width: TILE,
  },
  body: { flex: 1, gap: v3.space[4] },
  title: { ...v3.type.button, color: v3.colors.fg },
  text: { ...v3.type.caption, color: v3.colors.muted },
  button: { alignSelf: 'flex-start', marginTop: v3.space[8], width: 'auto' },
  // The glyph sits in the card's corner; its target keeps the platform minimum.
  close: { marginTop: -v3.space[10] },
}))
