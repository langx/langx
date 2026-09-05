# More shareable things in the app

## Context

Behic asked for "more shareable things in the app". Today only two things can be
shared out of LangX v2: your own profile link (`share-profile.tsx`) and your
invite link (`invite.tsx`). Every other object — another person's profile, a
feed post, a streak, a leaderboard rank, a badge, a chat message — has no share
affordance at all.

Constraints that shape the design (from `langx/docs/architecture.md`,
`sharedProfile.ts`, `token-messaging-brief.md`):

- The public profile card is **the only unauthenticated read** and deliberately
  hides streak/tokens/tier. No new public endpoints.
- No image/card export: `react-native-view-shot` is a native dep (new binary,
  no OTA) — same reason the QR is drawn server-side.
- Token amounts are never bragged about ("say it as an achievement, never as
  money"). Share text carries achievements, not balances.
- Universal links don't open the app yet (`APP_LINK_HOST` ≠ `WEB_HOST`); OG
  unfurls don't exist. Both out of scope. A post link needs sign-in on the web;
  accepted.

So: **every share is a sentence plus a link through the platform share sheet.**
Achievement shares (streak, rank, badge) use `inviteUrl(handle)` so a brag
doubles as a referral.

Work happens in the worktree `/root/wt-shareables` (branch `feat/shareables`
from `origin/main`, already created). Needs its own `pnpm install`.

## What becomes shareable

| Object                | Where                                              | Link                 |
| --------------------- | -------------------------------------------------- | -------------------- |
| Someone else's profile | kebab menu on `profile/[handle].tsx`               | `profileUrl(handle)` |
| Feed post             | feed row action strip + post detail header/strip   | new `postUrl(id)`    |
| Streak                | button under the tiles on `streak.tsx` (count > 0) | `inviteUrl(me)`      |
| Leaderboard rank      | `leaderboard.tsx` when `viewer.rank` is set        | `inviteUrl(me)`      |
| Earned badge          | earned rows in `BadgeGrid` become pressable        | `inviteUrl(me)`      |
| Chat message text     | `share` action on the long-press menu ("more")     | none, text only      |

## Steps

1. **`packages/shared/src/appIdentity.ts`** — add `postUrl(id)` →
   `https://${WEB_HOST}/post/${encodeURIComponent(id)}` beside `profileUrl`.
   `'post'` is already in `ROUTE_RESERVED`. New `appIdentity.test.ts` (pattern:
   `referral.test.ts`): host, path, and `RESERVED_HANDLES.has('post')`.

2. **`apps/mobile/src/lib/shareText.ts`** (new, pure — vitest cannot load RN):
   `SHARE_EXCERPT_LENGTH = 140`, `postExcerpt(body)` (collapse whitespace, cut
   at a word boundary, `…`, no-op under the limit), `isShareCancel(error)`
   (`name === 'AbortError'`), and builders returning `{ message, url? }` that
   take `t: TranslateFn`: `profileShareText`, `postShareText`,
   `streakShareText` (plural), `leaderboardShareText` (one full sentence per
   `PeriodType` — `periodLabel` yields "This week", which cannot be inflected
   inside another sentence), `badgeShareText`.

3. **`apps/mobile/src/lib/share.ts`** (new, thin, untested): `shareLink({
   message, url? })` wraps `Share.share` (url in both fields — keep the
   iOS/Android comment from `share-profile.tsx:72`). On rejection: cancel →
   silent; anything else (react-native-web rejects "Share is not supported"
   when `navigator.share` is missing) → `Clipboard.setStringAsync(url ??
   message)` + `showToast(currentTranslate()('share.copied'))`.

4. **Refactor** `share-profile.tsx` and `invite.tsx` to `shareLink`.

5. **`profile/[handle].tsx`** — add `{ label: t('share.profile'), value:
   'share' }` first in `openActions()`'s `chooseAlert`; handle it; extend the
   kebab `accessibilityLabel`; reword the comment at ~176 that says the menu is
   a shortcut to "the same two actions the footer offers".

6. **Posts** — `post/[id].tsx`: `ScreenHeader trailing` share icon (`Feather
   name="share"`, needs `Feather` + `useTheme` imports) and a share Pressable in
   the `likeRow` (~333). `feed.tsx` (~440-477): same Pressable after the comment
   one, before the owner-only delete. Text uses `names.language(post.language)`
   already in scope.

7. **`streak.tsx`** — import `useMe`, `Button`; secondary button
   `t('share.streak')` when `streak.current > 0 && me.data`.

8. **`leaderboard.tsx`** — import `useMe`; a `t('share.rank')` affordance when
   `viewer?.rank && me.data` (independent of `inPage`); pass `onShare` to
   `BadgeGrid`.

9. **`BadgeGrid.tsx`** — optional `onShare?: (badge, label) => void`; earned
   rows wrap in `Pressable` only when `badge.earned && onShare`, a11y label
   `t('share.badge', { label })`; locked rows unchanged (comment why).

10. **Message menu** — `messageActions.ts`: add `'share'` to
    `MESSAGE_ACTION_IDS`, row on page `'more'` when `hasBody`, icon
    `share-outline`, after `pin`, before `report`. `chat/[id].tsx`: next to
    `copy`, `await shareLink({ message: message.body })`. Update
    `messageActions.test.ts` (full list, "more" page order, captionless voice
    note has no share).

11. **i18n** — `en.ts`: `messageActions.share`, and a new `share:` group after
    `shareProfile`: `copied`, `profile`, `profileMessage {name,url}`, `post`,
    `postMessage {excerpt,language,url}`, `streak`, `streakMessage {one,other}
    {count,url}`, `rank`, `leaderboardMessage {week,month,year,all} {rank,url}`,
    `badge {label}`, `badgeMessage {label,url}`. Same keys in `tr, es, ru, ar,
    fr, de, pt-BR` with each locale's plural categories (copy the shape of
    `badges.streakDays` in that file). `catalogs.test.ts` enforces identical
    keys and placeholders. No token amounts anywhere.

12. **Tests** — `shareText.test.ts` with `createTranslate('en')`: excerpt
    rules, each builder's message contains its url, profile uses `profileUrl`,
    achievements carry `?invite=1`, leaderboard resolves for every
    `PERIOD_TYPES` value, `isShareCancel`, and no output matches `/token/i`.

13. **Docs** — `docs/architecture.md`: `### What can be shared` after the
    `WEB_HOST` paragraph (~733), before `### Community feed`. `docs/decisions.md`:
    append `## Sharing is a sentence and a link, not a card` (no view-shot, no
    new public reads, invite link on achievements, no token counts, post links
    need a session until universal links land).

Website/GitBook untouched: no limit or token rule changes.

## Verification

```bash
cd /root/wt-shareables && pnpm install
pnpm test && pnpm -r typecheck && pnpm lint && pnpm format:check
```

Then a quick manual pass on Expo web (`pnpm dev`, Playwright against :8081 per
the droplet notes): open a post → share icon copies the link on desktop
Firefox-style browsers (no `navigator.share`) and shows the toast; streak and
rank buttons appear only when there is something to share; chat long-press →
More… shows Share. Finish with a commit on `feat/shareables` and a PR against
`langx/langx` main (rebase convention).
