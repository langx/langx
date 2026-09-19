import SwiftUI
import WidgetKit

/*
 The widgets read `CompanionSnapshot` (targets/_shared) and nothing else. No
 network call, no session, no second credential — see the note on the schema in
 `packages/shared/src/companion.ts` for why that is the whole design and not a
 shortcut.
 */

// MARK: - Palette

/// The three from `src/lib/theme/tokens.ts`, written out because an extension
/// cannot import the app's tokens. Dark-scheme values: a widget draws on the
/// wallpaper, and these have to hold against a photograph rather than a page.
private enum Brand {
  static let streak = Color(red: 1.0, green: 0.663, blue: 0.239) // #ffa93d
  static let accent = Color(red: 0.486, green: 0.612, blue: 0.976) // #7c9cf9
  static let primary = Color(red: 1.0, green: 0.769, blue: 0.035) // #ffc409
}

// MARK: - Timeline

struct CompanionEntry: TimelineEntry {
  /**
   The moment this entry stands for — and the only clock the views below may
   read.

   WidgetKit renders an entry *before* its date arrives and shows the finished
   image when the moment comes, so `Date()` inside a view body is the time the
   drawing happened, not the time it is seen. Asking it whether today has
   counted would answer for the evening the midnight entry was drawn in, and
   the streak would still read solid at one in the morning — the entry at
   midnight would exist, wake the widget, and change nothing.
   */
  let date: Date
  let snapshot: CompanionSnapshot?
}

struct CompanionProvider: TimelineProvider {
  func placeholder(in context: Context) -> CompanionEntry {
    CompanionEntry(date: Date(), snapshot: CompanionSnapshot.load())
  }

  func getSnapshot(in context: Context, completion: @escaping (CompanionEntry) -> Void) {
    completion(CompanionEntry(date: Date(), snapshot: CompanionSnapshot.load()))
  }

  /**
   Three entries, and the two extra ones are the whole point.

   The app reloads these timelines whenever it writes, so anything the person
   does in the app is on the Home Screen at once. What the app cannot do is
   wake at midnight to say that today has stopped counting — so the timeline
   carries an entry at the next local midnight, and one at 20:00, the hour
   `STREAK_REMINDER_LOCAL_HOUR` sends the evening nudge. Same blob, redrawn
   against a day that has moved on; no refresh budget is spent on polling.
   */
  func getTimeline(in context: Context, completion: @escaping (Timeline<CompanionEntry>) -> Void) {
    let snapshot = CompanionSnapshot.load()
    let now = Date()
    let calendar = Calendar.current
    let midnight = calendar.nextDate(
      after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime)
    let evening = calendar.nextDate(
      after: now, matching: DateComponents(hour: 20, minute: 0), matchingPolicy: .nextTime)

    var dates = [now]
    if let evening, let midnight, evening < midnight { dates.append(evening) }
    if let midnight { dates.append(midnight) }

    let entries = dates.map { CompanionEntry(date: $0, snapshot: snapshot) }
    let next = midnight.map { $0.addingTimeInterval(60) } ?? now.addingTimeInterval(60 * 60)
    completion(Timeline(entries: entries, policy: .after(next)))
  }
}

// MARK: - Pieces

/// What every family draws when there is no snapshot: signed out, or an app
/// that has not been opened since the widget was added. The mark and nothing
/// else — a number here would be a claim we cannot make, and a sentence here
/// would be the one untranslated string in an app that speaks eight languages.
private struct EmptyState: View {
  var body: some View {
    Image("WidgetIcon")
      .resizable()
      .aspectRatio(contentMode: .fit)
      .frame(maxWidth: 44, maxHeight: 44)
      .opacity(0.55)
  }
}

private struct Tile: View {
  let value: Int
  let label: String
  let tint: Color

  var body: some View {
    VStack(spacing: 2) {
      Text("\(value)")
        .font(.system(size: 26, weight: .bold, design: .rounded))
        .foregroundStyle(tint)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
      Text(label)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity)
  }
}

/// The streak number, dimmed until the day counts. The dimming is the whole
/// "today has not counted yet" state: it needs no words, so it needs no
/// catalogue, and it is read at a glance rather than parsed.
private struct StreakMark: View {
  let snapshot: CompanionSnapshot
  /// The moment this entry stands for. See `CompanionEntry`.
  let now: Date
  var size: CGFloat = 34

