import {
  COMPANION_DIRECTORY_LIMIT,
  COMPANION_DIRECTORY_VERSION,
  type CompanionDirectory,
} from '@langx/shared'

interface DirectoryInput {
  /** The viewer, so the other participant can be picked out of each pair. */
  meId: string
  /** The conversation list as the app already holds it, most recent first. */
  conversations: readonly {
    _id: string
    participants: readonly string[]
    unread: number
    updatedAt: Date | string
    /** Already a one-line summary when it arrives; see the schema. */
    lastMessage?: { body: string } | undefined
  }[]
  /** Display names by profile id, from the cache the chat list already fills. */
  names: Readonly<Record<string, string | undefined>>
  /**
   * "3 new", in the reader's language and with its own plural rule.
   *
   * Passed in rather than imported, so this file stays loadable by a test
   * that has no i18n context — and so the one copy of the rule that a count
   * takes a plural entry stays in the catalogues. Called only for a
   * conversation that has something waiting.
   */
  unreadLabel: (count: number) => string
  now?: Date
}

/**
 * The people an App Intent may be asked to open a conversation with.
 *
 * Pure, and in `src/lib` rather than in the hook, for the reason every other
 * builder here gives: `vitest.config.ts` sees this directory and nothing that
 * imports `react-native`, so the rules below can be held still by a test.
 *
 * Three of them, and each is a decision rather than a detail:
 *
 * - **A conversation with no name is dropped**, not carried as "Unknown". An
 *   entry Siri cannot say is an entry nobody can ask for, and it would sit in
 *   the picker in the Shortcuts app looking like a bug. The profile cache
 *   fills in behind this, so a name that is missing now is usually present on
 *   the next write.
 * - **Duplicate names are dropped too**, keeping the first — which is the most
 *   recent conversation, because the list arrives in that order. Two people
 *   called Maria are a question Siri has no way to ask and would resolve by
 *   guessing; the more recent thread is the better guess to have made.
 * - **The order is the list's own**, so the cap keeps the conversations
 *   somebody is actually in rather than an arbitrary twenty.
 *
 * Since 22 September each entry also carries what a CarPlay row draws and
 * reads aloud — the unread count, that count as a phrase, when the thread
 * last moved, and the chat list's own one-line preview. An App Intent ignores
 * all four; see `companionDirectorySchema` for why they are in this blob
 * rather than in a second one.
 */
function iso(at: Date | string): string {
  return typeof at === 'string' ? new Date(at).toISOString() : at.toISOString()
}

export function buildCompanionDirectory({
  meId,
  conversations,
  names,
  unreadLabel,
  now = new Date(),
}: DirectoryInput): CompanionDirectory {
  const seen = new Set<string>()
  const entries: CompanionDirectory['conversations'] = []

  for (const conversation of conversations) {
    if (entries.length >= COMPANION_DIRECTORY_LIMIT) break
    const other = conversation.participants.find((participant) => participant !== meId)
    const name = other === undefined ? undefined : names[other]
    if (name === undefined || name.length === 0) continue
    const key = name.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      id: conversation._id,
      name,
      unread: conversation.unread,
      ...(conversation.unread > 0 ? { unreadLabel: unreadLabel(conversation.unread) } : {}),
      at: iso(conversation.updatedAt),
      ...(conversation.lastMessage === undefined ? {} : { preview: conversation.lastMessage.body }),
    })
  }

  return {
    version: COMPANION_DIRECTORY_VERSION,
    writtenAt: now.toISOString(),
    conversations: entries,
  }
}
