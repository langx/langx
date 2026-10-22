/**
 * The words a display name can be found by, and the same treatment applied to
 * whatever somebody types into the search box.
 *
 * Stored on the profile as `nameTokens` rather than worked out per query,
 * because the alternative is a case-insensitive regex over `displayName`,
 * which no index can serve: a search box would become a collection scan per
 * keystroke, which is the exact failure `handleSearch` anchors its handle
 * regex to avoid. A multikey index over these tokens makes "find Lovelace"
 * an index scan, not a scan of everybody.
 *
 * Both sides of the comparison go through this function, so what it does to a
 * name matters far less than that it does the same thing twice. Three rules:
 *
 *   - **Case folds.** `toLowerCase()` first, so `İlker` loses its dot the way
 *     the searcher's `İ` does.
 *   - **Turkish `ı` folds to `i`.** `toLowerCase()` turns `I` into `i`, not
 *     the `ı` Turkish writes, so without this `Işık`, `IŞIK` and `ışık` were
 *     three different tokens and none was reachable from an ASCII `isik`.
 *   - **Latin accents fold, kana voicing does not.** U+0300–U+036F is
 *     stripped — the combining block Latin, Greek and Cyrillic marks live in.
 *     Stripping *every* mark would also take U+3099, and `が` would be stored
 *     as `か`: a Japanese name silently rewritten into a different one.
 *   - **Arabic marks fold too** — the harakat, shadda, and the hamza and
 *     madda that `أ`, `إ` and `آ` decompose into (U+064B–U+065F, U+0670).
 *     Those are left off far more often than not when a name is typed, so
 *     `أحمد` and `احمد` are one name; kept, they also split a vowelled word
 *     into single letters at the break rule below.
 *   - **Everything that is not a letter or a digit is a break.** `Ada-Lovelace`,
 *     `ada_lovelace` and `Ada 🌸 Lovelace` all give the same two tokens. A
 *     script that does not space its words — Chinese, Japanese — gives one
 *     token per run, so it is findable from its start and not from its middle.
 *     That is the same deal handles get.
 */
export function nameTokens(value: string): string[] {
  const folded = value
    .toLowerCase()
    // After the lower-case, so `I` has already become `i`: the dotless `ı`
    // is a letter of its own, not a mark, and the strip below never sees it.
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .normalize('NFC')
  // A Set because a repeated word — "Ali Ali" — is one index entry, not two.
  return [...new Set(folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean))]
}