  var body: some View {
    let counted = snapshot.countedToday(now: now)
    VStack(spacing: 2) {
      Text("\(snapshot.streak.current)")
        .font(.system(size: size, weight: .bold, design: .rounded))
        .foregroundStyle(Brand.streak)
        .opacity(counted ? 1 : 0.45)
        .minimumScaleFactor(0.5)
        .lineLimit(1)
      Text(snapshot.labels.streak)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
  }
}

// MARK: - Families

private struct SmallView: View {
  let snapshot: CompanionSnapshot?
  let now: Date

  var body: some View {
    Group {
      if let snapshot {
        StreakMark(snapshot: snapshot, now: now)
      } else {
        EmptyState()
      }
    }
    .widgetURL(URL(string: "langx:///me"))
  }
}

private struct MediumView: View {
  let snapshot: CompanionSnapshot?
  let now: Date

  var body: some View {
    Group {
      if let snapshot {
        HStack(spacing: 10) {
          /*
           Each tile is its own link rather than the whole widget being one:
           the three numbers answer three different questions, and tapping
           "unread" to land on a streak page is the kind of small lie that
           makes people stop tapping widgets.
           */
          Link(destination: URL(string: "langx:///me")!) {
            Tile(
              value: snapshot.streak.current, label: snapshot.labels.streak,
              tint: snapshot.countedToday(now: now) ? Brand.streak : Brand.streak.opacity(0.45))
          }
          Link(destination: URL(string: "langx:///chats")!) {
            Tile(value: snapshot.unread, label: snapshot.labels.unread, tint: Brand.accent)
          }
          Link(destination: URL(string: "langx:///echo")!) {
            Tile(value: snapshot.echo.due, label: snapshot.labels.cardsDue, tint: Brand.primary)
          }
        }
      } else {
        EmptyState()
      }
    }
  }
}

private struct CircularView: View {
  let snapshot: CompanionSnapshot?
  let now: Date

  var body: some View {
    Group {
      if let snapshot {
        Gauge(value: snapshot.countedToday(now: now) ? 1 : 0) {
          Text("\(snapshot.streak.current)")
        }
        .gaugeStyle(.accessoryCircularCapacity)
      } else {
        Image("WidgetIcon").resizable().aspectRatio(contentMode: .fit).padding(6)
      }
    }
    .widgetURL(URL(string: "langx:///me"))
  }
}

private struct RectangularView: View {
  let snapshot: CompanionSnapshot?

  var body: some View {
    Group {
      if let snapshot {
        VStack(alignment: .leading, spacing: 1) {
          Text("\(snapshot.streak.current) · \(snapshot.labels.streak)")
            .font(.headline)
            .lineLimit(1)
          Text("\(snapshot.unread) · \(snapshot.labels.unread)")
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      } else {
        EmptyState()
      }
    }
    .widgetURL(URL(string: "langx:///chats"))
  }
}

// MARK: - Widgets

struct LangXStreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LangXStreakWidget", provider: CompanionProvider()) { entry in
      SmallView(snapshot: entry.snapshot, now: entry.date)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("LangX")
    .supportedFamilies([.systemSmall])
  }
}

struct LangXSummaryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LangXSummaryWidget", provider: CompanionProvider()) { entry in
      MediumView(snapshot: entry.snapshot, now: entry.date)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("LangX")
    .supportedFamilies([.systemMedium])
  }
}

/// The Lock Screen and StandBy pair. These two views are the ones Phase 2
/// reuses as watch complications, which is why they are written narrow and
/// wordy-free rather than as small copies of the Home Screen ones.
struct LangXAccessoryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LangXAccessoryWidget", provider: CompanionProvider()) { entry in
      AccessoryRouter(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("LangX")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}

private struct AccessoryRouter: View {
  @Environment(\.widgetFamily) private var family
  let entry: CompanionEntry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      RectangularView(snapshot: entry.snapshot)
    default:
      CircularView(snapshot: entry.snapshot, now: entry.date)
    }
  }
}

@main
struct LangXWidgets: WidgetBundle {
  var body: some Widget {
    LangXStreakWidget()
    LangXSummaryWidget()
    LangXAccessoryWidget()
  }
}
