import ExpoModulesCore

#if canImport(ActivityKit)
  import ActivityKit
#endif

/**
 The app's half of the agreed-call Live Activity.

 Two writes for the whole life of a countdown: one when the call is booked and
 one when it is over. Nothing ticks here — `ExchangeLiveActivity.swift` draws
 `Text(timerInterval:)`, which the system counts on its own clock, so an
 activity costs nothing while it runs and does not need the app to be awake.

 **Why the conversation is the identity.** ActivityKit hands back an opaque id
 that would have to be stored somewhere and would go stale the moment the app
 was reinstalled or force-quit. A person has at most one call with one other
 person at a time, so the thread it belongs to identifies it well enough, and
 the running activities are the source of truth rather than a list we keep.

 Guarded on 16.1, which is where ActivityKit begins, while the app supports
 15.1. Below that every call here is a no-op: the person gets the app they
 already had and no countdown, which is the same thing that happens on a phone
 with Live Activities switched off.
 */
public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    /**
     Whether starting one would do anything.

     False on an old iOS, and false when the person has turned Live Activities
     off in Settings — which is a real answer, not an error. The caller uses it
     to skip the work rather than to show anything: nothing in this app tells
     somebody to switch a system setting back on.
     */
    Function("isSupported") { () -> Bool in
      #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
          let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
          /*
           Logged because the failure mode is silence, the same reason
           `WearLinkModule` logs its own support check: a false here makes
           every call below a no-op and the countdown simply never appears,
           with nothing anywhere to say whether the setting is off, the plist
           key is missing, or the module was never reached at all.
          */
          NSLog("[LiveActivity] areActivitiesEnabled=%@", enabled ? "true" : "false")
          return enabled
        }
        NSLog("[LiveActivity] unavailable: below iOS 16.1")
      #else
        NSLog("[LiveActivity] unavailable: no ActivityKit at build time")
      #endif
      return false
    }

    /**
     Start the countdown for a call, or move it if it has been rescheduled.

     `startsAt` and `endsAt` arrive as epoch seconds because that is what
     JavaScript has; the Date is made here so there is one conversion rather
     than a string format both sides have to agree on.

     The stale date is the start of the call, and it is doing real work: it is
     what makes the card change from counting towards the call to counting
     through it, with no second write and no push. See the view.
     */
    Function("start") {
      (conversationId: String, withName: String, startsAt: Double, endsAt: Double) -> Void in
      #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
          guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
          let state = ExchangeAttributes.ContentState(
            startsAt: Date(timeIntervalSince1970: startsAt),
            endsAt: Date(timeIntervalSince1970: endsAt))
          let content = ActivityContent(
            state: state, staleDate: Date(timeIntervalSince1970: startsAt))

          if let running = Self.activity(for: conversationId) {
            Task { await running.update(content) }
            return
          }

          let attributes = ExchangeAttributes(
            withName: withName, conversationId: conversationId)
          /*
           A failure here is ordinary rather than exceptional: iOS caps how
           many activities one app may run and refuses the rest. There is
           nothing for the person to do about it and nothing for the app to
           say, so it is logged rather than raised — the call still happens,
           it simply has no card on the Lock Screen.
          */
          do {
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
            NSLog("[LiveActivity] started for %@", conversationId)
          } catch {
            NSLog("[LiveActivity] refused: %@", String(describing: error))
          }
        }
      #endif
    }

    /**
     End one, immediately.

     `.immediate` rather than letting it linger: this is called when the call
     is over or has been called off, and a countdown to something that is not
     happening is worse than no countdown.
     */
    Function("end") { (conversationId: String) -> Void in
      #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
          guard let running = Self.activity(for: conversationId) else { return }
          Task { await running.end(nil, dismissalPolicy: .immediate) }
        }
      #endif
    }

    /// Sign-out, and the same reasoning as the widget blob: a card naming
    /// somebody must not outlive the session that knew who they were.
    Function("endAll") {
      #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
          for running in Activity<ExchangeAttributes>.activities {
            Task { await running.end(nil, dismissalPolicy: .immediate) }
          }
        }
      #endif
    }
  }

  #if canImport(ActivityKit)
    @available(iOS 16.1, *)
    private static func activity(for conversationId: String) -> Activity<ExchangeAttributes>? {
      Activity<ExchangeAttributes>.activities.first {
        $0.attributes.conversationId == conversationId
      }
    }
  #endif
}
