# Social auto-posting

Venus's day videos go out on LangX's own accounts — Instagram Reels, the
Facebook Page's Reels, YouTube Shorts and TikTok — from a 100-day calendar
that is approved once and then posted by the API on its own, one video a day.

Nothing here posts for anybody else, and nothing posts at all until
`flags.socialAutopost` is on.

## How it works

```
calendar.json ──import──▶ socialPosts (draft) ──approve──▶ approved
                                                              │
                         every minute, flag on, due ──claim──▶ publishing
                                                              │
                                     adapter.publish(row) ────┤
                                                              ▼
                                              published │ failed │ approved (retry later)
```

- **One row per (calendar version, day, platform)** in `socialPosts`. The
  unique index `calendar_slot_platform_unique` in `apps/api/src/db/indexes.ts`
  makes a second row for the same post impossible, so re-running an import
  can never schedule a video twice.
- **Statuses.** `draft` is what an import writes; nothing posts it.
  `approved` is the operator's yes and the only state the scheduler takes.
  `publishing` is the scheduler's claim. `published` keeps the platform's id
  and link. `failed` keeps why. `skipped` is the operator's no.
- **The scheduler** (`modules/social/autopost.ts`) runs inside the API every
  minute. With the flag off it reads nothing else and returns. With it on, it
  claims due approved rows one at a time with an atomic
  `approved → publishing` update, so two API machines, or two overlapping
  passes, cannot both post one row.
- **Retries** are for failures that certainly posted nothing: a container
  Instagram never finished, a token refresh that failed, a 500 before the
  upload. Those go back to `approved` with a wait of 5, then 30 minutes, and
  fail after the third attempt (`SOCIAL_AUTOPOST_RULES` in `packages/shared`).
  A failure at or after the step that publishes — a timeout on Instagram's
  `media_publish`, Facebook's `finish`, the YouTube upload, a TikTok direct
  post — is never retried, because the post may be up. It fails with a
  message saying to look at the account first.
- **Late rows are not posted.** A row more than six hours past its time fails
  as "Missed" instead. A switch left off for a week must not come back as a
  week of videos in one minute. The panel's _Post it now_ posts it anyway.
- **A claim that dies** — the machine restarted mid-upload — fails after 30
  minutes rather than being retried, for the same reason as above.
- **Platforms are optional, one by one.** A platform without its credentials
  has no adapter; its rows fail as "Not connected" when they are due, and the
  others post as usual.

Each platform's adapter is in `apps/api/src/modules/social/` and does one
thing: `publish(row) → { id, url }`.

| Platform  | How                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Instagram | A `REELS` container from the video's URL, polled until `FINISHED`, then `media_publish`; then the permalink and the calendar's first comment.                |
| Facebook  | The Page's `video_reels` edge: start a session, hand Facebook the file URL, finish with `PUBLISHED`.                                                         |
| YouTube   | A resumable `videos.insert` of the bytes, downloaded from media.langx.io, with the calendar's title, description and tags.                                   |
| TikTok    | Content Posting API, file upload in one chunk. By default to the account's inbox as a draft (`video.upload`); with `TIKTOK_POST_MODE=direct`, a public post. |

Instagram and Facebook fetch the video from its public URL themselves;
YouTube and TikTok are sent the bytes.

## The calendar

The file the calendar is drafted in is read as it is: the importer takes
`version`, `timezone`, `startDate` and, per slot, `dayOffset`, `videoDay`,
`lang`, `videoUrl`, `coverUrl`, `postTime`, the three platforms' words,
`firstComment`, `nativeCheck` and `enAlternate`, and ignores the keys that are
there for the reviewer. Facebook gets Instagram's caption. The first comment is
Instagram's alone.

Video file names come from the calendar, never from a pattern: a re-cut day is
`…-r2.mp4`, and the calendar is where that is written down.

A language swap waiting for a native speaker (`nativeCheck`) is held back from
the bulk approval. Once it has been read, approve it by its day; if nobody can
read it in time, switch it to its English alternate.

## Importing, approving, stopping

Everything goes through one script. Run from `apps/api`, against the database
your `.env` names:

```bash
cd apps/api
pnpm exec tsx --env-file=../../.env scripts/social-calendar.ts <command>
```

