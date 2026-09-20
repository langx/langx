import SwiftUI
import WidgetKit

#if canImport(ActivityKit)
  import ActivityKit

  /**
   The Live Activity for an agreed call: the Lock Screen card and the Dynamic
   Island.

   **It counts without being told.** Every number here is
   `Text(timerInterval:)`, which the system ticks on its own — so the activity
   is written once when the call is booked and once when it ends, and nothing
   wakes the phone in between. That is also why the phone-driven activity
   could ship before the server-driven one in phase 7: nothing here needs a
   push.

   **The label changes without an update, too.** `isStale` is the mechanism:
   the app sets the stale date to the moment the call starts, so ActivityKit
   re-renders exactly then and the card switches from counting towards the
   call to counting through it. The alternative — the app scheduling a write
   for the start time — needs the app to be running at that moment, which is
   the one thing a countdown cannot assume.

   The yellow is not here. `MessageBubble.tsx`'s rule is that yellow is the
   committing action, once per screen, and a Live Activity has no action on
   it: it is a clock, and its only gesture is a tap that opens the thread.
   */
  struct ExchangeLiveActivity: Widget {
    var body: some WidgetConfiguration {
      ActivityConfiguration(for: ExchangeAttributes.self) { context in
        LockScreenCard(context: context)
          .activityBackgroundTint(Brand.ground)
          .activitySystemActionForegroundColor(Brand.primary)
      } dynamicIsland: { context in
        DynamicIsland {
          DynamicIslandExpandedRegion(.leading) {
            Mark()
          }
          DynamicIslandExpandedRegion(.trailing) {
            Countdown(context: context)
              .font(.system(size: 15, weight: .bold, design: .rounded))
          }
          DynamicIslandExpandedRegion(.center) {
            Text(context.attributes.withName)
              .font(.system(size: 15, weight: .bold, design: .rounded))
              .lineLimit(1)
          }
          DynamicIslandExpandedRegion(.bottom) {
            Label(context: context)
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        } compactLeading: {
          Mark()
        } compactTrailing: {
          Countdown(context: context)
            .font(.system(size: 13, weight: .bold, design: .rounded))
            /*
             The compact region is a few points wide and a countdown is the
             widest thing that could go in it. Without this the system
             truncates the minutes rather than the hours, which is the wrong
             end of the number to lose.
            */
            .frame(maxWidth: 52)
        } minimal: {
          Mark()
        }
        .widgetURL(URL(string: "langx:///chats/\(context.attributes.conversationId)"))
      }
    }
  }

  /// The mark, at the size every region here wants it.
  private struct Mark: View {
    var body: some View {
      Image("WidgetIcon")
        .resizable()
        .aspectRatio(contentMode: .fit)
        .frame(width: 16, height: 16)
    }
  }

  /**
   Before the call, time until it starts; during it, time until it ends.

   `isStale` rather than a comparison against `Date()`: a view body runs when
   the system decides to run it, so a date read here is the date of the last
   render and not of this second.
   */
  private struct Countdown: View {
    let context: ActivityViewContext<ExchangeAttributes>

    var body: some View {
      Text(
        timerInterval: Date.now...(context.isStale ? context.state.endsAt : context.state.startsAt),
        countsDown: true
      )
      .monospacedDigit()
    }
  }

  private struct Label: View {
    let context: ActivityViewContext<ExchangeAttributes>

    var body: some View {
      Text(context.isStale ? "widget.exchangeEndsIn" : "widget.exchangeStartsIn")
    }
  }

  private struct LockScreenCard: View {
    let context: ActivityViewContext<ExchangeAttributes>

    var body: some View {
      HStack(spacing: 10) {
        Mark()
        VStack(alignment: .leading, spacing: 1) {
          Text(context.attributes.withName)
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .lineLimit(1)
          Label(context: context)
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        Spacer(minLength: 8)
        Countdown(context: context)
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .frame(maxWidth: 96)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
    }
  }
#endif
