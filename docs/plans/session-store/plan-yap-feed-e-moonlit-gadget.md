# Feed: a working social layer + media groundwork

## Context

The community feed (`posts` / `postCorrections`, `/feed`, `apps/mobile/app/(app)/feed.tsx`) ships
but does not work as a feed. Today a card shows one correction and a corrector's name as plain
text; there is nothing to tap, nothing to like, no way to see the other corrections, and the
"Following" tab is a stand-in that reads conversation partners because no follow graph exists.
Three counting bugs make it look broken even where it isn't.

Behic asked for: tappable correctors → profiles; likes on feed content with a visible count that
opens a list of likers; a real Follow button so "Following" means something; the correction counts
made functional; and photo/voice upload wired end to end on the feed.

Decisions already taken by Behic:

- **Following = (people you follow) ∪ (people you have talked to).** The conversation stand-in
  stays; the follow graph is added on top.
- **Likes on both posts and corrections**, one `likes` collection with a
  `targetType: 'post' | 'correction'` discriminator.
- **Both broken counters get fixed** — the feed pill and the profile "corrections" tile.
- **Media: full pipeline and composer UI now**, reusing the chat picker and recorder.

Three problems found during exploration that were not in the ask but sit directly in the blast
radius, and are fixed here:

- `apps/api/src/modules/account/deletion.ts:184-207` (purge) and `:226-236` (GDPR export) enumerate
  collections by hand. `follows` and `likes` must be added to **both**, or a deleted account lingers
  in other people's follower lists.
- `listPostCorrections` (`apps/api/src/modules/feed/feed.ts:369`) never receives a viewer id, so it
  has **no block filter**. A live symmetry hole, invisible only because nothing calls the route yet.
- `postCorrections.post_created` is `{postId, createdAt}` with no `_id`, so the ascending keyset the
  detail screen needs would fall back to an in-memory sort.

---

## 1. Correction counts — three bugs

### 1.1 The `following` cursor always 400s

`encodeDateIdCursor` (`apps/api/src/lib/dateIdCursor.ts:12`) emits `"<iso>|<hex>"`, and an ISO
string always contains a dot (`.sssZ`). `decodeFeedCursor` (`modules/feed/feed.ts:242-248`) treats
the **first** dot as the count separator, so `indexOf('.')` finds the milliseconds at index 19, the
`dot === -1` fast path is unreachable, and `Number("2026-08-29T17:50:49")` is `NaN` →
`VALIDATION_FAILED`. `needsCorrection` survives only because its `"3."` prefix puts a dot at index 1.
**Every `following` page-two request is a 400.**

Move `encodeFeedCursor` / `decodeFeedCursor` out of the repository into a new pure
`apps/api/src/lib/feedCursor.ts` (they touch no `Db`), and match by shape, not position:

```ts
const match = /^(\d+)\./.exec(cursor)
if (!match) return { ...decodeDateIdCursor(cursor), count: null }
return { ...decodeDateIdCursor(cursor.slice(match[0].length)), count: Number(match[1]) }
```

`\d+\.` cannot match an ISO string (its fifth character is `-`), and any cursor already in a
client's hand still decodes.

### 1.2 The corrected post vanishes instead of flipping to "1 correction"

`needsCorrection` sorts `correctionCount` **ascending**, so correcting a post sorts it behind every
uncorrected post in the collection — and `useCorrectPost` invalidates the whole `['feed']` prefix
(`apps/mobile/src/api/queries.ts:437`), forcing exactly that refetch. The card disappears.

**Do not change the sort.** `packages/shared/src/feed.ts:20-25` states it is the reason the feed has
tabs: putting the uncorrected ones first is what makes the queue drain.

Fix in the client cache, in a new **pure** `apps/mobile/src/lib/feedCache.ts` — pure because mobile
vitest cannot import `react-native`. Follows the existing `conversationCache.ts` / `messageCache.ts`
precedent already imported at `queries.ts:34-35`:

```ts
applyCorrection(pages, postId, correction)   // ++count, correctedByViewer = true,
                                             // fill topCorrection ONLY when null (it is the oldest)
applyLike(pages, targetType, targetId, state)
```

