/**
 * Everything the **server** words for a user: two emails and one push
 * notification.
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
  },
} as const

export type ServerMessages = typeof en
