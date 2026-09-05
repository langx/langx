# Video, multiple attachments, gallery and a full-screen viewer

## Status: built and pushed (2026-09-04)

`langx/langx#1115` on branch `feat/video-attachments`, five commits, worktree
`/root/wt-video`. Website copy is `langx/website#135`, a **draft** that must not
merge until a build carrying video is on the stores.

Deviations from the plan below, all found while building:

- The repo had already grown a pinch-zoom `PhotoViewer` and a tappable
  `ImageBubble`, so the viewer was extended for video rather than written.
- `attachmentKindsValid` had to allow two audio files: the pronunciation
  answer's two takes are one message. The rule is "audio does not travel with
  pictures", not "audio travels alone".
- `expo-image-picker` reports `duration` in seconds on web and milliseconds on
  native. The validator takes the unit from the caller now.
- A seventh picked file was dropped silently; it is refused in words.
- Gallery video tiles show their own first frame instead of a grey square.

Unverified until Behic cuts a build: iOS/Android playback, native multi-select,
the HEVC-to-H.264 export, and the fingerprint runtime.

## Context

Behic's asks, in order (2026-09-03/04):

1. "Not only photos, video should be sendable too."
2. After picking, show a small square thumbnail with an × in the top-right so it
   can be detached; send happens with the send button. Same for photos.
3. More than one attachment per message/post, max 6 or 8, laid out as a gallery;
   tapping media in a post opens it large.

Today: chat and feed attachments are `image` and `audio`, exactly one per
message/post, stored as a single `media` object; the chat composer uploads on
pick; there is no video code, no multi-select, no gallery and no full-screen
viewer outside the profile's `PhotoGallery`. Everything rides one presigned path
(sign → client PUT to Backblaze B2 → socket/REST send), one `mediaSchema`, one
`mediaPer24h` quota bucket, the 5-message gate and the account purge sweep.

Decisions taken with Behic:

- Scope **chat + feed** (posts and corrections). Pronunciation answers stay single audio.
- Video ceiling **60 s / 64 MB** per file. Server re-checks; client refuses before upload.
- `expo-video` is native → same PR flips `runtimeVersion` to `{ policy: 'fingerprint' }`.
  No cloud build started by us; Behic builds on the Mac.
- No thumbnail files, no transcoding (docs/decisions.md L1027-1040): the player's first frame is the preview.

Decisions I am making (flag in the PR, easy to flip):