Both return the identical array reference when nothing matched, so React Query does not re-render
every card. Then `useCorrectPost.onSuccess` uses `setQueriesData` on the `['feed']` **prefix** (reaches
both cached filters at once — the `keys.messagesAround` idiom, `queries.ts:47-51`) instead of
invalidating. The `keys.tokens` / `keys.badges` invalidations stay; those are correct.

### 1.3 The profile "corrections" tile is stuck at 0 for frozen users

`countCorrections` (`modules/tokens/ledger.ts:168-172`) counts `tokenLedger` rows of kind
`correction`; `awardTokens` writes **no row** when `amount <= 0` (`:87`) and both correction paths
pass `amount: frozen ? 0 : …` (`feed.ts:356`, `awards.ts:73`). A frozen user's `me.tsx` tile and
their correction badges stay 0 forever.

Rejected: writing a zero-amount ledger row. "`amount <= 0` writes nothing at all" is a stated
invariant, and breaking it would also start counting capped-out message awards.

**Count the acts, not the awards** — rename to `countCorrectionsWritten` and read:

```ts
Promise.all([
  db.collection(COLLECTIONS.postCorrections).countDocuments({ authorId: userId }),
  db.collection(COLLECTIONS.messages).countDocuments({ senderId: userId, type: 'correction' }),
])
```

Two indexes in `apps/api/src/db/indexes.ts` — `post_author_unique` is `{postId, authorId}` (wrong
prefix) and `sender_created` has no `type`:

```ts
postCorrections: { key: { authorId: 1, createdAt: -1 }, name: 'author_recent' }
messages:        { key: { senderId: 1, type: 1 },       name: 'sender_type' }
```

**This changes the number for nobody except frozen users.** Corrections are uncapped on all tiers
(`modules/tokens/awards.ts:65-77`, `PLAN_LIMITS.correctionsPer24h: null`), so awards and acts are
equal by construction otherwise. `countCorrections`' existing doc comment justifies itself with "a
correction past the daily cap" — a case that cannot occur. Delete it and say why.

Consequence to state, not hide: **a frozen user earns correction badges again.** That is the
documented intent — `modules/moderation/blocks.ts:141-146` says freezing "stops the payout only". A
badge is not a payout.

---

## 2. Follow graph

**New collection `follows`** (`{_id, followerId, followeeId, createdAt}`), repository
`apps/api/src/modules/social/follows.ts`, routes `apps/api/src/routes/follows.ts`.

Indexes — put `_id` in the key from the start (`post_created` and `conversation_created` both had to
be widened later under new names; changing a live key is an `IndexOptionsConflict`):

```ts
{ key: { followerId: 1, followeeId: 1 }, name: 'follower_followee_unique', unique: true },
{ key: { followerId: 1, createdAt: -1, _id: -1 }, name: 'follower_recent' },
{ key: { followeeId: 1, createdAt: -1, _id: -1 }, name: 'followee_recent' },
```

**Counts are computed, not denormalized.** The deciding question in this repo is "is it a sort
key?": `posts.correctionCount` is denormalized and its comment says exactly why ("an index cannot
sort on a count it would have to join to find"); `tokenAggregates` is the counter-example ("no
duplicate counter in `profiles`, which would only drift"). Nothing sorts by follower count → two
`countDocuments` on the index prefixes, inside the `Promise.all` that `GET /profiles/:handleOrId`
already runs.

**Counts are block-filtered** (`followerId: { $nin: hidden }`), using the `blockedUserIds` the route
already fetches. An unfiltered count beside a filtered list would show "12 followers" over 11 rows,
which tells the viewer that someone they blocked follows this person — and a blocked user is
*absent*, not forbidden (the same rule that makes their profile a 404, not a 403). Put this in the
doc comment; it is the kind of thing someone "simplifies" back for speed.

Repository rules (in the module, never the handler — that is the whole authorisation story):
self-follow → `VALIDATION_FAILED`; blocked or deleted target → **`NOT_FOUND`**, not `FORBIDDEN`;
`followUser` is idempotent (`insertOne`, catch 11000, treat as success — same shape as `blockUser`,
`blocks.ts:65-77`). **Blocking does not delete follow edges** — every read filters through
`blockedUserIds`, and deleting would make unblocking silently destroy a relationship, the same
reason a block does not delete the conversation.

