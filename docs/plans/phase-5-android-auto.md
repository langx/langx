# Phase 5 — Android Auto: the car reads the message and answers it

Built and exercised on 20 September 2026, on a Pixel 8 Pro emulator running
Android 16. What follows is what it is, what was checked, and the three things
that are not checked yet.

The phase's own scope — and the correction that set it — is in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md) → _Phase 5_.
Short version: Android Auto has **no messaging template**. `CarAppService`'s
categories are navigation, POI, settings and feature cluster, and messaging is
not among them. The car's entire messaging support is a notification it knows
how to parse. So this phase is a notification, built properly, and a receiver
that can answer one with no app running.

## What was built

| Piece                                  | Where                                                       |
| -------------------------------------- | ----------------------------------------------------------- |
| The declaration Android Auto looks for | `modules/car-messaging/.../res/xml/automotive_app_desc.xml` |
| Our own notification pipeline          | `MessageNotificationsService`                               |
| The message, as a conversation         | `MessagePresenter`                                          |
| Reply and mark-as-read, in Kotlin      | `MessageActionReceiver`                                     |
| The one authenticated POST, shared     | `wear-link/NativeSend`                                      |

**A local Expo module with no JavaScript side.** `expo-module.config.json`
lists no modules; autolinking is used for the one thing it gives — a Gradle
project whose manifest and resources merge into the app's. The alternative was
a config plugin copying Kotlin into the generated `android/app`, the way
`withWearApp` copies the watch, and a library that stands on its own is less
machinery than a copy step.

**How it gets into the pipeline, without a patch or a fork.**
`NotificationsService.doWork` asks the package manager which receiver in this
package handles `expo.modules.notifications.NOTIFICATION_EVENT` and takes the
first answer, which is the highest priority. Expo registers its own at **-1**
precisely so an app can register one at the default 0 and win. Ours subclasses
`NotificationsService` and overrides exactly one method — the presentation
delegate. Scheduling, dismissal, categories, boot re-registration and the whole
response path are inherited unchanged.

**Everything that is not a message push goes to `super` untouched.** The gate
is `categoryId == "message"` — `PUSH_CATEGORY_MESSAGE`, which `fanOutMessage`
already sets — plus a conversation id in the push's data and a title to put a
name to. A message keeps Expo's notification whole, including the request it
stores in extras for `getPresentedNotificationsAsync`, and is rebuilt from it
with `NotificationCompat.Builder(context, built)`.

**One notification per conversation, which is not what Expo does.** Expo
notifies under the push's own identifier, and every push has a new one, so
three messages from one person are three notifications and the car reads three
separate conversations. A `MessagingStyle` is a thread, so this keys on the
thread: a constant tag (`langx:message`) and an id derived from the
conversation. That is also what lets the next message find the last one — the
history is read back out of the posted notification with
`extractMessagingStyleFromNotification`, so nothing is stored anywhere, the
history dies when the notification is dismissed, and there is nothing to clear
at sign-out.

**The Reply button moves to Kotlin, and that is a fix beyond the car.** The
category registered in `lib/notifications.ts` gives Android a reply action
whose `PendingIntent` goes back into Expo's response path — which means
JavaScript. On iOS that works: the system launches the app in the background
to handle it. On Android the process starts with no React runtime, so the
answer **sits in Expo's store until somebody opens the app**. The action built
here posts the reply itself from a broadcast receiver. The iOS path in
`useNotificationRouting` is untouched.

**Four words, from the same eight catalogues as everything else.**
`notifications.replyAction`, `notifications.replyPlaceholder`,
`notifications.markAsRead`, `notifications.replyFailed` and `messageMeta.you`
are in `nativeKeys.ts`, and `generate-xcstrings.ts` now writes its Android
resources into two modules rather than one — `wear/` is a separate application
with its own APK, this is a library merging into the phone's, and a resource
in one is not visible to the other.

## What the car requires, and what it got

Checked by logging the built notification's own accessors, then by reading
`dumpsys notification` on the posted one.

| Requirement                                  | Result                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `MessagingStyle`                             | ✅ `android.template=android.app.Notification$MessagingStyle`      |
| A `Person` for the reader                    | ✅ `android.selfDisplayName` = the catalogue's "You"               |
| A `Person` per sender                        | ✅ the other person's name, keyed by conversation                  |
| Reply is `SEMANTIC_ACTION_REPLY`             | ✅ `reply.semantic=1`                                              |
| Reply shows no UI                            | ✅ `reply.showsUi=false`                                           |
| Reply carries a `RemoteInput`                | ✅ the entry box opened, with the translated placeholder           |
| Reply's `PendingIntent` is `FLAG_MUTABLE`    | ✅ the text arrived at the receiver                                |
| Mark-as-read is an invisible semantic action | ✅ `invisible=1 markRead.semantic=2`                               |
| Handled by a service, never an Activity      | ✅ a `BroadcastReceiver` with `goAsync`                            |
| The declaration                              | ✅ `com.google.android.gms.car.application` in the merged manifest |

## What was exercised, end to end

The phone was signed in as a seeded account; the notifications were presented
through the real pipeline with the payload shape `fanOutMessage` sends.

| Check                                       | Result                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| A message draws as a conversation           | ✅ sender's name, the message, one Reply button                         |
| A second message joins the first            | ✅ `messages=2` in one card, both lines visible in the shade            |
| A reply from the shade reaches the server   | ✅ `POST /conversations/:id/messages` → the row is in `langx_dev`       |
| The reply is sent with no app running       | ✅ from the receiver; the app was in the background and JavaScript idle |
| Answering counts as reading                 | ✅ `readAt` set on the thread in the same second                        |
| The notification is cancelled after a reply | ✅ `mCanceledAfterLifetimeExtension=true` — see below                   |

**On that last line.** The card stays on screen after a successful reply, and
it is not ours. Android 14 extends the lifetime of a notification that is
cancelled right after a remote-input reply so the person can see their answer
land; `mCanceledAfterLifetimeExtension=true` is the system recording that our
cancel arrived while it was doing so. The reply appears under "You" in the
thread, which is the system writing its own `remoteInputHistory`.

## The three things that are not checked

- **A real head unit, or the Desktop Head Unit.** Everything above is the
  notification the car reads; nothing here has been read _by_ a car. The DHU
  needs the Android Auto app and a phone, and the checklist that matters is
  Google's, at submission.
- **A push, rather than a presented notification.** `usePushRegistration`
  returns early when `Device.isDevice` is false, so an emulator never
  registers a token and no push can reach it. The presentation path is
  identical — a push and a local notification both arrive at
  `presentNotification` — but the FCM leg was not run.
- **The failure notice.** `showUnsent` rebuilds the card with the unsent words
  and "Reply not sent" under them when the send fails. The send did not fail.

## What has to happen before this ships

**The declaration must not reach production alone, and the order is not
optional.** Opting in tells Android Auto this app does notifications in a car;
the review happens at submission and **blocks the whole release**, not just the
car. So: opt in under Play Console → Advanced settings → Form factors →
Android Auto, ship the first Auto-carrying build to **closed testing**, where a
car-quality failure reports without blocking, read what it says, and only then
let it reach production.

That opt-in is Behic's, and it is the one thing here that no build can do.
