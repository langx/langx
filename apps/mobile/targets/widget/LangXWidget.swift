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
  /**
   `colors.fill` — the ground a tile sits on, one step up from the widget's own
   background so three numbers read as three things rather than a row.

   From the asset catalogue rather than written out like the three above,
   because this one has to follow the system appearance: the others are brand
   colours that hold on either ground, and a tile is a *surface*. Declared as a
   light/dark pair in `expo-target.config.js`.
  */
  static let fill = Color("tile")
  /// `colors.primaryText`, the ink that goes on yellow and nowhere else.
  static let primaryInk = Color(red: 0.125, green: 0.098, blue: 0.0) // #201900
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

/**
 One number and its word, on a ground of their own.

 The card is what makes the medium widget read as three answers rather than a
 sentence — see `docs/plans/iphone-watch-and-carplay/iphone.png`. It matters
 more here than it would in the app: a widget is read in a glance, against a
 photograph, and three numbers sharing one background merge into a row of
 digits at arm's length.
 */
private struct Tile: View {
  let value: Int
  let label: String
  let tint: Color

  var body: some View {
    VStack(spacing: 1) {
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
    .padding(.vertical, 10)
    .background(Brand.fill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

/**
 The mark and the name, above the numbers.

 Not decoration and not a title: a widget sits among other apps' widgets on
 somebody's wallpaper, and the one question a glance has to answer before the
 numbers mean anything is whose they are. `configurationDisplayName` answers it
 in the gallery, which is the one place the person is not looking.

 "LangX" is a proper noun, which is why it is written here rather than taken
 from a catalogue — the same reasoning as the Android widget's `label` in
 `app.config.ts`.
 */
private struct WidgetHeader: View {
  var body: some View {
    HStack(spacing: 6) {
      Image("WidgetIcon")
        .resizable()
        .aspectRatio(contentMode: .fit)
        .frame(width: 16, height: 16)
        .padding(3)
        .background(Brand.primary, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
      Text("LangX")
        .font(.system(size: 13, weight: .bold, design: .rounded))
        .foregroundStyle(.secondary)
      Spacer(minLength: 0)
    }
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
        VStack(alignment: .leading, spacing: 8) {
          WidgetHeader()
          HStack(spacing: 8) {
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
        }
      } else {
        EmptyState()
      }
    }
  }
}

/**
 Every day this person showed up, as a grid.

 The shape is `activityGrid`'s and is not recomputed here: which square is
 today and which week the last column stands for are exactly the two things
 that are invisible in a screenshot, so they are decided once, in
 `src/lib/activityMap.ts`, where there are tests. This side decodes and draws.

 A day that has not happened yet is a **gap**, not an empty square. The
 difference is the whole reason the encoding carries `.` — six blank boxes
 after today would read as six days missed, every single Monday.
 */
private struct ActivityView: View {
  let snapshot: CompanionSnapshot?
  let now: Date

  var body: some View {
    Group {
      if let snapshot, let activity = snapshot.activity, !activity.columns.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            WidgetHeader()
            Spacer(minLength: 0)
            Text("\(snapshot.streak.current)")
              .font(.system(size: 17, weight: .bold, design: .rounded))
              .foregroundStyle(
                snapshot.countedToday(now: now) ? Brand.streak : Brand.streak.opacity(0.45))
          }
          Grid(horizontalSpacing: 3, verticalSpacing: 3) {
            /*
             Rows are weekdays and columns are weeks, which is the calendar
             shape rather than a timeline: a gap on the same row every week
             says something a flat run of squares cannot. Seven `GridRow`s,
             each walking the columns, because SwiftUI lays a Grid out by rows
             and the encoding is by columns.
            */
            ForEach(0..<7, id: \.self) { row in
              GridRow {
                ForEach(Array(activity.columns.enumerated()), id: \.offset) { _, column in
                  Square(mark: column[row])
                }
              }
            }
          }
        }
      } else {
        EmptyState()
      }
    }
    .widgetURL(URL(string: "langx:///me"))
  }
}

private struct Square: View {
  let mark: Character

  var body: some View {
    RoundedRectangle(cornerRadius: 2, style: .continuous)
      .fill(colour)
      .aspectRatio(1, contentMode: .fit)
      // A future day keeps its space and draws nothing, so the grid stays a
      // rectangle and this week does not look shorter than the others.
      .opacity(mark == "." ? 0 : 1)
  }

  /**
   The four shades, and the empty square.

   `streak` at four strengths rather than four colours: the map answers one
   question — did you show up — and a second hue would invite reading a
   meaning into it that the shading does not carry. The empty square is `fill`,
   the same ground the tiles sit on, so a blank week reads as an absence rather
   than as a different kind of day.
  */
  private var colour: Color {
    switch mark {
    case "1": return Brand.streak.opacity(0.35)
    case "2": return Brand.streak.opacity(0.55)
    case "3": return Brand.streak.opacity(0.78)
    case "4": return Brand.streak
    default: return Brand.fill
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

/**
 The map on its own, as a medium widget.

 A separate family rather than a bigger `LangXSummaryWidget`, because it
 answers a different question. The summary says what is waiting; this says what
 you have done, and somebody who wants one usually does not want the other on
 the same screen.
 */
struct LangXActivityWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LangXActivityWidget", provider: CompanionProvider()) { entry in
      ActivityView(snapshot: entry.snapshot, now: entry.date)
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
    LangXActivityWidget()
    LangXAccessoryWidget()
  }
}
