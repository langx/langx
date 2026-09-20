import SwiftUI

/**
 The app's dark palette, written out because a watch target cannot import
 `src/lib/theme/tokens.ts`.

 The same copy the widget keeps in `targets/widget/LangXWidget.swift`, for the
 same reason and with the same obligation: these are transcriptions, the file
 in `src/lib/theme` is the definition, and a colour changed there has to be
 changed here by hand. Nothing checks it.

 Dark values only. watchOS has no light mode.
 */
enum Palette {
  /// `colors.fill` — a row card, and the other person's bubble.
  static let fill = Color(red: 0.137, green: 0.153, blue: 0.176) // #23272d
  /// `colors.text`.
  static let text = Color(red: 0.949, green: 0.953, blue: 0.961) // #f2f3f5
  /// `colors.textMuted`.
  static let textMuted = Color(red: 0.604, green: 0.631, blue: 0.663) // #9aa1a9
  /// `colors.primary` — the committing action, and nothing else. See below.
  static let primary = Color(red: 1.0, green: 0.769, blue: 0.035) // #ffc409
  /// `colors.primaryText`, the ink that only ever goes on `primary`.
  static let primaryInk = Color(red: 0.125, green: 0.098, blue: 0.0) // #201900
  /// `colors.accent` — the unread dot.
  static let accent = Color(red: 0.486, green: 0.612, blue: 0.976) // #7c9cf9
  /// `colors.accentBg` — your own side of a thread, as `MessageBubble` has it.
  static let accentBg = Color(red: 0.125, green: 0.169, blue: 0.271) // #202b45

  /**
   The colours an avatar circle can be.

   Picked from a name rather than stored, because the watch is handed names and
   nothing else — no avatar URLs, which would be other people's photographs
   sitting in a second place. A letter on a coloured disc is what the app's own
   `Avatar` falls back to, so the wrist and the phone agree about somebody who
   has no picture.
  */
  static let avatars: [Color] = [
    Color(red: 1.0, green: 0.769, blue: 0.035),  // primary
    Color(red: 0.486, green: 0.612, blue: 0.976),  // accent
    Color(red: 0.310, green: 0.780, blue: 0.588),  // green
    Color(red: 0.639, green: 0.522, blue: 0.945),  // violet
    Color(red: 1.0, green: 0.663, blue: 0.239),  // streak
  ]

  /**
   Stable per person, and deliberately not random.

   A name that changed colour between two draws would read as a different
   person. Summing the scalars is enough — this is a decoration, not a hash,
   and a collision costs two people the same colour on a list of at most ten.
  */
  static func avatar(for name: String) -> Color {
    let sum = name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
    return avatars[sum % avatars.count]
  }

  /// The letter on the disc. Empty for a name that is only punctuation.
  static func initial(for name: String) -> String {
    guard let first = name.first(where: { $0.isLetter || $0.isNumber }) else { return "" }
    return String(first).uppercased()
  }
}

/// The coloured disc with a letter on it, as the mockup draws it.
struct AvatarDisc: View {
  let name: String
  var size: CGFloat = 30

  var body: some View {
    Circle()
      .fill(Palette.avatar(for: name))
      .frame(width: size, height: size)
      .overlay(
        Text(Palette.initial(for: name))
          .font(.system(size: size * 0.45, weight: .bold, design: .rounded))
          // Every disc colour is a light one, so the letter is always the dark
          // ink rather than a per-colour decision.
          .foregroundStyle(Palette.primaryInk)
      )
  }
}
