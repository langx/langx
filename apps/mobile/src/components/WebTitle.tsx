import { usePathname } from 'expo-router'
import Head from 'expo-router/head'
import { Platform } from 'react-native'
import { useUnreadTotal } from '../api/queries'
import { useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import { documentTitle, pageTitleKey } from '../lib/documentTitle'
import { shouldGateGuest } from '../lib/guestGate'

/**
 * The browser tab's title: the page, and how many messages are waiting.
 *
 * Mounted once at the root with no `page`, where it names the page from the
 * path. A screen whose name is a person — a thread, a profile — mounts a
 * second one with `page` while it is focused; the head manager lets the one
 * mounted later win, and gives the title back when it unmounts.
 *
 * Web only. On iOS a `<title>` in `Head` publishes an NSUserActivity for
 * Handoff and Spotlight, which is a different feature from a label on a tab.
 */
export function WebTitle({ page }: { page?: string }) {
  if (Platform.OS !== 'web') return null
  return <WebTitleHead {...(page !== undefined ? { page } : {})} />
}

function WebTitleHead({ page }: { page?: string }) {
  const t = useT()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  /*
   * The same query and the same guest gate as the Chats tab's badge, so the
   * tab title and the badge are one number: whatever moves one moves both.
   * A guest has no conversations, and asking would 401 rather than say zero.
   */
  const unread = useUnreadTotal(Boolean(session) && !shouldGateGuest(session?.user))
  const key = pageTitleKey(pathname)
  const name = page ?? (key ? t(key) : undefined)
  return (
    <Head>
      <title>{documentTitle(name, session ? unread.data : undefined)}</title>
    </Head>
  )
}