| Route | Guard | Returns |
| --- | --- | --- |
| `POST /profiles/:userId/follow` | `requireVerifiedEmail` | `FollowState` |
| `DELETE /profiles/:userId/follow` | `requireAuth` | `FollowState` |
| `GET /profiles/:userId/followers` | `requireAuth` | `{items, nextCursor}` |
| `GET /profiles/:userId/following` | `requireAuth` | `{items, nextCursor}` |

`requireVerifiedEmail` on the write (following puts your name on a list a stranger sees — the same
reachability argument the `POST /posts` comment makes), plain `requireAuth` on the undo, so a guard
can never strand you in a list. Both writes return the full state so the client patches
`keys.profile(handle)` with no refetch.

Shared contract in a new `packages/shared/src/social.ts`: `followStateSchema`
(`{followers, following, viewerFollows}`), `listFollowsQuerySchema`, `FOLLOW_PAGE_SIZE_DEFAULT = 30`
/ `_MAX = 100`. Rows reuse `feedAuthorSchema` — `{_id, handle, displayName, avatarUrl?}` is exactly
what a row draws and exactly what `openProfile` needs.

**`toPublicProfile` stays pure and synchronous** (`modules/profiles/profiles.ts:414`). Follow the
`emailVerified` precedent: the route computes, the function receives a **required** (not defaulted)
`follow: FollowState` parameter, so no call site can silently ship zeros. Breaks exactly one caller:
`apps/api/src/routes/login.test.ts:257`.

**UI.** In `app/(app)/profile/[handle].tsx`, under the badges row: a pressable followers/following
count pair, and the button — primary `Follow` / secondary `Following` (tap unfollows immediately, no
confirm; `confirmAlert` is for blocking), `loading` while pending, and **rendered not at all when
`user._id === me.data?._id`** (this screen is reachable for yourself by handle deep link). Optimistic
`onMutate` patch on `keys.profile(handle)`, rollback on error, and invalidate `['feed']` on success —
following someone changes what the Following tab contains.

**New screen `app/(app)/follows.tsx`**, params `?handle=&tab=followers|following&from=`, modelled on
`viewers.tsx` line for line. Register `<Tabs.Screen name="follows" options={FULL_SCREEN} />` in
`app/(app)/_layout.tsx`. Not `profile/[handle]/followers.tsx` — that forces renaming the existing
screen to `index.tsx` for no gain.

### The Following tab becomes a bounded union

`modules/feed/feed.ts:148-171` builds an **unbounded** `$in` from every conversation partner today;
adding follows makes that strictly worse. Add to `packages/shared/src/feed.ts`:

```ts
export const FEED_FOLLOWING_SOURCE_LIMIT = 500
```

Read both sources in one `Promise.all`, each `.sort()`ed by recency and `.limit()`ed
(`follower_recent` for follows; `participants_recent` already exists and backs the conversation
sort, which is new and is what makes the truncation meaningful rather than arbitrary), union them,
drop `hidden`, slice. Say in the comment that above the cap the tab is a *sample* of the graph — a
deliberate trade against a fan-out table we do not need yet.

Rename `feed.knownEmptyTitle` / `knownEmptyBody` → `feed.followingEmptyTitle` / `followingEmptyBody`,
reworded to "people you follow or have talked to".

---

## 3. Likes

**New collection `likes`**, repository `apps/api/src/modules/feed/likes.ts`, routes
`apps/api/src/routes/likes.ts`.

```ts
interface Like { _id: ObjectId; targetType: 'post' | 'correction'; targetId: ObjectId; userId: string; createdAt: Date }
```

```ts
{ key: { targetType: 1, targetId: 1, userId: 1 }, name: 'target_user_unique', unique: true },
{ key: { targetType: 1, targetId: 1, createdAt: -1, _id: -1 }, name: 'target_recent' },
{ key: { userId: 1 }, name: 'user' },   // the purge and the GDPR export need this
```

