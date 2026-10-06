import AVFoundation
import ExpoModulesCore

/**
 * What JavaScript can ask of the call's native half on iOS — the same
 * surface as Android's `CallsModule`, so `nativeBridge.ts` has one shape to
 * talk to. The work is in `CallCenter`.
 */
public class CallsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Calls")

    /** `{ type: 'pending' | 'declined' | 'hangUp' | 'audioActivated' | 'audioDeactivated' | 'voipToken', callId? }` */
    Events("onCallAction")

    OnCreate {
      CallCenter.shared.listener = { [weak self] type, callId in
        self?.sendEvent("onCallAction", ["type": type, "callId": callId as Any])
      }
    }
    OnDestroy { CallCenter.shared.listener = nil }

    Function("configure") { (baseUrl: String) in CallCenter.shared.baseUrl = baseUrl }

    Function("takePendingAction") { () -> [String: Any]? in CallCenter.shared.takePending() }

    Function("stopRinging") { (callId: String?) in CallCenter.shared.endRinging(callId: callId) }

    Function("startOngoing") { (_: String, _: Bool) in CallCenter.shared.markAnsweredInApp() }

    Function("stopOngoing") { CallCenter.shared.endCall() }

    Function("setSpeakerphone") { (on: Bool) in
      try? AVAudioSession.sharedInstance().overrideOutputAudioPort(on ? .speaker : .none)
    }

    /** The PushKit token and what to register it as, or `nil` before PushKit has answered. */
    Function("voipRegistration") { () -> [String: Any]? in CallCenter.shared.registration() }
  }
}

/** Starts PushKit when the app launches — the only moment it can be early enough. */
public class CallsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    CallCenter.shared.startPushKit()
    return true
  }
}
