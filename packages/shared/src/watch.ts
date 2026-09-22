import { z } from 'zod'

/**
 * What the phone tells the Apple Watch.
 *
 * The watch app is **dependent**: no session, no network call, no credential
 * of its own. It renders this blob and sends replies back through the phone.
 * That decision is in `docs/plans/iphone-watch-and-carplay.md` → _Surface B_,
 * and the shape below follows from it rather than from what a watch screen
 * happens to need today.
 *
 * Three things are worth knowing before changing it.
 *
 * **This is not the companion snapshot.** `companionSnapshotSchema` is read by
 * extensions on the *phone*, out of a shared App Group container. An App Group
 * is a container on one device; the watch is a different device and cannot see
 * it at all. Everything here travels over WatchConnectivity, which is why the
 * two schemas stay separate even where they overlap.
 *
 * **The whole thread comes with the list.** A dependent watch app that fetched
 * a thread when you tapped it would show a spinner every time, and would show
 * nothing at all when the phone is in another room — the state this design
 * accepts. So one push carries the recent conversations *and* the tail of each
 * one, and tapping is instant or honest.
 *
 * **No words travel.** The widgets are handed their three labels already
 * translated because they draw them beside numbers the app computed. The watch
 * draws its own chrome — a title, an empty state, a Reply button — and gets it
 * from `targets/_shared/Localizable.xcstrings`, which the generator fills from
 * the same eight catalogues. Only content is in this blob: names, and what
 * people actually wrote.
 */
export const WATCH_PAYLOAD_VERSION = 1

/**
 * How much of a thread travels.
 *
 * `updateApplicationContext` replaces one dictionary of a few hundred
 * kilobytes; these two caps keep a busy account's payload far under that
 * without a size check that would silently drop the last conversation. Ten
 * threads is more than a wrist scrolls, and ten messages is enough to answer
 * "what were we talking about" without being a history screen.
 */
export const WATCH_MAX_CONVERSATIONS = 10
export const WATCH_MAX_MESSAGES_PER_CONVERSATION = 10

export const watchMessageSchema = z.object({
  id: z.string(),
  /**
   * Plain text only. A photo, a sticker, a meeting card and a quiz all reach
   * the watch as the same one-line summary the conversation list already
   * shows, because the alternative is a watch that renders five message types
   * badly. `previewFor` on the API side is where those words come from.
   */
  body: z.string(),
  /** Whose it is, so the thread can be read without names on every row. */
  mine: z.boolean(),
  at: z.string().datetime(),
})

export const watchConversationSchema = z.object({
  id: z.string(),
  /** The other person's display name, as the chat list shows it. */
  name: z.string(),
  unread: z.number().int().nonnegative(),
  /** Oldest first, so the thread reads downwards like the phone's. */
  messages: z.array(watchMessageSchema).max(WATCH_MAX_MESSAGES_PER_CONVERSATION),
})

export const watchPayloadSchema = z.object({
  /**
   * Bumped when a field changes meaning. A watch app is updated with the
   * phone app, but not at the same moment — watchOS installs on its own
   * schedule — so an older watch can be handed a newer blob. It treats a
   * version it does not know as no blob at all and says the phone is not
   * reachable, which is wrong in detail and right in effect: do not trust
   * what is on the screen, go and look at the phone.
   */
  version: z.literal(WATCH_PAYLOAD_VERSION),
  writtenAt: z.string().datetime(),
  /**
   * The chat list, most recent first — not only the unread ones. The wrist
   * shows what the phone shows, because a watch that could only answer people
   * already waiting on you cannot start a conversation; each row carries its
   * own `unread`, which is what the dot, the tile and the complication count.
   *
   * Empty is a real answer and means the watch draws "no chats yet" — it is
   * not the same as having no payload, which means the phone has not spoken
   * yet.
   */
  conversations: z.array(watchConversationSchema).max(WATCH_MAX_CONVERSATIONS),
  /**
   * The streak, for the complication.
   *
   * Optional, and it has to stay optional: watchOS installs the watch app on
   * its own schedule, so a watch running the build before this one will be
   * handed a payload carrying it and a watch running this build can be handed
   * one without. Neither is an error — the complication falls back to the
   * unread count, which every payload has.
   *
   * A number rather than the whole streak object the companion snapshot
   * carries. The complication draws one glyph on a watch face; `longest` and
   * `lastQualifiedDay` answer questions nobody asks at that size, and a field
   * that travels every time the unread count changes should be as small as
   * what it says.
   */
  streak: z.number().int().nonnegative().optional(),
})

export type WatchMessage = z.infer<typeof watchMessageSchema>
export type WatchConversation = z.infer<typeof watchConversationSchema>
export type WatchPayload = z.infer<typeof watchPayloadSchema>

/**
 * What the watch sends back.
 *
 * `clientId` is not optional here, unlike on the socket. A watch reply whose
 * reply-handler never arrives is indistinguishable from one that was never
 * delivered, and the phone retries — so the id that makes the retry safe has
 * to be minted on the wrist, before the first attempt, and reused.
 */
export const watchReplySchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().trim().min(1),
  clientId: z.string().min(1),
})

export type WatchReply = z.infer<typeof watchReplySchema>