The counting aggregate rides `target_user_unique`'s `{targetType, targetId}` prefix — no third index.
`targetId: ObjectId` also constrains future target types to ObjectId-keyed collections, which
excludes liking a *profile* — and "no like/match/swipe on a person" is an architecture rule anyway.
Free constraint; take it.

**Counted, not denormalized.** Same test as follows: likes are not a sort key **and must never
become one** — the moment the feed sorts by likes it stops being a correction queue and becomes a
popularity contest, which is precisely what the ascending `correctionCount` sort exists to prevent.
A denormalized counter would also mean the toggle does two writes that can diverge on a crash.

`readLikeSummary(db, userId, { postIds, correctionIds })` in `modules/feed/likes.ts`, deliberately
shaped like `readCorrectionSummary` (`feed.ts:108-141`) and documented the same way: a `$group`
after an index-backed `$match` returns one row per liked target, so what crosses the wire is
O(distinct targets) rather than O(likes); the viewer lookup is a separate targeted query on the
unique index, which reads at most one row per target by definition. One call per page covers each
post **and** its `topCorrection` — that is why the argument takes both id lists. Wired into
`listFeed` and into the paginated `listPostCorrections`.

`feedPostSchema` and `postCorrectionSchema` each gain flat `likeCount` and `likedByViewer`, flat
because the DTO already carries `correctionCount` / `correctedByViewer` flat.

### PUT / DELETE, not a toggle

`reactToMessage` (`modules/chat/mutations.ts:81-107`) is the nearest precedent and its "re-tap
clears" idiom is right there — but copying it would be a bug. **A toggle is not idempotent.** Over a
socket, `emitWithAck` gives a definite answer or a definite failure. Over HTTP, a request whose
*response* is lost gets retried, and a retried toggle silently undoes the like the first attempt
applied — the same class of failure `user_kind_ref_unique` exists to make impossible.

- `PUT /likes` `{targetType, targetId}` → idempotent set (`insertOne`, catch 11000, success).
  `requireVerifiedEmail` (puts your name on a list a stranger sees).
- `DELETE /likes` `{targetType, targetId}` → idempotent clear. `requireAuth`. The client already has
  `apiDelete` with a body (`queries.ts:74`) for exactly this.
- `GET /likes?targetType=&targetId=&cursor=&limit=` → the likers page, block-filtered.

Both writes return `likeStateSchema` so the client patches without a refetch.

Access control, inside the repository, in order: resolve the target (`NOT_FOUND` on a bad ObjectId or
missing doc) → check its author against `blockedUserIds` → **`NOT_FOUND`** (the step an obvious
implementation skips, and without it a stale feed page is a working "like a blocked person's post"
button) → for a correction, check the **parent post's** author too → self-like `VALIDATION_FAILED`
(a like pays nothing, so this is only about keeping the number meaningful).

**A like pays nothing, and that is a test.** No `awardTokens`, no `dailyActivity` counter, no streak
advance. The comment, adapted from `reactToMessage`: a like costs one tap, and anything that pays
for one tap is a farm — worse than a reaction, because two accounts liking each other is a
*reciprocal* farm, the exact shape the reciprocity bonus was designed against. Pin it mirroring
`apps/api/src/routes/messages.test.ts:674`.

**The count and the list can disagree, on purpose.** The card's `likeCount` is not block-filtered
(making a page-wide aggregate viewer-dependent buys nothing) while the likers list is. So a card can
say "12 likes" over 11 rows. Mitigation: the likers screen renders **its own** row count in the
header, not the number from the card. Followers get the opposite answer to likers because followers
are few and likers are many; document the asymmetry in one `decisions.md` entry so it reads as
considered.

**New screen `app/(app)/likes.tsx`**, params `?targetType=&targetId=&from=`, same skeleton as
`follows.tsx`. Its literal starts with `/(`, so `routeLiterals.test.ts`'s broad net catches it with
no test change.

---

## 4. Post detail screen — "See all N" becomes real

`feed.tsx:281-287` renders "See all N" as a plain `<View>`, and nothing in the app has ever called
`GET /posts/:id/corrections`.

