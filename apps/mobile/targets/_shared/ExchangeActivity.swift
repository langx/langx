import Foundation

#if canImport(ActivityKit)
  import ActivityKit

  /**
   The agreed call, while it is happening or about to.

   Declared here and compiled into **two** places — the widget extension that
   draws it and the local module that starts it — because ActivityKit matches
   a running activity to its view by the attributes type, and the two sides
   are separate Swift modules that cannot import each other. Two copies of one
   declaration is the shape Apple's own sample uses; what matters is that they
   stay identical, which is why there is one file rather than two.

   **What is in `ContentState` and what is not.** The name is an attribute,
   fixed for the life of the activity — a call does not change who it is with.
   The two dates are state, because a call can be moved. Nothing here is a
   number the phone has to keep updating: `Text(timerInterval:)` counts on the
   system's own clock, so a countdown costs one write at the start and one at
   the end, not one a second.
   */
  struct ExchangeAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
      let startsAt: Date
      let endsAt: Date
    }

    /// The other person, already resolved by the app — an extension has no
    /// way to look a profile up and must never learn one.
    let withName: String
    /// Where a tap goes. The same `langx://` spelling the widgets use.
    let conversationId: String
  }
#endif
