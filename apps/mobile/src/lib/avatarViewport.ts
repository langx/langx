import { DEFAULT_AVATAR_GROUNDS, defaultAvatarRev, parseDefaultAvatarRev } from '@langx/shared'

/**
 * Keeps two people on one screen from wearing the identical picture.
 *
 * 48 faces a pool means a list of thirty will often show one face twice.
 * The face is fine — they are different people who drew the same lot — but
 * the same face on the same ground reads as the same person. So a repeat is
 * moved to a ground nobody else on the list wears that face on. Only the
 * ground changes, and only on this screen: the server's assignment, and the
 * face's look everywhere else, stay as they are.
 *
 * Takes the list as it will be drawn and returns it with `defaultAvatarRev`
 * rewritten where needed. Rows that do not change are the same objects, so a
 * memoised row does not redraw for nothing.
 */
export function dedupeGrounds<T extends { _id: string; defaultAvatarRev?: string | undefined }>(
  rows: readonly T[],
): T[] {
  const faces = rows.map((row) =>
    row.defaultAvatarRev ? parseDefaultAvatarRev(row.defaultAvatarRev) : null,
  )
  // pool+index → ground → who holds it. The first holder of every ground is
  // recorded before anything moves, so a repeat never pushes somebody else
  // off a ground they had by right and only the repeats change.
  const taken = new Map<string, Map<number, string>>()
  faces.forEach((face, i) => {
    const id = rows[i]?._id
    if (!face || id === undefined) return
    const key = `${face.pool}${face.index}`
    const grounds = taken.get(key) ?? new Map<number, string>()
    taken.set(key, grounds)
    if (!grounds.has(face.ground)) grounds.set(face.ground, id)
  })
  return rows.map((row, i) => {
    const face = faces[i]
    if (!face) return row
    const grounds = taken.get(`${face.pool}${face.index}`)
    if (!grounds || grounds.get(face.ground) === row._id) return row
    for (let step = 1; step < DEFAULT_AVATAR_GROUNDS.length; step++) {
      const ground = (face.ground + step) % DEFAULT_AVATAR_GROUNDS.length
      if (!grounds.has(ground)) {
        grounds.set(ground, row._id)
        return { ...row, defaultAvatarRev: defaultAvatarRev({ ...face, ground }) }
      }
    }
    // Seven people on one face: the seventh keeps theirs.
    return row
  })
}