Server — `listPostCorrections` gains a viewer id and a query, fixing three things at once:

1. **Block filter** (the pre-existing hole): 404 if the post's author is blocked;
   `authorId: { $nin: hidden }` on the corrections.
2. **Pagination**, keyset **ascending** on `{createdAt: 1, _id: 1}` — corrections read oldest-first,
   which is the ordering the "top correction is the oldest" rule depends on. `decodeDateIdCursor`
   decodes fine; the comparison flips to `$gt`.
3. **Returns the post**, so the screen is one round trip — the idiom `viewers.tsx:21-22` documents
   ("the first page is the authority").

New index, under a **new name** (same trap as `conversation_created_id`):

```ts
{ key: { postId: 1, createdAt: 1, _id: 1 }, name: 'post_created_id' },
```

`post_created` becomes a redundant prefix — `readCorrectionSummary`'s sort is served by the wider
index too — and can be dropped in a later PR. Note that in the comment.

Client — new `app/(app)/post/[id].tsx` (`<Tabs.Screen name="post/[id]" options={FULL_SCREEN} />`):
back row via `goBackTo`, the post card (tappable author, media, like button + count), then an
infinite `FlatList` of corrections, each with a tappable author, its own like button and count, and
the note. In `feed.tsx` the dead `<View>` becomes a `Pressable`, and **the `correctionCount` pill
becomes pressable unconditionally** — a post with zero corrections still has likes, and the pill is
the only affordance that is always there.

---

## 5. Tappable authors — extract the helper

`` router.push(`/(app)/profile/${handle}?from=${encodeURIComponent(…)}`) `` is inlined four times
already (`discover.tsx:267`, `viewers.tsx:79`, `leaderboard.tsx:165`, `chat/[id].tsx:535`) and the
feed adds at least four more (card author, top-correction author, correction rows, liker rows).

Split it the way `backHref.ts` is split from `navigation.ts`, and for the same stated reason
(importing `expo-router` for a value pulls in `react-native`, which mobile vitest cannot parse):

- `apps/mobile/src/lib/profileHref.ts` — pure, testable, strips a leading `@` (handles arrive both
  ways; the route param must be bare).
- `openProfile(handle, from)` in `apps/mobile/src/lib/navigation.ts`, next to `goBackTo`.

Collapse the four existing call sites. **Add `'openProfile'` to `ROUTE_CALLEES`** in
`apps/mobile/src/lib/routeLiterals.test.ts:88` — the broad net catches the literal either way, but
that test's own comment says *"Nothing here detects that it needs adding."* Re-run and confirm its
`structured > 40` / `broad > 60` floors still hold after four call sites collapse.

---

## 6. Media on posts and corrections

### One media schema, shared by chat and feed

Move `IMAGE_CONTENT_TYPES`, `AUDIO_CONTENT_TYPES`, `MAX_IMAGE_BYTES`, `MAX_AUDIO_BYTES`,
`MAX_AUDIO_SECONDS`, `messageMediaSchema` (→ `mediaSchema` / `Media`), `isImageContentType`,
`isAudioContentType` out of `packages/shared/src/chat.ts:246-311` into a new
`packages/shared/src/media.ts`, re-exported from `chat.ts` for compatibility. One shape and one set
of ceilings, so the feed cannot grow a second definition that drifts.

`createPostSchema`, `createPostCorrectionSchema`, `feedPostSchema`, `postCorrectionSchema` each gain
`media: mediaSchema.optional()`. **No `kind` field** — `messages` needs `type` because it also has
`'text'` and `'correction'`; a post's attachment is unambiguous from its content type, so derive it
with `isImageContentType`.

**`body` stays required.** This is the one place the two asks pull apart: a learner photographing a
handwritten sentence would want an image-only post, but with no text there is nothing for `corrected`
to be an edit of, and `startCorrecting` (`feed.tsx:88`) seeds the composer with `post.body`. Media is
an attachment to a sentence in this round. Loosening a schema later is backwards-compatible;
tightening is not.

### `POST /posts/upload-url`

