/**
 * The Siri messaging handler, which is what lets somebody answer from a car.
 *
 * SiriKit's messaging domain is handled by an **Intents extension** and not by
 * the app: `INSendMessageIntent` is delivered to `com.apple.intents-service`,
 * in its own process, while Siri is listening. That is Apple's arrangement
 * rather than a choice here, and it is the reason this target exists at all —
 * see `docs/plans/phase-3-carplay.md`.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'intent',
  name: 'LangXIntents',
  entitlements: {
    /*
     * The conversation list, which is how a spoken name becomes a thread.
     * Mirrored from `app.config.ts` the way the notification service mirrors
     * it: the group is the app's, and a target that reads the blob has to be
     * in it.
     */
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
    /*
     * The session cookie, which lives in the Keychain because it is a
     * credential rather than a count. An extension has its own container and
     * its own Keychain, so the one item both sides use has to name a group
     * they both hold. `$(AppIdentifierPrefix)` is the team, expanded by Xcode
     * — the literal string here would be the app id without the team and
     * would match nothing.
     */
    'keychain-access-groups': ['$(AppIdentifierPrefix)tech.newchapter.languageXchange'],
  },
  frameworks: ['Intents'],
  /*
   * 16.4, the app's own floor, for the reason the notification service gives:
   * the plugin's default is newer, and a target with a higher floor than the
   * app is simply absent on the phones below it — silently.
   */
  deploymentTarget: '16.4',
})
