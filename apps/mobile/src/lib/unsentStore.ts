import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from './localFlags'
import { storeUnsent, type UnsentByConversation, type UnsentMessage } from './unsentMessages'

/**
 * Where the "not sent" rows live between one opening of a chat and the next.
 *
 * They used to live in React state and nowhere else, so the sentence somebody
 * typed in a tunnel survived exactly as long as the screen did: going back to
 * the list to see whether anything else had arrived threw it away. The row is
 * the only copy of that sentence there is — the composer is empty by then —
 * which makes losing it the worst outcome in this whole area.
 *
 * Best-effort by design, not a queue. `localFlags` swallows a failed write, so
 * the promise here is "kept where possible": a device that cannot store it is
 * left exactly where it was before any of this, with a row that lives as long
 * as the screen. Retrying is safe whatever survives — the server refuses a
 * second message with the same `(senderId, clientId)` by unique index.
 *
 * Split from `unsentMessages.ts` so that module stays free of `react-native`
 * and inside what the mobile test setup can load; the shape-keeping is there
 * and tested, the device is here.
 */
export async function loadUnsent(conversationId: string): Promise<UnsentMessage[]> {
  const stored = await readJsonFlag<UnsentByConversation>(FLAG_KEYS.unsentMessages)
  const rows = stored?.[conversationId]
  return Array.isArray(rows) ? rows : []
}

export async function saveUnsent(
  conversationId: string,
  list: readonly UnsentMessage[],
): Promise<void> {
  const stored = (await readJsonFlag<UnsentByConversation>(FLAG_KEYS.unsentMessages)) ?? {}
  await writeJsonFlag(FLAG_KEYS.unsentMessages, storeUnsent(stored, conversationId, list))
}