In `apps/api/src/routes/media.ts`, next to `/messages/upload-url`, with `requireVerifiedEmail` — the
`/messages/upload-url` comment says a signed URL is a capability and must not be handed to someone
who cannot post, and the feed's equivalent of "can you post here" is `POST /posts`' own guard.
Validate `contentType` against `kind` **before** signing. Key `posts/{userId}/{uuid}.{ext}` — keyed
by user, not post, because the post does not exist when the URL is signed (unlike a conversation),
mirroring `photos/{userId}/…` and keeping the deletion purge able to find them by prefix.

### Validation — extract, don't duplicate

`sendMediaMessage` (`modules/chat/messages.ts:212-235`) checks content-type-matches-kind, size, and
that the URL starts with `STORAGE_PUBLIC_BASE_URL`. Extract to
`apps/api/src/modules/media/assertMedia.ts` → `assertMediaAllowed(media, storagePublicBaseUrl)`,
called from `sendMediaMessage`, `createPost` and `correctPost`. Otherwise the ceilings live in two
places and diverge the first time one moves.

`Post` and `PostCorrectionDoc` gain `media?: Media`; every DTO builder spreads
`...(doc.media ? { media: doc.media } : {})`.

### Quota — the same `media` bucket

`consumeQuota(db, userId, tier, 'media')` in `createPost` / `correctPost`, **only when
`input.media` is present** → `QUOTA_EXCEEDED` with `retryAt`. It is the same abuse surface (bytes
stored and served forever), `PLAN_LIMITS.mediaPer24h` is documented as "a ceiling on abuse rather
than a paywall", and a second bucket would mean a second `PLAN_LIMITS` key, a second `QUOTA_KINDS`
entry, and a free tier that is really 100/day through two doors. **User-visible coupling to state in
the release note: a heavy chat day leaves fewer feed attachments.**

This path is REST, so `caught instanceof ApiRequestError && caught.code === 'QUOTA_EXCEEDED'` is the
correct check. The `errorCodeOf` workaround at `chat/[id].tsx:192` exists only because `emitWithAck`
rejects with a plain `Error` — do not cargo-cult it here.

### Client

- `uploadPostMedia` in `queries.ts` next to `uploadMessageMedia:636` — the identical three-step
  dance against `/posts/upload-url`.
- New `apps/mobile/src/components/MediaComposerBar.tsx`: the picker + record buttons, extracted
  almost verbatim from `chat/[id].tsx`'s `pickImage()` (`:205`) and `toggleRecording()` (`:226`),
  plus the timer and `MAX_AUDIO_SECONDS` cap from `useVoiceRecorder`. Props `onPicked(kind, input)`,
  `disabled`, and a pending-attachment chip with a remove ✕. Used by all three composers; `sendMedia`
  stays per-screen because the destinations differ (socket vs REST).
- **Attach, don't send.** The chat composer uploads on pick; the feed composer holds
  `pending: {kind, uri, contentType, durationSeconds?, width?, height?} | null` and uploads **on
  submit**. Uploading on pick would burn the media quota and write bytes for a post the user then
  cancels.
- Generalise `AudioBubble` / `ImageBubble` (`apps/mobile/src/components/MediaBubble.tsx`) from
  `{ message: MessageDto, mine }` to `{ media: Media, tint? }` and update the two chat call sites.
  Otherwise the feed grows a second audio player and re-derives that file's "one player per bubble,
  deliberately" decision.

**Risk:** `chat/[id].tsx` is the most-used screen and this refactor is untestable under mobile
vitest. Behaviour-preserving, but it needs a manual pass — which is why it gets its own PR.

---

## 7. i18n

All eight catalogues (`ar de en es fr pt-BR ru tr`) or `pnpm -r typecheck` fails — that is the
mechanism, and the PR touches eight files by design. **Every count is a plural entry, never
`count === 1 ? … : …`** (Russian and Arabic do not split there).

