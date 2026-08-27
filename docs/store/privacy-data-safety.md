# Data collection — answers for Play Data Safety and Apple Privacy Labels

Written from the code, not from a template. Every row below names the field
and the file that writes it, so this stays checkable as the app changes.
Both stores treat a wrong answer here as a policy violation, and both accept
"collected but not shared" — which is almost everything LangX does.

## What is collected

| Data                      | Where it is stored                      | Why                                                                        | Optional?                                    |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Email address             | `user` (Better Auth)                    | Sign-in, verification, password reset                                      | Required                                     |
| Name / display name       | `profiles.displayName`                  | Shown on your profile                                                      | Required                                     |
| Username                  | `profiles.handle`                       | Your public identity                                                       | Required                                     |
| Year of birth             | `profiles.birthYear`                    | 18+ age gate; only the **age** is ever shown to others (`toPublicProfile`) | Required                                     |
| Gender                    | `profiles.gender`                       | Shown on profile; used by the Pro gender filter                            | `undisclosed` is a valid answer              |
| Country / city            | `profiles.country`, `.city`             | Shown on profile; Pro country filter                                       | Optional                                     |
| Photos                    | `profiles.avatarUrl`, `.photos[]`       | Your profile picture and gallery                                           | Optional                                     |
| Free text about you       | `profiles.bio`                          | Shown on profile                                                           | Optional                                     |
| Languages and levels      | `profiles.nativeLanguages`, `.learning` | The entire matching mechanism                                              | Required                                     |
| Messages                  | `messages.body`                         | Delivering your conversations                                              | Required to chat                             |
| Timezone                  | `profiles.timezone`                     | Streak "today" and reminder timing, both in your local day                 | Optional (falls back to UTC)                 |
| Approximate activity time | `profiles.stats.lastActiveAt`           | "Online now" indicator                                                     | Required                                     |
| Push token                | `devices.pushToken`                     | Sending notifications                                                      | Only if you grant permission                 |
| Purchase state            | `subscriptions`                         | Knowing whether you have Pro                                               | Only if you subscribe                        |
| Profile views             | `profileViews`                          | "Who viewed me". Not written at all if the viewer has incognito on         | Automatic; deleted after 90 days (TTL index) |
| Reports you file          | `reports`                               | Moderation                                                                 | Only if you report someone                   |

## What is NOT collected

Answering this precisely is what makes the rest credible:

- **No precise location.** `profiles.location` exists as a GeoJSON point with a
  2dsphere index, but nothing in the app writes it and no query reads it — the
  distance filter was deliberately deferred. Declare location as **not
  collected** while that remains true, and revisit this line the day it does.
- **No contacts, no calendar, no photos beyond the ones you pick, no
  microphone, no health data, no financial data.** Payment happens entirely
  inside Apple's, Google's or Stripe's flow; the server only ever sees an
  entitlement state from a RevenueCat webhook, never a card number.
- **No advertising identifiers and no third-party analytics SDK.**
- **No tracking across apps or websites.** Apple's "Tracking" category is
  therefore **not** applicable.

## Sharing with third parties

| Recipient                    | What it receives                          | Why                                                                  |
| ---------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Resend                       | Your email address and the message body   | Sending verification and password-reset mail                         |
| Google Cloud Translation     | The text you asked to translate           | Machine translation. Results are cached by a hash of the source text |
| RevenueCat                   | Your user id and purchase events          | Subscription state                                                   |
| Expo push service            | Your push token and the notification text | Delivering notifications                                             |
| Cloudflare R2 / Backblaze B2 | Your photos                               | Hosting them                                                         |

None of these receive data for their own advertising or profiling. There are no
data brokers.

## Deletion and export

Both required by both stores, and both implemented in-app:

- **Delete** — Settings → "Hesabımı sil". The account becomes invisible
  immediately and every session is destroyed; the data is permanently removed
  30 days later. Signing back in within those 30 days cancels it.
- **Export** — Settings → "Verilerimi indir" returns one JSON document with
  everything the app holds about you.

One deliberate exception, worth stating in the policy in plain words: messages
you **sent** are not deleted from the other person's conversation. Their
content is removed and they are marked as belonging to a deleted account.
Deleting them outright would rewrite a conversation someone else is also a
party to.

## Security

- Passwords are hashed by Better Auth; the server never stores plaintext.
- All traffic is TLS.
- Every listing and every conversation is authorised server-side against the
  session, including over the WebSocket — the realtime transport goes through
  the same guards as REST so it cannot become a way around them.

## Play "target audience and content"

LangX is **18+** and the age gate is enforced server-side at profile creation
(`meetsMinimumAge`, `packages/shared/src/age.ts`) for all three sign-up paths.
Do not declare a Families audience: it contradicts the 18+ policy and changes
which SDKs and data practices are permitted.

## Age rating inputs

Unrestricted user-to-user text communication and user-generated photos, with
in-app blocking and reporting. That combination normally lands at 17+/18+ on
both stores, which matches the age gate.
