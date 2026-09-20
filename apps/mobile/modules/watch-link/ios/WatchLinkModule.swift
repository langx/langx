import ExpoModulesCore
import WatchConnectivity

/**
 The app's half of the watch contract.

 Deliberately dumb, the same way `CompanionSnapshotModule` is: it takes a JSON
 string `buildWatchPayload` already produced and hands it over as-is. The shape
 is defined once, in `packages/shared/src/watch.ts`, and a second definition in
 Swift would be free to drift from it. What this file knows is *where* the blob
 goes, not what is in it.

 `OnCreate` is what makes the reply path work at all. When the watch sends a
 message to a phone whose app is closed, iOS launches the app in the
 background — and only delivers the message once a `WCSession` has a delegate.
 The module registry is built during launch, before any screen, which makes
 this the earliest hook the app has.
 */
public class WatchLinkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchLink")

    OnCreate {
      PhoneSession.shared.activate()
    }

    /**
     Whether there is anything to talk to.

     False on an iPad, on the simulator without a paired watch, and on a phone
     whose owner has none — which is most of them. The caller uses it to skip
     building a payload nobody will read, not to decide what to draw.
     */
    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    Function("send") { (json: String) in
      PhoneSession.shared.send(json)
    }

    /**
     Sign-out. Empties the watch and takes the cookie away in one call,
     because doing one without the other is the bug: an emptied watch that
     could still send, or a watch still listing the previous account's
     threads.
     */
    Function("clear") {
      WatchCredentials.clear()
      PhoneSession.shared.clear()
    }

    /**
     Hand Swift what it needs to send a reply with no JavaScript running.

     Called on sign-in and whenever the cookie is refreshed. The alternative —
     asking JavaScript for it when a reply arrives — is the thing that cannot
     work: the app is woken in the background with seconds to spare, and
     waiting for a React runtime to reach the point where it can answer is how
     the reply times out on somebody's wrist.
     */
    Function("setCredentials") { (baseUrl: String, cookie: String) in
      WatchCredentials.save(baseUrl: baseUrl, cookie: cookie)
    }
  }
}
