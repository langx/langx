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
    meetingTitle: 'Your language exchange is in an hour',
    meetingBody: 'Tap to open the conversation.',
    bountyTitle: {
      one: '{count} token for your report 🎉',
      other: '{count} tokens for your report 🎉',
    },
    bountyBody: 'We read what you sent, and it was worth it.',
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Add a photo',
      addPhotoBody: 'Profiles with a face get far more replies.',
      streakBrokeTitle: {
        one: 'Your {count}-day streak broke',
        other: 'Your {count}-day streak broke',
      },
      streakBrokeBody: 'A repair puts yesterday back.',
      awayTitle: 'People are still here',
      awayBody: 'New people to practise with.',
      awayLongTitle: 'Still here when you are',
      awayLongBody: 'Your streak and tokens are waiting.',
      tokensWaitingTitle: { one: '{count} token waiting', other: '{count} tokens waiting' },
      tokensWaitingBody: 'Open your wallet.',
      inviteFriendTitle: 'Invite a friend',
      inviteFriendBody: 'You both get tokens when they join.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Your payment did not go through',
    billingEndedTitle: 'Your plan has ended',
    billingBody: 'Tap to check your plan.',
    securityBody: 'Open LangX if this was not you.',
    securityBodyDevice: 'From {device}. Open LangX if this was not you.',
    security: {
      newSignInTitle: 'New sign-in to your account',
      passwordChangedTitle: 'Your password was changed',
      methodLinkedTitle: 'A sign-in method was added',
      methodUnlinkedTitle: 'A sign-in method was removed',
    },
  },

  email: {
    ignore: 'If you didn’t request this, you can ignore this email.',
    orPaste: 'Or paste this link: {url}',

    deleteSubject: 'Confirm you want to delete your LangX account',
    deletePreheader: 'One more step to delete your LangX account',
    deleteBody:
      'You asked to delete your LangX account. Confirm below and it will be scheduled for deletion — you have 30 days to change your mind by signing back in.',
    deleteButton: 'Delete my account',
    deleteText: 'Confirm deleting your LangX account: {url}',
    deleteInvalid: 'This link has expired or has already been used.',
    deleteConfirmTitle: 'Delete your LangX account',
    deleteConfirmBody:
      'This schedules your account for deletion. Signing back in within 30 days cancels it.',
    deleteConfirmButton: 'Yes, delete my account',
    deleteDoneTitle: 'Your account is scheduled for deletion',
    deleteDoneBody: 'Sign back in within {days} days and everything comes back.',
    deleteDonePurge: 'The data is removed on {date}.',

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
    magicLinkSubject: 'Your LangX sign-in link',
    magicLinkPreheader: 'Tap to sign in to LangX',
    magicLinkBody: 'Tap the button to sign in. The link works once and expires in 15 minutes.',
    magicLinkButton: 'Sign in to LangX',
    magicLinkText: 'Sign in to LangX (works once, expires in 15 minutes): {url}',

    existingSubject: 'You already have a LangX account',
    existingPreheader: 'You already have a LangX account',
    existingBody:
      'Someone tried to sign up with this email, but an account already exists for it. To get in, reset your password, or sign in with Google or Apple using this address.',
    existingButton: 'Reset password',
    existingText: 'You already have a LangX account. Reset your password here: {url}',

    /*
     * The same news for an account with no password behind it — a v1 row
     * `legacyPrecreate.ts` opened. Carries a sign-in link, because "reset your
     * password" is strange advice for a password that was never set.
     */
    existingLinkBody:
      'Someone tried to sign up with this email, but you already have an account here, with your profile on it. Tap to sign in — there is no password to remember. The link works once and expires in 15 minutes.',
    existingLinkText:
      'You already have a LangX account. Sign in here (works once, expires in 15 minutes): {url}',

    /*
     * The footer every notification email carries, and the page its link
     * leads to. Not the same as `ignore` above: this mail was asked for, so it
     * says why it came and how to stop it rather than how to disregard it.
     */
    whyThisMail: 'You’re getting this because of your LangX notification settings.',
    unsubscribeLink: 'Turn these emails off',
    unsubscribeText: 'Turn these emails off: {url}',
    managePrefs: 'All notification settings',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Get the app',
    getAppScan: 'Scan with your phone, or open',
    getAppPlatforms: 'iPhone · Android · Browser',
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

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Add a photo, and people will find you',

      addPhotoBody:
        'Profiles with a face get far more replies. It takes ten seconds and you can change it whenever you like.',

      addPhotoButton: 'Add my photo',

      streakBrokeSubject: {
        one: 'Your {count}-day streak broke',
        other: 'Your {count}-day streak broke',
      },

      streakBrokeBody:
        'You missed yesterday. A repair from the store puts the day back and the streak carries on.',

      streakBrokeButton: 'Repair yesterday',

      awaySubject: 'People are still practising without you',

      awayBody:
        'It has been a week. There are new people to talk to, and your languages have not changed.',

      awayButton: 'See who is here',

      awayLongSubject: 'We will stop writing after this',

      awayLongBody:
        'A month is a long time. Your account, your streak and your tokens are all still here if you want them — and this is the last we will say about it.',

      awayLongButton: 'Open LangX',

      tokensWaitingSubject: {
        one: 'You have {count} token waiting',
        other: 'You have {count} tokens waiting',
      },

      tokensWaitingBody:
        'Tokens buy streak freezes, day repairs, frames and titles. Yours have been sitting there a fortnight.',

      tokensWaitingButton: 'Open my wallet',

      inviteFriendSubject: 'Practising is better with someone you know',

      inviteFriendBody:
        'Invite a friend and you both get tokens when they join. Your invite link is in Settings.',

      inviteFriendButton: 'Get my invite link',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'Welcome to LangX',

    welcomePreheader: 'Your first conversation is a tap away',

    welcomeTitle: 'Welcome, {name}',

    welcomeBody: 'Your profile is live at @{handle}. Here is what people do first:',

    welcomeStep1: 'Find someone who speaks what you are learning, and say hello.',

    welcomeStep2: 'Post a sentence to the Feed and let people correct it.',

    welcomeStep3: 'Come back tomorrow — two days in a row starts a streak.',

    welcomeButton: 'Find someone to practise with',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'Confirm your email address',

    verifyReminderPreheader: 'One tap and your account is ready',

    verifyReminderBody:
      'Your LangX account is waiting for one thing: proof that this address is yours. The link below does it.',

    verifyReminderText: 'Confirm your email address: {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Plan: {tier}',

    billing: {
      paymentFailedTitle: 'Your LangX payment did not go through',

      paymentFailedBody:
        'The store could not take the payment for your subscription. It will try again, and your plan stays active in the meantime.',

      paymentFailedButton: 'Check my plan',

      planEndedTitle: 'Your LangX plan has ended',

      planEndedBody:
        'Your subscription has ended and your account is back on the free plan. Everything you made is still there.',

      planEndedButton: 'See the plans',
    },

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Device',

    securityPlace: 'Place',

    securityWhen: 'When',

    securityNotYou:
      "If this wasn't you, change your password now — it signs out every other device.",

    securityButton: 'Change my password',

    security: {
      newSignInTitle: 'New sign-in to your LangX account',

      newSignInBody: 'Somebody signed in to your account from a device we have not seen before.',

      passwordChangedTitle: 'Your LangX password was changed',

      passwordChangedBody: 'The password on your account was just changed.',

      methodLinkedTitle: 'A sign-in method was added to your LangX account',

      methodLinkedBody: 'Google or Apple sign-in was connected to your account.',

      methodUnlinkedTitle: 'A sign-in method was removed from your LangX account',

      methodUnlinkedBody: 'A way of signing in to your account was disconnected.',
    },

    /** Named in the sentence above, so they read as objects, not headings. */
    kind: {
      messages: 'message summaries',
      streak: 'streak reminders',
      profileVisits: 'profile-visit summaries',
      promotions: 'news and offers',
      all: 'email from LangX',
      v1contact: 'the one message about the new LangX',
    },
    bountySubject: {
      one: 'You earned {count} token for your report',
      other: 'You earned {count} tokens for your report',
    },
    bountyPreheader: 'Thank you for telling us.',
    bountyBody: {
      one: 'We read what you sent and added {count} token to your wallet. Reports like yours are how this app gets fixed — thank you.',
      other:
        'We read what you sent and added {count} tokens to your wallet. Reports like yours are how this app gets fixed — thank you.',
    },
    bountyButton: 'Open my wallet',
    bountyText: {
      one: '{count} token has been added to your wallet for the report you sent: {url}',
      other: '{count} tokens have been added to your wallet for the report you sent: {url}',
    },
  },
} as const

export type ServerMessages = typeof en