| Command                                                        | What it does                                                                                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import <calendar.json> --start 2026-11-02 --dry --next 7`     | Reads the file and prints the next 7 days exactly as they would be posted: local and UTC time, video, caption with hashtags, first comment. No database. |
| `import <calendar.json> --start 2026-11-02`                    | Writes every slot as a draft. Safe to repeat: drafts take the file's words, an approved row the file changed goes back to draft, posted rows are kept.   |
| `approve`                                                      | Every draft → approved, except swaps waiting for a native check, which it lists.                                                                         |
| `approve --offset 5` / `approve --offset 5 --platform youtube` | One day, or one post. Naming a day approves its swap too.                                                                                                |
| `alternate --offset 5`                                         | That day's swap becomes its English alternate.                                                                                                           |
| `skip --offset 5 [--platform tiktok]`                          | That day, or one post, is not posted.                                                                                                                    |
| `--dry --next 10`                                              | The next 10 days as the database holds them, with each row's status and whether its platform is connected.                                               |

`--start` is the date of `dayOffset` 0, in the calendar's own time zone. A
database whose name does not end in `_dev` is only written with `--confirm`.

To start posting: import, approve, check `--dry`, then turn on
`socialAutopost` in the operator panel's _Flags_.

**To stop everything,** turn `socialAutopost` off. The next pass, within a
minute, posts nothing. A post already uploading finishes. To stop one post,
_Skip_ it in the panel.

The operator panel's _Social posts_ page lists what is coming and what went
out, per platform, with each row's error and link, and approves, skips or
retries one row. Each of those is in the admin audit log.

## Setting up each platform

Each credential goes on the API as a Fly secret, set by the account owner:

```bash
fly secrets set -a langx-api FB_PAGE_ID='…' FB_PAGE_TOKEN='…'
```

`.env.example` lists every key with a comment. Without a platform's keys the
API boots and runs as before.

### Instagram (@langxapp)

Uses `IG_PAGE_TOKEN`, the token the comment-to-DM flow already has — no new
key. The token must also carry `instagram_business_content_publish`:

1. In the Meta app's _Instagram → API setup with Instagram login_, add the
   `instagram_business_content_publish` permission.
2. Generate a new token for @langxapp there (it asks the account to grant the
   added permission), exchange it for a long-lived one as before, and set it
   as `IG_PAGE_TOKEN`. Grant the messaging and comment permissions again in the
   same step: the comment-to-DM flow runs on this token too.

Meta lets an app use a permission without App Review for accounts that have a
role on the app. If the grant is refused for @langxapp, either give the
account a role (Instagram tester) or request Advanced Access for
`instagram_business_content_publish` through App Review. Instagram caps
API-published posts per day far above one.

### Facebook Page

`FB_PAGE_ID` and `FB_PAGE_TOKEN`:

1. In Graph API Explorer, with the same Meta app, get a user token with
   `pages_manage_posts`, `pages_read_engagement` and `pages_show_list`,
   signed in as an admin of the LangX Page.
2. Exchange it for a long-lived user token, then ask `/me/accounts` for the
   Page's token. A Page token taken from a long-lived user token does not
   expire.
3. Set the Page's id as `FB_PAGE_ID` and that token as `FB_PAGE_TOKEN`.

The same role rule applies: a Page managed by somebody with a role on the Meta
app needs no App Review.

### YouTube

`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`:

1. In a Google Cloud project, enable the _YouTube Data API v3_.
2. Configure the OAuth consent screen (External), add the
   `https://www.googleapis.com/auth/youtube.upload` scope, and **publish it to
   production**. While it is in _Testing_, Google expires every refresh token
   after seven days and the uploads stop a week in. An unverified production
   app shows a warning on the consent screen, which is fine for our own
   channel.
3. Create an OAuth client (Web application) with
   `https://developers.google.com/oauthplayground` as a redirect URI.
4. In the OAuth Playground, under its settings, use your own client id and
   secret; authorize `youtube.upload` signed in as the channel's owner,
   choosing the LangX channel if the account has several; exchange the code
   and copy the refresh token.
5. Set the three secrets.

**The audit.** Videos uploaded through the API by a project Google has not
audited are locked to _private_, whatever the request asks. The adapter
notices and says so on the row ("Uploaded as private"). To post publicly, the
project has to pass the YouTube API Services audit: the form is linked from
the YouTube API Services Terms and Developer Policies pages. Until it passes,
uploads land as private videos, which can be made public by hand in YouTube
Studio.

### TikTok

`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`,
`TIKTOK_POST_MODE`:

1. Create an app on TikTok for Developers and add _Login Kit_ and the
   _Content Posting API_. Request `video.upload` (and `video.publish`, for
   later), and register a redirect URI.
2. Authorize the app as the LangX TikTok account through TikTok's OAuth
   (`/v2/auth/authorize/`, those scopes), exchange the code at
   `/v2/oauth/token/`, and set the refresh token as `TIKTOK_REFRESH_TOKEN`.
   TikTok rotates refresh tokens; the API keeps the newest in the
   `socialTokens` collection, and a new value in the secret replaces it.
3. Leave `TIKTOK_POST_MODE=inbox`.

**The audit.** An app TikTok has not audited may only direct-post private
(`SELF_ONLY`) videos. So the default is the inbox: each video arrives in the
TikTok app as a draft notification, and somebody opens it and posts it. TikTok
is not sent a caption in that mode — the panel shows the full caption on the
row, selectable, to paste. After the audit passes, set
`TIKTOK_POST_MODE=direct` and posts go out public, with the caption, on their
own. If the account cannot post publicly, direct mode refuses rather than
posting privately and says to go back to `inbox`.

TikTok's audit reviews an app built to its content sharing guidelines — a
person choosing privacy and confirming each post. A server that posts on a
schedule is not what it was built for, so the audit may not pass; the inbox
works either way.

## Not decided

- **AI-generated content labels.** TikTok's `is_aigc` and YouTube's synthetic
  media declaration are left unset. Venus is an animated mascot rather than
  realistic footage, which the platforms' rules generally do not ask to label,
  but that is the owner's call; each is one field in its adapter.
