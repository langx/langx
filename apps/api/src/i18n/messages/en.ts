/**
 * Everything the **server** words for a user: the mail it sends and the
 * notifications it pushes.
 *
 * Deliberately not the app's catalogue. The two have almost nothing in common
 * — the app words screens, this words things that arrive when the app is
 * closed — and sharing one would mean shipping four hundred screen strings in
 * the API image to use six of them. What *is* shared is the engine in
 * `@langx/shared`, so both sides pluralise by the same rules.
 */
export const en = {
  push: {
    streakTitle: { one: '{count} day streak! 🔥', other: '{count} day streak! 🔥' },
    streakBody: 'Send one message today to keep it going.',
    profileVisitsTitle: {
      one: '1 person viewed your profile',
      other: '{count} people viewed your profile',
    },
    profileVisitsBody: 'Tap to see who.',
    badgeOneTitle: 'New badge: {label} 🏅',
    badgeManyTitle: { one: 'You earned 1 new badge 🏅', other: 'You earned {count} new badges 🏅' },
    badgeBody: 'Nice work. Keep it going.',
  },

  email: {
    ignore: 'If you didn’t request this, you can ignore this email.',
    orPaste: 'Or paste this link: {url}',

    verifySubject: 'Verify your LangX email',
    verifyPreheader: 'Verify your email to finish setting up LangX',
    verifyBody: 'Confirm this is your email address to finish setting up your account.',
    verifyButton: 'Verify email',
    verifyText: 'Verify your LangX email: {url}',

    resetSubject: 'Reset your LangX password',
    resetPreheader: 'Reset your LangX password',
    resetBody: 'Someone requested a password reset for this account. If that was you:',
    resetButton: 'Reset password',
    resetText: 'Reset your LangX password: {url}',

    /*
     * The footer every notification email carries, and the page its link
     * leads to. Not the same as `ignore` above: this mail was asked for, so it
     * says why it came and how to stop it rather than how to disregard it.
     */
    whyThisMail: 'You’re getting this because of your LangX notification settings.',
    unsubscribeLink: 'Turn these emails off',
    unsubscribeText: 'Turn these emails off: {url}',
    managePrefs: 'All notification settings',
    /** The one button a streak email has. */
    openChats: 'Send a message',

    digestSubject: { one: '1 unread message on LangX', other: '{count} unread messages on LangX' },
    digestPreheader: 'People are waiting to hear back from you',
    digestBody: {
      one: '{names} wrote to you while you were away.',
      other: 'You have {count} unread messages, from {names}.',
    },
    digestMore: { one: 'And 1 more conversation.', other: 'And {count} more conversations.' },
    digestButton: 'Read and reply',

    visitsSubject: {
      one: '1 person viewed your profile this week',
      other: '{count} people viewed your profile this week',
    },
    visitsPreheader: 'Your profile is getting attention',
    visitsBody: {
      one: '1 person looked at your profile in the last week.',
      other: '{count} people looked at your profile in the last week.',
    },
    visitsNames: 'Among them: {names}.',
    visitsLocked: 'Upgrade to see who they were.',
    visitsButton: 'See who viewed you',

    badgeOneSubject: 'New badge: {label}',
    badgeManySubject: { one: 'You earned 1 new badge', other: 'You earned {count} new badges' },
    badgeBody: 'It is on your profile now, for anyone who looks.',
    badgeButton: 'See your badges',

    unsubscribeTitle: 'Turn off these emails?',
    unsubscribeBody:
      'You will stop getting {kind} by email. Notifications on your phone are not affected.',
    unsubscribeConfirm: 'Turn them off',
    unsubscribeAll: 'Or turn off every LangX email',
    unsubscribedTitle: 'Done — no more of these.',
    unsubscribedBody: 'You can turn them back on any time in LangX under Settings → Notifications.',
    unsubscribeInvalid:
      'This link is not valid. Open LangX and change it under Settings → Notifications.',

    /** Named in the sentence above, so they read as objects, not headings. */
    kind: {
      messages: 'message summaries',
      streak: 'streak reminders',
      profileVisits: 'profile-visit summaries',
      promotions: 'news and offers',
      all: 'email from LangX',
    },
  },
} as const

export type ServerMessages = typeof en
