import AVFoundation
import CallKit
import Foundation
import PushKit
import StoreKit

/**
 * An iPhone being rung: PushKit to be woken, CallKit to ring.
 *
 * **Every VoIP push ends in a reported call.** iOS stops delivering VoIP
 * pushes to an app that receives one and does not hand CallKit a call, which
 * is why the API sends them only to ring (`voipPush.ts`), and why a malformed
 * one here is still reported — and ended in the same breath — rather than
 * dropped.
 *
 * **The system's ring is the only ring.** With the app in front, the socket
 * puts LangX's own call screen up as well; the two are kept in step from
 * JavaScript: answering in the app tells CallKit the call was answered,
 * turning it down or the caller giving up ends CallKit's call.
 *
 * **Not in China.** CallKit is not allowed on the App Store there, and App
 * Review rejected 2.9 twice for it even though PushKit was already skipped,
 * so the rule is now one decision with two doors behind it. `callKitAllowed`
 * is settled once, in `init`, and never reconsidered while the app runs. When
 * it is false, `startPushKit` creates no registry, so no VoIP push can
 * arrive, and `reportIncoming` — the only place a `Call` is ever made — is
 * shut as well. `provider` and `controller` are `lazy` and every use of them
 * needs a `Call`, so on such a phone no CallKit object is ever created. The
 * phone registers `callKit: false` and is rung by the ordinary notification
 * the API sends to phones without a VoIP token, and the call screen is the
 * app's own. The Intents extension reads the same decision from the App
 * Group and refuses Siri's "call" there too (`CallingHandler`).
 * `callKitChina.test.ts` holds this file to that shape.
 */
final class CallCenter: NSObject {
  static let shared = CallCenter()

  var listener: ((String, String?) -> Void)?

  /** The API's address, kept for Decline on a phone where nothing else has started. */
  var baseUrl: String? {
    get { UserDefaults.standard.string(forKey: "langx.calls.baseUrl") }
    set { UserDefaults.standard.set(newValue, forKey: "langx.calls.baseUrl") }
  }

  private(set) var voipToken: String?
  private var registry: PKPushRegistry?
  private lazy var controller = CXCallController()
  private lazy var provider: CXProvider = {
    let configuration = CXProviderConfiguration()
    configuration.supportsVideo = true
    configuration.maximumCallGroups = 1
    configuration.maximumCallsPerCallGroup = 1
    configuration.supportedHandleTypes = [.generic]
    // A practice call with somebody met in an app is not a contact, and the
    // phone's Recents is where people look for the ones that are.
    configuration.includesCallsInRecents = false
    let provider = CXProvider(configuration: configuration)
    provider.setDelegate(self, queue: nil)
    return provider
  }()

  private struct Call {
    let uuid: UUID
    let callId: String
    let token: String
    var answered: Bool
  }

  private var call: Call?
  private var pending: (callId: String, answer: Bool)?
  private var answeringInApp = false
  private var ringTimeout: DispatchWorkItem?

  // MARK: - China

  /// Must match `app.config.ts` and `CompanionSnapshot.appGroup`.
  private static let appGroup = "group.tech.newchapter.languageXchange"
  /// Read by the Intents extension's `CallingHandler`; must match it.
  private static let allowedKey = "callKitAllowed"
  /// The last storefront this phone was seen in, for a launch that cannot ask.
  private static let storefrontKey = "callKitStorefront"

  let callKitAllowed: Bool

  override init() {
    let defaults = UserDefaults(suiteName: Self.appGroup)
    let known = SKPaymentQueue.default().storefront?.countryCode
    if let known { defaults?.set(known, forKey: Self.storefrontKey) }
    let storefront = known ?? defaults?.string(forKey: Self.storefrontKey)
    let region = Locale.current.regionCode
    callKitAllowed = Self.allows(storefront: storefront, region: region)
    super.init()
    defaults?.set(callKitAllowed, forKey: Self.allowedKey)
    NSLog(
      "[Calls] CallKit %@ (storefront %@, region %@)", callKitAllowed ? "on" : "off",
      storefront ?? "unknown", region ?? "unknown")
    if known == nil { learnStorefront() }
  }

  /**
   * A storefront nobody knows yet counts as China's: the cost is one launch
   * rung by notification, against CallKit running on the one storefront
   * where it must not.
   */
  static func allows(storefront: String?, region: String?) -> Bool {
    guard let storefront else { return false }
    return storefront != "CHN" && region != "CN"
  }

  /** StoreKit 1 can answer nil this early; StoreKit 2 asks, for the next launch. */
  private func learnStorefront() {
    Task {
      guard let code = await Storefront.current?.countryCode else { return }
      UserDefaults(suiteName: Self.appGroup)?.set(code, forKey: Self.storefrontKey)
    }
  }

  // MARK: - Registration

  /** Development builds get their tokens from Apple's sandbox, store builds from production. */
  private var environment: String {
    #if DEBUG
      return "sandbox"
    #else
      return "production"
    #endif
  }

