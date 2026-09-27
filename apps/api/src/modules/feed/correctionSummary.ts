import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { PostCorrectionDoc } from './documents'

/*
 * Its own file so that `pronunciation.ts` can read it without importing
 * `feed.ts`, which imports that file back for `readAnswerSummary` — the same
 * reason `documents.ts` is its own file. `feed.ts` re-exports it, so nothing
 * that already imported it from there had to change.
 */

/**
 * The one correction each card shows, and whether the viewer has already
 * answered — without reading the rest.
 *
 * The obvious version fetches every correction for the page and picks the first
 * of each in JS. That is fine for a post with two answers and quadratic-feeling
 * for one with three hundred: a single popular post makes every request that
 * happens to include it transfer its whole correction list to compute two
 * booleans' worth of output.
 *
 * `$group`/`$first` after an index-backed `$sort` returns one document per
 * post, so what crosses the wire is O(posts) rather than O(corrections). The
 * viewer lookup is a separate targeted query on `post_author_unique` rather
 * than a second pass over the same documents — it reads at most one row per
 * post by definition, since that index is unique.
 */
export async function readCorrectionSummary(
  db: Db,
  userId: string,
  ids: ObjectId[],
): Promise<{ topByPost: Map<string, PostCorrectionDoc>; viewerCorrected: Set<string> }> {
  if (ids.length === 0) return { topByPost: new Map(), viewerCorrected: new Set() }

  const corrections = db.collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
  const [tops, mine] = await Promise.all([
    corrections
      .aggregate<{ _id: ObjectId; top: PostCorrectionDoc }>([
        { $match: { postId: { $in: ids } } },
        // Matches `post_created` ({ postId: 1, createdAt: 1 }), so the sort is
        // a scan of the index rather than an in-memory sort of the documents.
        { $sort: { postId: 1, createdAt: 1 } },
        { $group: { _id: '$postId', top: { $first: '$$ROOT' } } },
      ])
      .toArray(),
    corrections
      .find({ postId: { $in: ids }, authorId: userId })
      .project<{ postId: ObjectId }>({ postId: 1 })
      .toArray(),
  ])

  return {
    topByPost: new Map(tops.map((row) => [row._id.toHexString(), row.top])),
    viewerCorrected: new Set(mine.map((row) => row.postId.toHexString())),
  }
}
