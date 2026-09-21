import SwiftUI
import WidgetKit

/**
 The watch face complication: one number, and the wearer chose which one.

 **It reads a digest, not the payload.** The payload is names and sentences
 and can run to a few hundred kilobytes; a complication draws a glyph on a
 watch face. `WatchDigest` is the two numbers and the choice between them,
 written by the watch app into the group these two targets share. See that
 file for why the sharing has to work this way at all.

 **Three states, and the third is the one that matters.** A digest means a
 number. No digest means the phone has never spoken to this watch, or somebody
 signed out — and the honest face is the mark, not a zero. A zero is a claim,
 and on a watch face a wrong claim is worn all day.

 **No yellow.** `MessageBubble.tsx`'s rule is that yellow is the committing
 action, once per screen; a complication has no action on it. A watch face
 tints its complications itself through `widgetAccentable`, which is the
 system's way of saying the same thing — the wearer picked the colour, not us.
 */
struct LangXComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LangXComplication", provider: DigestProvider()) { entry in
      /*
       No `containerBackground`. It is watchOS 10, this target's floor is 9.0
       for the reason the watch app's config gives — Series 5, Series 4 and
       the first SE stop at watchOS 10 and stay paired for years — and an
       accessory family on a watch face has no container to paint anyway: the
       face supplies the backdrop and tints the content itself.
      */
      ComplicationView(digest: entry.digest)
        .widgetURL(URL(string: "langx:///chats"))
    }
    .configurationDisplayName(LocalizedStringResource("widget.glanceName"))
    .description(LocalizedStringResource("widget.faceDetail"))
    .supportedFamilies([
      .accessoryCircular,
      .accessoryCorner,
      .accessoryInline,
      .accessoryRectangular,
    ])
  }
}

struct DigestEntry: TimelineEntry {
  let date: Date
  let digest: WatchDigest?
}

/**
 One entry, and no schedule.

 Nothing here changes on a clock: the numbers move when the phone says so, and
 the watch app asks WidgetKit to reload when it writes. A timeline with future
 entries would be guessing, and `.never` is the honest policy for a value that
 arrives rather than elapses — it also spends none of the refresh budget a
 watch face shares between every complication on it.
 */
struct DigestProvider: TimelineProvider {
  func placeholder(in context: Context) -> DigestEntry {
    DigestEntry(date: Date(), digest: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (DigestEntry) -> Void) {
    completion(DigestEntry(date: Date(), digest: WatchDigest.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DigestEntry>) -> Void) {
    completion(Timeline(entries: [DigestEntry(date: Date(), digest: WatchDigest.load())], policy: .never))
  }
}

private struct ComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let digest: WatchDigest?

  /// What the wearer chose, falling back to what every payload carries. A
  /// digest that says `streak` while carrying none is not a contradiction —
  /// it is a watch that has been told the choice before it was told the
  /// number.
  private var value: Int? {
    guard let digest else { return nil }
    switch digest.shows {
    case .streak: return digest.streak ?? digest.unread
    case .unread: return digest.unread
    }
  }

  var body: some View {
    switch family {
    case .accessoryInline:
      // One line beside the time, and the only family with room for a word —
      // which it does not get: the app's name is the word, and it is already
      // the only thing that identifies whose number this is.
      Text(label)
    case .accessoryRectangular:
      HStack(spacing: 6) {
        Mark()
        Text(label)
          .font(.system(size: 15, weight: .semibold, design: .rounded))
        Spacer(minLength: 0)
      }
      .widgetAccentable()
    default:
      // Circular and corner: the number alone, as large as it will go.
      Text(label)
        .font(.system(size: 20, weight: .bold, design: .rounded))
        .minimumScaleFactor(0.5)
        .widgetAccentable()
    }
  }

  /// A dash, not a zero, when nothing is known. See the note at the top.
  private var label: String {
    value.map(String.init) ?? "—"
  }
}

/// The mark, at the one size the rectangular family has room for.
private struct Mark: View {
  var body: some View {
    Image("ComplicationIcon")
      .resizable()
      .aspectRatio(contentMode: .fit)
      .frame(width: 14, height: 14)
  }
}

@main
struct LangXComplicationBundle: WidgetBundle {
  var body: some Widget {
    LangXComplication()
  }
}