  func startPushKit() {
    guard callKitAllowed, registry == nil else { return }
    let registry = PKPushRegistry(queue: .main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    self.registry = registry
  }

  func registration() -> [String: Any]? {
    if !callKitAllowed { return ["callKit": false, "apnsEnvironment": environment] }
    guard let voipToken else { return nil }
    return ["voipToken": voipToken, "apnsEnvironment": environment, "callKit": true]
  }

  // MARK: - JavaScript's side

  func takePending() -> [String: Any]? {
    guard let pending else { return nil }
    self.pending = nil
    return ["callId": pending.callId, "answer": pending.answer]
  }

  /** The app put the call up and the person answered it there: CallKit hears so. */
  func markAnsweredInApp() {
    guard let call, !call.answered else { return }
    answeringInApp = true
    controller.request(CXTransaction(action: CXAnswerCallAction(call: call.uuid))) { [weak self] error in
      if error != nil { self?.answeringInApp = false }
    }
  }

  /** The ring is over without an answer here — turned down in the app, or given up on. */
  func endRinging(callId: String?) {
    guard let call, !call.answered, callId == nil || callId == call.callId else { return }
    finish(reason: .remoteEnded)
  }

  /** The call is over. Said to CallKit as an ending, which asks nothing back. */
  func endCall() {
    guard call != nil else { return }
    finish(reason: .remoteEnded)
  }

  private func finish(reason: CXCallEndedReason) {
    guard let call else { return }
    ringTimeout?.cancel()
    ringTimeout = nil
    provider.reportCall(with: call.uuid, endedAt: Date(), reason: reason)
    self.call = nil
  }

  // MARK: - Ringing

  fileprivate func reportIncoming(_ data: [String: Any], completion: @escaping () -> Void) {
    // Unreachable without a registry, which `startPushKit` never makes here.
    // Shut anyway: this is where a `Call` is made, and so CallKit's one door.
    guard callKitAllowed else {
      completion()
      return
    }
    guard let callId = data["callId"] as? String, let uuid = UUID(uuidString: callId) else {
      // Malformed, but iOS still has to be shown a call. Show one and end it.
      let uuid = UUID()
      provider.reportNewIncomingCall(with: uuid, update: CXCallUpdate()) { [weak self] _ in
        self?.provider.reportCall(with: uuid, endedAt: Date(), reason: .failed)
        completion()
      }
      return
    }
    if call?.callId == callId {
      completion()
      return
    }

    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type: .generic, value: (data["callerHandle"] as? String) ?? callId)
    update.localizedCallerName = data["callerName"] as? String
    update.hasVideo = (data["media"] as? String) == "video"
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = false

    call = Call(uuid: uuid, callId: callId, token: (data["callToken"] as? String) ?? "", answered: false)
    provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
      // Refused — Do Not Disturb, another call, a blocked caller. Nothing rings.
      if error != nil { self?.call = nil }
      completion()
    }

    // The server ends an unanswered ring; this is for a phone that never hears it.
    let seconds = (data["ringSeconds"] as? Int) ?? 45
    ringTimeout?.cancel()
    let timeout = DispatchWorkItem { [weak self] in
      guard let self, let call = self.call, call.callId == callId, !call.answered else { return }
      self.finish(reason: .unanswered)
    }
    ringTimeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds + 5), execute: timeout)
  }

  private func decline(callId: String, token: String) {
    guard let baseUrl, let url = URL(string: "\(baseUrl)/calls/\(callId)/decline") else { return }
    var request = URLRequest(url: url, timeoutInterval: 8)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(token, forHTTPHeaderField: "x-call-token")
    request.httpBody = Data("{}".utf8)
    URLSession.shared.dataTask(with: request).resume()
  }

  fileprivate func emit(_ type: String, _ callId: String? = nil) {
    listener?(type, callId)
  }
}

extension CallCenter: PKPushRegistryDelegate {
  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    voipToken = credentials.token.map { String(format: "%02x", $0) }.joined()
    emit("voipToken")
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    voipToken = nil
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let data = (payload.dictionaryPayload["langx"] as? [String: Any]) ?? [:]
    reportIncoming(data, completion: completion)
  }
}

extension CallCenter: CXProviderDelegate {
  func providerDidReset(_ provider: CXProvider) {
    call = nil
    ringTimeout?.cancel()
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard var call, call.uuid == action.callUUID else {
      action.fail()
      return
    }
    call.answered = true
    self.call = call
    ringTimeout?.cancel()
    if answeringInApp {
      answeringInApp = false
    } else {
      // Answered on the system's screen. JavaScript answers it for real.
      pending = (call.callId, true)
      emit("pending", call.callId)
    }
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    guard let call, call.uuid == action.callUUID else {
      action.fulfill()
      return
    }
    ringTimeout?.cancel()
    if call.answered {
      emit("hangUp", call.callId)
    } else {
      // Turned down before anything else ran: the ticket is enough to say so.
      decline(callId: call.callId, token: call.token)
      emit("declined", call.callId)
    }
    self.call = nil
    action.fulfill()
  }

  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    emit("audioActivated")
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    emit("audioDeactivated")
  }
}
