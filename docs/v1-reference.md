# v1 identifiers

Everything v2 needs to know about the system it replaces, in one place. All of
it is already public — `langx-angular` is an open-source repository and carries
the same values in `src/environments/environment.ts` — so none of this is a
secret. What _is_ secret (the Appwrite API key, the keystore password) is not
here and never will be.

Source: `langx/constants/config.js` in the abandoned Expo rewrite, cross-checked
against the live instance.

## Store

|                          |                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| iOS bundle identifier    | `tech.newchapter.languageXchange`                                                                        |
| Android package          | `tech.newchapter.languageXchange`                                                                        |
| App Store Connect app id | `6474187141`                                                                                             |
| Apple Team ID            | `8F63M4JH8P`                                                                                             |
| App Store listing        | https://apps.apple.com/app/id6474187141                                                                  |
| Play listing             | https://play.google.com/store/apps/details?id=tech.newchapter.languageXchange                            |
| Published version        | 0.15.0 · versionCode 119                                                                                 |
| EAS project              | `c331c0a6-b2fc-4664-a9a3-c04d1fb2c115`                                                                   |
| Release keystore         | `langx-angular/android/release.keystore` (10 Jan 2024), backup copy in `backup/languageXchange/android/` |

The iOS URL scheme `tech.newchapter.languagexchange` (lowercase x) is
registered alongside `langx` — dropping it breaks every deep link already in
the wild.

## Appwrite

|          |                          |
| -------- | ------------------------ |
| Endpoint | `https://db.langx.io/v1` |
| Project  | `650750d21e4a6a589be3`   |
| Database | `650750f16cd0c482bb83`   |

| Collection  | Id                     | Migrated to v2?                                            |
| ----------- | ---------------------- | ---------------------------------------------------------- |
| `users`     | `65103e2d3a6b4d9494c8` | **Yes** — profiles + handle reservations                   |
| `rooms`     | `6507510fc71f989d5d1c` | No — see below                                             |
| `messages`  | `65075108a4025a4f5bd7` | No — see below                                             |
| `languages` | `6511599e2bf0bb1b4d2c` | No — v2 uses a compile-time ISO 639-1 table                |
| `wallet`    | `66622b8a000b305b236c` | **Never** — the token is retired                           |
| `visits`    | `659dfb10b82eedbe1d6c` | No — v2 starts `profileViews` fresh                        |
| `streaks`   | `65e73985ef5ac00c186b` | Partially — the streak _length_ rides along on the profile |
| `reports`   | `659cd2d4bea77b451cb2` | No — moderation history starts fresh                       |

| Bucket    | Id                     | Files                             |
| --------- | ---------------------- | --------------------------------- |
| `user`    | `6515f94d20becd47cb40` | 3177 — avatars and gallery photos |
| `message` | `655fedc46d24b615878a` | 3604 — images sent in chat        |
| `audio`   | `6563aa2ef2cd2964cf27` | 1270 — voice messages             |
| `assets`  | `652d3cc9c509a3bc8ef3` | 4                                 |

## Other infrastructure

|                                    |                                      |
| ---------------------------------- | ------------------------------------ |
| App                                | `https://app.langx.io`               |
| API                                | `https://api.langx.io/api`           |
| Analytics (Plausible, self-hosted) | `https://insight.langx.io/api/event` |

## Conversation history is not migrated — and that is still an open question

The MVP migrates profiles, avatars and usernames. Rooms and messages are left
behind, which means a returning user finds their username and their profile but
an empty inbox.

The data is there and reachable (`rooms` and `messages` above, plus the
`message` and `audio` buckets), so this remains a decision rather than a
constraint. Three things make it harder than the profile migration, and all
three would need answering first:

- **Identity.** A message references two Appwrite user ids, and a v2 user id
  only exists once that person signs up again. A conversation can only be
  reconstructed when _both_ participants have returned — so the import cannot
  be a one-shot ETL at cutover; it would have to run lazily, as people arrive.
- **Consent.** Restoring one person's messages necessarily restores the other
  person's words too, and the second person may never come back to agree to it.
- **Media.** Voice messages are 1270 files for a feature v2 does not ship until
  P1, and chat images are 3604 more. Importing messages that reference media the
  app cannot yet render would be worse than not importing them.

Left explicitly undecided. The identifiers are recorded here so the option
stays open.
