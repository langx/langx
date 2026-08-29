import { z } from 'zod'

/**
 * Following somebody, which is the relationship this app did not have.
 *
 * The feed's "Following" tab shipped without one, standing in the people you
 * had talked to — the only relationship there was. This is the real thing, and
 * it does not replace the stand-in: the tab reads both, because a conversation
 * partner is somebody you are following in every sense except the button.
 *
 * A follow is one-directional and needs no consent. It is not a match gate:
 * it grants no access, opens no channel and pays nothing. All it does is
 * decide what a feed tab contains.
 */
export const followStateSchema = z.object({
  followers: z.number().int().nonnegative(),
  following: z.number().int().nonnegative(),
  viewerFollows: z.boolean(),
})
export type FollowState = z.infer<typeof followStateSchema>

export const FOLLOW_PAGE_SIZE_DEFAULT = 30
export const FOLLOW_PAGE_SIZE_MAX = 100

export const listFollowsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(FOLLOW_PAGE_SIZE_MAX).default(FOLLOW_PAGE_SIZE_DEFAULT),
})
export type ListFollowsQuery = z.infer<typeof listFollowsQuerySchema>