New under `feed.`: `likes` **(plural)**, `like`, `unlike`, `likedBy`, `likersEmptyTitle/Body`,
`postTitle`, `allCorrections`, `correctionsEmptyTitle/Body`, `attachPhoto`, `recordVoice`,
`removeAttachment`, `recording` (`{seconds}`), `attachmentFailed`, `mediaQuota`,
`followingEmptyTitle/Body` (replacing `knownEmpty*`).

Changed: **`feed.seeAll` is a plain string today** (`'See all {count}'`) — convert it to a plural
entry as part of building the screen it points at.

New under `profile.`: `follow`, `following`, `unfollow`, `followers` **(plural)**, `followingCount`
**(plural)**, `followersTitle`, `followingTitle`, `followersEmptyTitle/Body`,
`followingEmptyTitle/Body`, `followFailed`.

`catalogs.test.ts` and `plurals.test.ts` cover these by construction — no test edits.

---

## 8. Tests

**API integration** (`MongoMemoryReplSet` → `buildApp` → `ensureIndexes` → `app.inject`, real auth
via `testSupport/authFlow.ts`; canonical example `routes/feed.test.ts:1-80`):

- `routes/feed.test.ts` — following-tab **pagination** (bug 1, the test nobody wrote); following-tab
  union (a follow-only author, a conversation-only author, someone who is both appears once); a
  frozen user's correction increments `lifetime.corrections` while paying 0 (bug 3); media accepted,
  and rejected for wrong content type / oversize / a foreign host; media consumes the `media` quota
  and a post without media does not.
- `routes/follows.test.ts` (new) — follow twice → one row; unfollow twice → success; self-follow 400;
  following a blocked user 404; lists paginate and exclude blocked users; `GET /profiles/:handle`
  carries `follow.viewerFollows` and the counts; **the count and the list agree after a block**.
- `routes/likes.test.ts` (new) — `PUT` twice → count 1 (**this is the test that proves PUT over
  toggle**); `DELETE` twice → success; two concurrent `PUT`s via `Promise.all` → one row; a post like
  and a correction like are independent; liking a blocked author's post 404; **no ledger row and no
  `dailyActivity` row after a like**; `GET /feed` carries `likeCount` / `likedByViewer` on the post
  **and** its `topCorrection`.
- `routes/postCorrections.test.ts` (new, or folded into `feed.test.ts`) — pagination, block filtering
  of both the post author and the correction authors, `post` present on page one.

**API unit:** `apps/api/src/lib/feedCursor.test.ts` — countless round-trip returns `count: null`,
counted returns `count: 3`, `count: 0` round-trips (the common case), garbage throws.

**Mobile** (must be pure modules under `src/lib` — `vitest.config.ts` looks nowhere else):
`feedCache.test.ts` (`applyCorrection` 0→1 fills `topCorrection`, 1→2 leaves it, unknown id returns
the same reference; `applyLike` both directions), `profileHref.test.ts`, and the `ROUTE_CALLEES`
addition + floor re-check in `routeLiterals.test.ts`.

**Shared:** `packages/shared/src/feed.test.ts` — oversize media rejected, unknown `targetType`
rejected, page-size defaults and maxima.

---

## 9. Docs

The feed appears **nowhere** in `docs/architecture.md` or `docs/decisions.md` today (`grep -i feed`
returns nothing), and two written statements are about to become false.

`docs/architecture.md`: correct the Decisions table's `Match model` row and the identical comment at
`apps/api/src/db/collections.ts:37-38` — a `likes` collection now exists, but it is a signal on feed
**content**, never on a person, and it opens no channel. Add a "Community feed" subsection under the
MongoDB schema covering `posts`, `postCorrections`, `likes`, `follows`, with the
computed-vs-denormalized rule and the `correctionCount`-is-a-sort-key contrast. Add
`posts/{userId}/…` to the storage prefixes and record that feed media shares `mediaPer24h`.

`docs/decisions.md`: one entry per real decision, **each folded into the PR that makes it** rather
than batched — the repo's convention is that a decision is recorded with the change that caused it.
Entries: the likes collection is not a match gate; a like pays nothing; likes are counted, not
denormalized, because they are not a sort key and must never become one; PUT/DELETE not a toggle;
Following is a bounded union; the following cursor's dot; the vanishing corrected post is fixed in
the cache, not the sort; correction counts count corrections, not awards; follower counts are
block-filtered and like counts are not.

