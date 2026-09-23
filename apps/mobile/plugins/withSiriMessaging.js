const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins')

/**
 * The app's half of answering by voice.
 *
 * The handler itself is a target — `targets/intents/`, built by
 * `@bacons/apple-targets` — because SiriKit delivers `INSendMessageIntent` to
 * an Intents extension and not to the app. What cannot live there is what the
 * *app* has to declare for that extension to be reachable at all, and that is
 * the three edits below.
 *
 * **`com.apple.developer.siri`** is the capability. Without it the extension
 * ships, registers and is never asked anything, which looks exactly like a
 * Siri that does not understand the app. It also has to be switched on for
 * the App ID in the developer portal; see `docs/release-runbook.md`.
 *
 * **The Keychain group** is what lets the extension read the session cookie
 * the app already stores for the watch reply. A credential in a group is a
 * credential two processes can reach instead of one, which is a real
 * widening; it is the smallest one that works, and it replaces the bearer
 * token the plan had costed — the same session, in the same item, read by one
 * more process of ours.
 *
 * **`NSUserActivityTypes`** is how the app claims the intents in the places
 * that look at the app rather than the extension — Siri's "continue in app",
 * the Shortcuts app, and handoff. The extension's own `Info.plist` declares
 * the same three under `IntentsSupported`, and the two lists have to agree.
 */

/** Team-prefixed at build time: the literal would match nothing. */
const KEYCHAIN_GROUP = '$(AppIdentifierPrefix)tech.newchapter.languageXchange'

/**
 * Where Swift reads the group from, since `$(AppIdentifierPrefix)` is a build
 * variable and not something the code can know. Both plists carry the key;
 * `IntentSession` and `WatchCredentials` both read it.
 */
const KEYCHAIN_GROUP_KEY = 'LangXKeychainAccessGroup'

const INTENTS = ['INSendMessageIntent', 'INSearchForMessagesIntent', 'INSetMessageAttributeIntent']

const withSiriMessaging = (config) => {
  config = withEntitlementsPlist(config, (modConfig) => {
    modConfig.modResults['com.apple.developer.siri'] = true
    /*
     * Communication Notifications, so the notification service extension may
     * rebuild a message push from an `INSendMessageIntent` — the only kind of
     * notification Siri announces, which is how a message arriving mid-drive
     * is read aloud in the car. Without it `updating(from:)` throws and the
     * push arrives as a plain alert; nothing breaks, nothing is announced.
     */
    modConfig.modResults['com.apple.developer.usernotifications.communication'] = true

    const groups = new Set(modConfig.modResults['keychain-access-groups'] ?? [])
    groups.add(KEYCHAIN_GROUP)
    modConfig.modResults['keychain-access-groups'] = [...groups]
    return modConfig
  })

  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults[KEYCHAIN_GROUP_KEY] = KEYCHAIN_GROUP

    const activities = new Set(modConfig.modResults.NSUserActivityTypes ?? [])
    for (const intent of INTENTS) activities.add(intent)
    modConfig.modResults.NSUserActivityTypes = [...activities]
    return modConfig
  })
}

module.exports = withSiriMessaging
