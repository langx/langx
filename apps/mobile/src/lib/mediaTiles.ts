import { attachmentsOf, type Media } from '@langx/shared'
import type { MessageDto } from '../api/queries'
import { dedupeById } from './dedupeById'

/**
 * One tile of a conversation's media grid is one attachment, not one message.
 *
 * A message carries up to `MAX_ATTACHMENTS` files and its `type` is the kind
 * of the *first* one — so a `type: 'image'` message can hold a video and the
 * reverse. Flattening here is what makes the grid draw all six of a gallery
 * rather than one square per send, and it lets each tile ask
 * `isVideoContentType` about its own file. Both looks of `chat-media.tsx`
 * read this, so the two grids cannot disagree about what a tile is.
 */
export interface MediaTile {
  /** `${messageId}:${index}` — one string for `keyExtractor` and `dedupeById`. */
  _id: string
  media: Media
  senderId: string
  createdAt: string
}

export function tilesOf(messages: MessageDto[]): MediaTile[] {
  return dedupeById(
    messages.flatMap((message) =>
      // Always through `attachmentsOf`: a v1-imported message carries `media`
      // and no `attachments`, and the two have to look the same here.
      attachmentsOf(message).map((media, index) => ({
        _id: `${message._id}:${index}`,
        media,
        senderId: message.senderId,
        createdAt: message.createdAt,
      })),
    ),
  )
}
