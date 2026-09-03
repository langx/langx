import { z } from 'zod'

/**
 * What the app may send.
 *
 * One boolean used to cover all of it — `settings.notifications` — which meant
 * that somebody who did not want a nudge about their streak had to turn off
 * the message they were waiting for as well. Four kinds fixed that.
 *
 * Each kind briefly had two channels behind it, push and email, and the email
 * column was removed again because it sent nothing: `apps/api/src/email/` held
 * two templates, verification and password reset, and six of the eight
 * switches did nothing at all. That was the right call for a screen offering a
 * choice which changed nothing.
 *
 * The channel axis is back because the senders now exist — a digest for unread
 * messages, an evening streak mail for somebody with no phone signed in, a
 * weekly profile-visit summary, and a campaign script for promotions. Every
 * one of the eight cells reaches something that sends, and the settings screen
 * disables the email half until an address is verified, which is what stops
 * "a switch that does nothing" coming back.
 */
export const NOTIFICATION_TYPES = [
  'messages',
  'streak',
  'badges',
  'profileVisits',
  'promotions',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_CHANNELS = ['push', 'email'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export type ChannelPrefs = Record<NotificationChannel, boolean>
export type NotificationPrefs = Record<NotificationType, ChannelPrefs>

/**
 * What is actually on a profile, and it is three shapes at once.
 *
 * A `boolean` is a v1 account, one switch for everything. A bare boolean per
 * kind is what the app wrote while the channel axis was gone. A
 * `{push, email}` object is both the retired matrix and what this version
 * writes — byte-identical, and deliberately so: an account that recorded a
 * channel choice before keeps it, and there is no migration to run. All three
 * are live in production simultaneously, which is why `notificationsAllowed`
 * is the only thing allowed to read this field.
 */
export type StoredNotificationPrefs = Partial<
  Record<NotificationType, boolean | { push?: boolean; email?: boolean }>
>

/**
 * On for everything the app already does; **promotions off on both channels**.
 *
 * The last one is not a taste. Consent to be marketed at has to be given, not
 * withdrawn — GDPR calls a pre-ticked box no consent at all, and CAN-SPAM's
 * unsubscribe is the floor rather than the rule. So a new account is opted out
 * of promotions and opted in to the things it asked for by installing the app.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: { push: true, email: true },
  streak: { push: true, email: true },
  /*
   * Push on, email off. A badge is a small good thing that belongs on the
   * screen you earned it on; an unasked-for email about one is the kind of
   * mail people describe as spam even when they like the app. The switch is
   * real either way — turned on, the same words arrive by mail for somebody
   * with no phone signed in.
   */
  badges: { push: true, email: false },
  profileVisits: { push: true, email: true },
  promotions: { push: false, email: false },
}

/**
 * Partial at both levels, like `privacy` in `updateProfileSchema` and for the
 * same reason: a client sending `{ messages: { email: false } }` must not have
 * to restate the other seven cells, and must not blank them by omission. The
 * repository writes each kind whole — see `updateProfile` for why a dotted
 * path one level deeper cannot work.
 */
const channelPrefsSchema = z.object({ push: z.boolean(), email: z.boolean() }).partial()
export const notificationPrefsSchema = z
  .object({
    messages: channelPrefsSchema,
    streak: channelPrefsSchema,
    badges: channelPrefsSchema,
    profileVisits: channelPrefsSchema,
    promotions: channelPrefsSchema,
  })
  .partial()
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>

/**
 * Whether one notification may be sent on one channel.
 *
 * `channel` is required rather than defaulting to push, so that adding it
 * made the compiler point at every existing call site instead of leaving one
 * of them silently asking a question it no longer meant.
 *
 * Missing means default: profiles written before this existed carry a boolean,
 * a bare boolean per kind, or nothing at all, and none of those should be read
 * as "wants nothing". The one thing that is never inferred is a promotion —
 * absent stays off, on both channels, because consent is the thing that has to
 * be recorded.
 */
export function notificationsAllowed(
  prefs: StoredNotificationPrefs | boolean | undefined,
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  // The oldest shape: one switch for everything. `false` meant silence, and it
  // still does; `true` means the defaults, which keeps promotions off.
  if (typeof prefs === 'boolean') {
    return prefs ? DEFAULT_NOTIFICATION_PREFS[type][channel] : false
  }

  const chosen = prefs?.[type]

  /*
   * The bare boolean per kind, from the months when the channel axis was gone.
   *
   * Push reads it literally: push was the only channel with a sender, so the
   * switch was in practice a push switch and a `true` on promotions is a real
   * decision to be pushed at. Email cannot read it the same way. Nobody was
   * shown an email option, so a `true` here consented to nothing about mail —
   * it falls to the default, which is on for the three service kinds and off
   * for promotions. `false` still means silence on both.
   */
  if (typeof chosen === 'boolean') {
    if (channel === 'push') return chosen
    return chosen && DEFAULT_NOTIFICATION_PREFS[type].email
  }

  /*
   * The object shape: the retired matrix and today's writes, indistinguishable
   * from each other.
   *
   * Both halves are read literally now. While no email sender existed, reading
   * `email` would have been reading a preference filed against nothing, and
   * the reader collapsed the object to its `push` half. Now that a message
   * digest and three other senders exist, a recorded `email: false` is
   * somebody having turned mail off, and ignoring it would be the one
   * migration mistake a user notices. The matrix lived for hours on a build
   * that reached no store, so the number of accounts whose `email` value
   * predates a sender is small enough to check by hand — and a stray
   * `promotions.email: true` is unset before this ships rather than reasoned
   * about here.
   */
  if (chosen && typeof chosen === 'object') {
    return chosen[channel] ?? DEFAULT_NOTIFICATION_PREFS[type][channel]
  }

  return DEFAULT_NOTIFICATION_PREFS[type][channel]
}

/**
 * The whole eight-cell matrix, with every stored shape already resolved.
 *
 * The settings screen needs all eight to draw its switches, and `updateProfile`
 * needs the four it is not touching to leave them alone — both would otherwise
 * write their own loop over `notificationsAllowed` and one of them would
 * eventually forget a kind.
 */
export function resolveNotificationPrefs(
  prefs: StoredNotificationPrefs | boolean | undefined,
): NotificationPrefs {
  const resolved = {} as NotificationPrefs
  for (const type of NOTIFICATION_TYPES) {
    resolved[type] = {
      push: notificationsAllowed(prefs, type, 'push'),
      email: notificationsAllowed(prefs, type, 'email'),
    }
  }
  return resolved
}

/**
 * How long somebody has to have been gone before unread mail is worth sending.
 *
 * Eight hours rather than one: the point is a person who is not going to see
 * the message today, and anything shorter competes with the push that already
 * went to their phone. Long enough to have slept through it, short enough that
 * the answer is still useful.
 */
export const UNREAD_DIGEST_AWAY_HOURS = 8

/**
 * And the far end. Somebody gone a fortnight has had their one digest; mailing
 * them again is not a reminder, it is a campaign, and there is a separate
 * switch for those.
 */
export const UNREAD_DIGEST_MAX_AWAY_DAYS = 14

/** Named in the digest before it says "and N more". */
export const UNREAD_DIGEST_MAX_SENDERS = 3

/**
 * The window a notification email may be sent in, on the reader's own clock.
 *
 * A push is a phone buzzing and is worth an exact hour; an email is read
 * whenever the inbox is opened. But a phone shows mail too, and a 3am arrival
 * is the same buzz — so the send is fenced into waking hours rather than
 * fired the moment the condition is met.
 */
export const NOTIFICATION_EMAIL_LOCAL_HOURS = { earliest: 9, latest: 21 } as const
