/**
 * Keeps neighbours from opening with the same word.
 *
 * A pack is handed out in `index` order, ten at a time, so what a learner
 * meets in one session is a window on this list. The first draft of the
 * English packs had thirty consecutive sentences beginning "Are you", which
 * reads as one question asked thirty ways rather than as thirty phrases —
 * PR #1375 broke every such adjacency by hand. This is that pass, written
 * down, so the next language does not need it done again.
 *
 * Greedy and stable: it takes the first item whose key differs from the one
 * just placed, so an item only moves as far forward as it has to and the
 * difficulty order underneath survives. Where nothing differs — the tail of a
 * list that is all one opening word — it takes the next one anyway rather
 * than reordering the whole thing to avoid a single repeat.
 */
export function spread(items, keyOf) {
  const out = []
  const rest = [...items]
  while (rest.length > 0) {
    const last = out.length > 0 ? keyOf(out[out.length - 1]) : null
    const next = rest.findIndex((item) => keyOf(item) !== last)
    out.push(rest.splice(next < 0 ? 0 : next, 1)[0])
  }

  /*
   * And then the tail, which greedy alone cannot fix. Forty-nine of the two
   * hundred and fifty-five Russian `absoluteBeginner` phrases open with "Я",
   * so by the end there is nothing left to put between two of them. Each
   * survivor moves back to the **nearest** legal slot rather than the first
   * one, because the order it is moving out of is difficulty and a phrase
   * that jumps a hundred places to avoid a repeat has traded one defect for
   * a worse one.
   */
  for (let k = 1; k < out.length; k += 1) {
    if (keyOf(out[k]) !== keyOf(out[k - 1])) continue
    const moved = out[k]
    const key = keyOf(moved)
    // Taking it out must not leave its neighbours touching either.
    if (k + 1 < out.length && keyOf(out[k - 1]) === keyOf(out[k + 1])) continue
    for (let j = k - 1; j > 0; j -= 1) {
      if (keyOf(out[j - 1]) === key || keyOf(out[j]) === key) continue
      out.splice(k, 1)
      out.splice(j, 0, moved)
      break
    }
  }
  return out
}

/** The word a phrase opens with, for `spread`. Case and punctuation are not it. */
export function opening(phrase) {
  return phrase.toLowerCase().match(/[\p{L}']+/u)?.[0] ?? phrase.toLowerCase()
}