- **`MAX_ATTACHMENTS = 6`** (Behic said 6 or 8; 6 matches `PLAN_LIMITS.maxPhotos`). One constant in shared.
- **One message/post = one unit of `mediaPer24h`** regardless of attachment count.
  Precedent: the two-take pronunciation answer spends one unit ("bytes are the
  cost control, not the count"); `assertAttachable` already loops an array and
  consumes once.
- **Audio stays single.** A voice note is one attachment on its own; images and
  videos may mix, up to `MAX_ATTACHMENTS`. Message `type` = kind of the first attachment.
- **New field `attachments: Media[]` beside the legacy `media`**, no data migration.
  3,604 v1-imported messages, the import scripts and every installed build read
  single `media`; readers normalise (`attachments ?? [media]`), new writes store
  `attachments` **and** `media = attachments[0]` so installed builds still show
  the first file. Dropping `media` is a later, separate migration.

Workspace: 7 peer sessions share the checkout → worktree:
`git worktree add /root/wt-video -b feat/video-attachments origin/main && cd /root/wt-video && pnpm install`.
Commit in phase order (shared → api → mobile → docs) so each commit typechecks.

---

## Phase 1 — `packages/shared`

**`src/media.ts`**
- `VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime']`, `isVideoContentType`.
  Not `video/webm`: iOS cannot decode VP8/VP9, so accepting it stores files half
  the recipients cannot open. iOS picker emits `.mov` (H.264 under `Compatible`
  mode), Android emits `video/mp4`. Comment that `audio/webm` is tolerated only
  because the web recorder has no other output.
- `MAX_VIDEO_BYTES = 64 MB`, `MAX_VIDEO_SECONDS = 60`, **`MAX_ATTACHMENTS = 6`** with why-comments.
- Kind vocabulary here so nothing else spells it: `MEDIA_KINDS = ['image','audio','video']`,
  `type MediaKind`, `mediaKindSchema`, `mediaKindOfContentType(ct): MediaKind | null`,
  `MEDIA_LIMITS = { image: { maxBytes }, audio: { maxBytes, maxSeconds }, video: { maxBytes, maxSeconds } }`.
- `mediaSchema`: `sizeBytes.max(Math.max(IMAGE, AUDIO, VIDEO))`,
  `durationSeconds.max(Math.max(MAX_AUDIO_SECONDS, MAX_VIDEO_SECONDS))`; field
  comments: duration = audio and video (per-kind ceiling checked in
  `assertMediaAllowed`), width/height = images and video.
- `attachmentsSchema = z.array(mediaSchema).min(1).max(MAX_ATTACHMENTS)`.
- Pure helpers used by API and app alike:
  `attachmentsOf(doc: { attachments?: Media[]; media?: Media }): Media[]` (normaliser),
  `attachmentKindsValid(items)` → `'ok' | 'audio-must-be-alone'`.

**`src/chat.ts`**
- `MESSAGE_TYPES` + `'video'`.
- `mediaUploadUrlSchema.kind: mediaKindSchema` (still one file per sign call).
- `sendMediaMessageSchema` → `{ conversationId, attachments: attachmentsSchema, body?, replyToMessageId? }`,
  wrapped in `z.preprocess` that maps a legacy `{ kind, media }` body to
  `{ attachments: [media] }` (installed builds keep working against the new API;
  comment says so and that the branch goes with the `media` field).
- `messageSchema`/DTO types: `attachments?: Media[]` beside `media?`.

**`src/feed.ts`**
- `postMediaUploadUrlSchema.kind: mediaKindSchema`.
- `createPostSchema` and `createPostCorrectionSchema`: `attachments: attachmentsSchema.optional()`,
  legacy `media` still accepted and normalised with the same preprocess.
- `feedPostSchema`, `postCorrectionSchema`: `attachments?: z.array(mediaSchema)` beside `media?`.
- Pronunciation schemas untouched.

**`src/errors.ts`**: `MEDIA_TOO_LONG` (413) beside `MEDIA_TOO_LARGE`, with the
HEIC-style comment (a 61 s, 6 MB clip is not "too large"; the fix is different).

**Tests** (`src/chat.test.ts` or new `media.test.ts`): `mediaKindOfContentType`
('video/quicktime' → video, 'video/webm' → null); `attachmentsOf` (legacy
`media` → one item, both present → `attachments` wins, neither → `[]`);
`sendMediaMessageSchema` accepts `{kind, media}` and `{attachments}` and refuses 7 items.

## Phase 2 — `apps/api`

**`src/modules/media/assertMedia.ts`**
- `MediaKind` re-exported from shared; `mediaKindOf` → `mediaKindOfContentType`.
- Per-kind `MEDIA_LIMITS[kind]` for bytes; new duration check: video without
  `durationSeconds` → `VALIDATION_FAILED`; any kind over `maxSeconds` → `MEDIA_TOO_LONG`.
- New `assertAttachmentsAllowed(items, baseUrl, expected?)`: length ≤ `MAX_ATTACHMENTS`
  (zod already), each through `assertMediaAllowed`, then `attachmentKindsValid`
  → `VALIDATION_FAILED` "a voice note travels alone". Returns the kind of the first item.
- `feed/attachments.ts` `assertAttachable` calls it instead of its own loop (keeps its one quota unit).

**`src/routes/media.ts`**
- Both kind ternaries → `mediaKindOfContentType(contentType) !== kind` → 415 (same message text).
- New `src/modules/media/objectExtension.ts` (`video/quicktime` → `mov`, `image/jpeg` → `jpg`,
  else subtype, else `bin`), used by all four sign routes; delete `EXTENSION_BY_CONTENT_TYPE`.
  One sign call per file stays (≤ 6 round trips; a batch route is not worth a second gate path).

**`src/modules/chat/messages.ts`**
- `sendMediaMessage(db, userId, input, baseUrl)`: `assertAttachmentsAllowed` (re-check after the gate),
  `type` = first kind, doc gets `attachments` **and** `media: attachments[0]` (comment: for installed builds).
- `previewFor(type, count)`: `'📷 Photo'`, `'🎬 Video'`, `'🎤 Voice message'`;
  `count > 1` → `'📷 3 photos'` / `'🎬 2 videos'` (kind of the first). Export it.
- `messageView.ts`: emit `attachments: attachmentsOf(doc)` (present whenever there is any) and keep `media` (first); drop both on delete (L83).
- `mutations.ts` `deleteMessage`: `$unset` both fields, `deleteAttachment` for every url.
- `ws/index.ts` `message:media`: unchanged apart from the schema; `ws/fanOut.ts` L93
  `body: (message.body || previewFor(type, count)).slice(0,120)` — fixes the empty push for caption-less attachments in passing.

**Feed** (`modules/feed/feed.ts` `createPost`/`correctPost`, `dto.ts`, delete cascades L654/L698,
`account/deletion.ts` purge): read `attachmentsOf(input)`, store `attachments` + `media` first,
DTOs emit both, deletes and the purge sweep every url in both fields. `pronunciation.ts` untouched.

Leave alone: `handles/legacyConversations.ts`, `lib/legacyMedia.ts`, `scripts/migrate-messages.ts`
(they write single `media`, which `attachmentsOf` reads).

**Tests — `routes/messages.test.ts`** (rename the describe to "attachments"), fixtures `image`, `video`
(`video/mp4`, 4 MB, 30 s, 1280×720):
1. sends a video → `type === 'video'`, `lastMessage.body === '🎬 Video'`
2. sends three photos in one message → `attachments.length === 3`, `media` equals the first, preview `'📷 3 photos'`
3. mixes a photo and a video → ok, `type === 'image'`
4. refuses a voice note beside a photo → `VALIDATION_FAILED`
5. refuses seven attachments → `VALIDATION_FAILED` (zod)
6. still accepts the legacy `{ kind, media }` body
7. `MAX_VIDEO_SECONDS + 1` → `MEDIA_TOO_LONG`; `MAX_VIDEO_BYTES + 1` → `MEDIA_TOO_LARGE`; no duration → `VALIDATION_FAILED`; `video/webm` → 415
8. sign route: `{kind:'video', contentType:'image/jpeg'}` → 415 and the reverse
9. six attachments spend **one** media quota unit
10. reply to a caption-less video → `replyTo.preview === '🎬 Video'`
11. a v1-shaped message (only `media`) comes back with `attachments: [media]`
12. deleting a three-photo message unsets both fields and calls `deleteObject` three times (storage spy as in the existing delete test)

**Tests — `routes/feed.test.ts`**: post with three attachments comes back with them;
video on a post and on a correction; seven refused; legacy `media` body still accepted;
too-long video → 413 `MEDIA_TOO_LONG`; pronunciation answer with `video/mp4` → 415;
sign URL for `video/quicktime` is not 415; purge/delete sweep all urls.
**`objectExtension.test.ts`** as listed in Phase 2.

## Phase 3 — mobile: dependency and native config

- `cd apps/mobile && pnpm add expo-video@~57.0.3`. No `expo-file-system`.
- `app.config.ts`: `plugins` + `'expo-video'` (no options; background playback and PiP stay off, comment why);
  `expo-image-picker.photosPermission` → "LangX uses your photo library so you can share photos and videos in chat.";
  L107 `runtimeVersion: { policy: 'fingerprint' }` with the rewritten comment
  (under `sdkVersion` every SDK 57 build shared one runtime string, so an OTA
  with a new native module would reach binaries without it and crash;
  `fingerprint` changes exactly when a build is needed; installed preview builds
  stop updating until rebuilt — deliberate).
- `@expo/fingerprint` is already in the store via `expo`; EAS workflows on origin/main need no change.

## Phase 4 — mobile: picking, pending previews, upload

**`src/lib/pickImageAsset.ts` → `src/lib/pickMediaAsset.ts`** (callers `chat/[id].tsx:59,251`,
`AttachmentBar.tsx:5,46`; `edit-profile.tsx:130` and `(onboarding)/photo.tsx:51` only cite it in comments — rename there).
- `pickMediaAssets({ remaining })`: `launchImageLibraryAsync({ mediaTypes: ['images','videos'],
  allowsMultipleSelection: true, selectionLimit: remaining, orderedSelection: true, quality: 0.8,
  preferredAssetRepresentationMode: Compatible })`. One button, one permission, the OS grid does the picking.
  Extend the HEIC comment: `Compatible` also exports HEVC `.mov` as H.264.
- Result `{ status: 'picked'; media: PickedMedia[]; refused?: RefusedReason } | cancelled | denied`.
  `PickedMedia` is `{ kind: 'image', uri, contentType, width?, height? } | { kind: 'video', uri, contentType, durationSeconds, width?, height? }`.
  Per asset: kind from `asset.type` (fallback `mimeType.startsWith('video/')`);
  unsupported content type, `duration/1000 > MAX_VIDEO_SECONDS`, `fileSize > MAX_VIDEO_BYTES`
  (or `MAX_IMAGE_BYTES`) → the asset is dropped and the first reason is returned
  once. Web picker already reports `duration/width/height` (verified in
  `expo-image-picker/src/ExponentImagePicker.web.ts:169-184`) — no probe.
- The validation is a pure function `validatePickedAssets(assets)` in
  `src/lib/pickedAssets.ts` (no react-native import) so vitest covers it.

**New `src/components/AttachmentPreview.tsx`** — one thumbnail, used by both composers:
- 64×64, `borderRadius: radius.md`, `overflow: 'hidden'`, `backgroundColor: colors.fill`.
  Image → `expo-image` on the local uri, `cover`. Video → muted, paused `VideoView`
  on the local uri, `nativeControls={false}`, `cover`, centred `play` glyph.
  Audio → the existing mic-glyph-plus-caption row (a recording has no picture).
- × as an absolutely positioned `Pressable` top-right (`top:-6, right:-6`, `hitSlop 8`,
  `colors.surface` circle, `Feather x` 12), label `t('composer.removeAttachment')`.
  Square's own accessibility label: `feed.photoAttached | feed.videoAttached`.
- **`AttachmentPreviewRow`**: horizontal `ScrollView` of previews with `gap: spacing.sm`; the
  composer renders it above the input while anything is pending.

**Behic's rule: attach, preview, then send — in chat too.** This removes chat's
"picking is sending" exception (decisions.md L1751; rewritten in Phase 7).

**`app/(app)/chat/[id].tsx`**
- `pendingMedia: PendingAttachment[]`. `pickMedia()` appends what passed
  (`remaining = MAX_ATTACHMENTS - pendingMedia.length`), alerts the refusal reason once
  (`errors.attachmentUnsupported` / `errors.videoTooLong` / `errors.attachmentTooLarge`).
  Camera button disabled at `MAX_ATTACHMENTS`; label `chat.attachMedia`.
- `send()`: if `pendingMedia.length` → `sendAttachments(pendingMedia, draft.trim() || undefined)`:
  uploads **sequentially** (one blob in memory at a time — matters at 64 MB) via
  `uploadMessageMedia`, then one `message:media` emit `{ conversationId, attachments, body }`.
  Success clears both; failure keeps the pending row (retry or ×). Error map adds `MEDIA_TOO_LONG`.
  Send-button condition L989 becomes `draft.trim() || pendingMedia.length`.
- Voice notes unchanged (record → stop → send, single).
- `messageTypeKey`: `'video'` → `'messageMeta.video'`.

**`src/components/AttachmentBar.tsx`**: `pending: PendingAttachment[]`, `onPick(items)`,
`onRemove(index)`; renders `AttachmentPreviewRow` + the camera button (disabled at max) +
mic (disabled when anything is pending, since audio travels alone). Rewrite the header
comment: both composers now hold files locally and upload on submit; what differs is layout.
**`app/(app)/feed.tsx`** and **`post/[id].tsx`** composers: `askMedia`/`correctionMedia` become arrays;
`attach()` uploads sequentially and submits `attachments`; `reportWriteError` adds `MEDIA_TOO_LONG`.
**`src/api/queries.ts`**: `MessageDto.type` + `'video'`, `attachments?: Media[]`; `uploadMessageMedia`/`uploadPostMedia`
`kind: MediaKind`; comment on `fetch(uri).blob()` (whole file in memory; `expo-file-system` streaming is the follow-up).
`src/lib/messageActions.ts` + `'video'` (test loop + captionless-video case).

## Phase 5 — mobile: gallery and viewer

**`src/components/MediaBubble.tsx`**
- `VideoBubble({ media, onPress })`: `useVideoPlayer(url)` (one per bubble, autoplay off,
  hook releases on unmount), `<VideoView nativeControls fullscreenOptions={{ enable: true }}
  contentFit="contain" />` (expo-video 57 uses `fullscreenOptions`, not `allowsFullscreen`),
  aspect `width/height` else 16:9, width 220, clipped wrapper.
- `ImageBubble` gains `onPress` (wrapped in a `Pressable`; `onLongPress` passed through so the
  chat action sheet still opens — nested Pressables swallow the long-press otherwise).
- **`MediaGallery({ items, mine, onLongPress })`**: `items.length === 1` → `ImageBubble`/`VideoBubble`/`AudioBubble`
  by content type; `2–4` → 2 columns; `5–6` → 3 columns; square tiles (`galleryColumns(n)` in
  `src/lib/gallery.ts`, tested), width 240 for multi, `gap: 2`, `cover`; video tiles get a
  centred play glyph; each tile `onPress` → viewer at that index.
- Use `MediaGallery` in `MessageBubble.tsx` L310-332 (condition gains `'video'`, reads `attachmentsOf(message)`),
  `feed.tsx` L515-523 and L641-649, `post/[id].tsx` L355-362 and L448-455. `corrections.tsx`/`my-posts.tsx` untouched.

**New `src/components/MediaViewer.tsx`** — generalised from `PhotoGallery.tsx` L39-71:
`{ items: { url; contentType? }[]; index: number | null; onClose }`, a transparent fade `Modal`
(Android back closes, ✕ top-right), image → `expo-image` `contain`, video → `VideoView` with
native controls, `player.play()` on open, paused on index change; arrows + "n / m" pager as today
(no swipe: web gestures need touch). `PhotoGallery` switches to it for its own viewer.
The viewer is mounted once per screen (`useState<{items, index}|null>`) — not one per bubble.

## Phase 6 — i18n (`en.ts` + ar, de, es, fr, pt-BR, ru, tr in the same commit)

New: `messageMeta.video: 'Video'`; `errors.videoTooLong` (plural, `{count}` seconds);
`errors.tooManyAttachments` (plural: "You can attach up to {count} files.");
`chat.attachMedia` / `feed.attachMedia: 'Attach photos or videos'`; `feed.videoAttached: 'Video attached'`;
`composer.removeAttachment: 'Remove attachment'` (replaces `feed.removeAttachment`);
`media.viewerClose: 'Close'`, `media.play: 'Play video'` (labels for the viewer and tiles).
Changed: `errors.attachmentUnsupported` → "That format isn’t supported. Use a JPEG, PNG or WebP image, or an MP4 or MOV video.";
`chat.mediaLocked` → "Photos, videos and voice notes unlock after …"; `chat.mediaQuota` → "…photos, videos and voice messages.";
`feed.photosPermission` → "…your photos and videos…". Delete `chat.attachPhoto`, `feed.attachPhoto`, `feed.removeAttachment`.

## Phase 7 — docs and website

**`docs/architecture.md`**: L203-205 one ceiling table (`MEDIA_LIMITS`; 8 MB images, 16 MB/2 min audio, 64 MB/60 s video; up to `MAX_ATTACHMENTS` per message or post);
L531-533 "no image, video or voice note"; L625-641 doc shape gains `attachments?: Media[]` with `media` marked legacy-first, type union + `'video'`.
**`docs/decisions.md`**: rewrite L1751 ("The attachment uploads on submit, not on pick" — now true of chat as well; the "picking is sending" sentence goes);
new entries after the HEIC one (L2135): "A video is one file, and the app needs a new build to play it"
(no thumbnail file; the ceilings and `MEDIA_TOO_LONG`; mp4+mov only; `fingerprint`), and
"Six attachments, one field beside the old one, one unit of quota" (why `attachments` sits next
to `media` instead of a migration; why count does not multiply quota; why audio travels alone).
**Website** (`/root/Developer/langx/website`, own branch + PR, merge commit): `features.ts` L40-44 →
"Send voice messages to practise pronunciation, and photos or short videos to show what you are talking about.",
tag `'Voice, Photos & Video'`; `plans.ts` L42 → "50 photo, video or voice messages a day". GitBook `docs/` has no claim to change.

## Verification

1. `/root/wt-video`: `pnpm test`, `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`.
2. Isolated stack (`/root/langx-verify-stack.ts` → API :4100, Expo web :8082; delete `apps/api/scratch/` and `apps/mobile/.env` before committing).
   Fixtures with ffmpeg (on the droplet): 2 s and 61 s `testsrc` mp4s, two small JPEGs.
   Playwright, in a warmed conversation (seed past the 5-message gate):
   - attach 2 JPEG + 1 mp4 via `filechooser.setFiles([...])` → three 64×64 previews with ×, **no** `/messages/upload-url` request yet;
     × on one → two previews; type a caption; send → three sign requests, three PUTs, one bubble with a 2-column gallery and the caption;
   - tap a tile → viewer opens at that index, arrows move, ✕ closes; tap the video tile → `<video>` in the viewer reaches `readyState >= 1`;
   - the 61 s file → `videoTooLong` alert, nothing pending; a seventh file → `tooManyAttachments`;
   - same attach/×/submit/tap round on the feed composer and a post card.
   Screenshot each state; look at the picture, not `innerText`.
3. State plainly in the PR: iOS/Android playback, multi-select on the native pickers, the H.264 export and the
   fingerprint runtime are **unverified until Behic cuts a preview build**; web is the only platform exercised.

## Risks (first five go in the PR description)

- `attachments` beside `media` is a deliberate double field; the follow-up migration that drops `media` is not in this PR.
- Installed builds send `{kind, media}` and read `media`: they keep working (preprocess + first-item write) but see only the first of a multi-attachment message.
- HEVC from third-party camera apps uploads and will not play on Android/Chrome; `.mov` does not play on Firefox.
- One native player per video bubble/tile; a six-video message allocates six. Autoplay off; lazy-mount on tap is the fallback if memory bites.
- `fetch().blob()` holds one 64 MB file in memory during each sequential upload.
- After merge `preview-update.yml` publishes to a runtime no installed build has; builds stop updating until rebuilt.
- One quota unit per message regardless of count: six 64 MB videos are one unit; the byte ceiling per file is the only cost control.