Also update `apps/api/src/modules/account/deletion.ts` — `follows` (both directions) and `likes`
(`userId`) into **both** the purge list (`:184-207`) and the GDPR export (`:226-236`).

---

## 10. Sequencing

Branch-then-PR, rebase merges (the `langx` convention). Eight PRs; 1, 2, 3, 5 and 7 are shippable
alone.

| # | Branch | Contents | After |
| --- | --- | --- | --- |
| 1 | `fix/feed-counts` | All three count bugs: `lib/feedCursor.ts` + regex, `countCorrectionsWritten` + 2 indexes, `lib/feedCache.ts` + the `useCorrectPost` patch. No schema change. | — |
| 2 | `refactor/profile-link` | `profileHref.ts`, `openProfile`, `ROUTE_CALLEES`, collapse 4 call sites. | — |
| 3 | `feat/post-detail` | Paginate + block-filter `GET /posts/:id/corrections`, `post_created_id`, `app/(app)/post/[id].tsx`, "See all N" made real, tappable authors, `feed.seeAll` → plural. | 2 |
| 4 | `feat/likes` | `likes` collection, indexes, `modules/feed/likes.ts`, `routes/likes.ts`, `readLikeSummary` into both list paths, DTO fields, like UI, `app/(app)/likes.tsx`, i18n, purge/export. | 3 |
| 5 | `feat/follow-graph` | `follows`, indexes, `modules/social/follows.ts`, `routes/follows.ts`, `toPublicProfile` signature, Follow button, `app/(app)/follows.tsx`, i18n, purge/export. Does not touch the feed. | — |
| 6 | `feat/following-union` | `listFeed`'s following branch → bounded union, `FEED_FOLLOWING_SOURCE_LIMIT`, empty-state copy. | 5 |
| 7 | `refactor/shared-media` | `packages/shared/src/media.ts`, `assertMediaAllowed`, generalise the bubbles, extract `MediaComposerBar`. Pure refactor. | — |
| 8 | `feat/feed-media` | `POST /posts/upload-url`, `media` on models + DTOs, quota, `uploadPostMedia`, both composers, rendering, i18n, tests. | 7 |

Run **1 → 2 → 3 → 4** as the main line, with **5 → 6** and **7 → 8** as parallel branches (disjoint
files). PR 4 is the largest; splitting it server/client is awkward because the DTO fields would ship
unpopulated, so keep it whole. PR 6 is the only one that changes what an existing tab *shows*, which
is why it is separate from 5 — it must be revertable on its own.

---

## 11. Verification

Per PR, locally (no CI ceremony; CI on Actions runs the same four on push):

```bash
cd ~/Developer/langx/langx
pnpm test && pnpm -r typecheck && pnpm lint && pnpm format:check
```

MongoDB must be a replica set (`docs/self-host.md`) or the first sign-up in the API tests fails on a
transaction error.

One live pass at the very end, over the whole feature, driving the Expo web build with Playwright
(raise inotify first or Metro dies with ENOSPC):

```bash
pnpm dev        # API :4000, Expo :8081
```

Two seeded accounts, then walk the whole ask end to end:

1. A posts a sentence; B corrects it. **B's card stays visible and flips to "You corrected this / 1
   correction"** — bug 2.
2. Tap the corrector's name → B's profile. Tap **Follow** → the button flips and the counts move.
3. Back on the feed, switch to **Following** → A sees B's posts. Scroll past page one → **no 400** —
   bug 1.
4. Like the post and the correction; the counts move. Tap a count → the likers list; tap a liker →
   their profile.
5. Tap the count pill → the post detail screen; every correction is listed with its own like button.
6. Attach a photo to a post and record a voice note on a correction; both render back in the feed.
7. B's `me` tab shows a non-zero corrections tile; freeze B's tokens (`profiles.tokenFrozenAt`) and
   correct again — the tile still moves while the balance does not — bug 3.

Pull-to-refresh cannot be driven from a desktop browser (touch-only); verify it on device or accept
it as untested in the web pass.
