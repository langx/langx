import Foundation

/**
 The Swift half of the widget contract.

 Mirrors `companionSnapshotSchema` in `packages/shared/src/companion.ts`, which
 is the definition; this is a reader of it. Anything added there has to be
 optional here until a build carrying both has shipped — a widget extension is
 only replaced when the binary is, so an old extension can be handed a new blob
 the moment the app updates over the air.

 Lives in `targets/_shared` because two targets read it: the widget, and the
 notification service extension that keeps the unread count honest while the
 app is closed.
 */
struct CompanionSnapshot: Codable {
  /// Must match `COMPANION_SNAPSHOT_VERSION`. A blob from a newer app than
  /// this extension is treated as no blob at all — see `load`.
  static let version = 1

  /// Where both targets look. Must match the module and `app.config.ts`.
  static let appGroup = "group.tech.newchapter.languageXchange"
  static let key = "companionSnapshot"

  struct Streak: Codable {
    let current: Int
    let longest: Int
    /// `YYYY-MM-DD` in the profile's timezone, or nil for an account that has
    /// never had a qualifying day.
    let lastQualifiedDay: String?
  }

  struct Echo: Codable {
    let due: Int
    let nextDue: String?
  }

  /**
   The activity map, one character per day.

   Optional, and the first field added after this struct shipped — which is
   what the note at the top of the file is about. An extension is only replaced
   when the binary is, so a build without the map widget can be handed a blob
   that carries this, and one *with* it can be handed a blob from an older app
   that does not. Both cases are this being nil.
  */
  struct Activity: Codable {
    let today: String
    let weeks: Int
    /// `0`–`4` shade a square; `.` is a day that has not happened yet and is
    /// drawn as a gap. Oldest first, seven days to a column — the order
    /// `activityGrid` lays out, which this side never recomputes.
    let days: String

    /// The string as columns of seven, or empty if it is not the length it claims.
    var columns: [[Character]] {
      let all = Array(days)
      guard all.count == weeks * 7 else { return [] }
      return (0..<weeks).map { Array(all[($0 * 7)..<($0 * 7 + 7)]) }
    }
  }

  struct Labels: Codable {
    let streak: String
    let unread: String
    let cardsDue: String
  }

  let version: Int
  let writtenAt: String
  let locale: String
  let unread: Int
  let streak: Streak
  let echo: Echo
  let activity: Activity?
  let labels: Labels

  /**
   Read what the app last wrote, or nil.

   Nil is a real answer with a real meaning — nobody is signed in, or this
   phone has not opened the app since the widget was added — and every view
   here draws the same empty state for it. It is never a zero: a zero is a
   claim about somebody's streak, and we do not have one to make.
   */
  static func load(from defaults: UserDefaults? = UserDefaults(suiteName: appGroup))
    -> CompanionSnapshot?
  {
    guard let json = defaults?.string(forKey: key), let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(CompanionSnapshot.self, from: data),
      snapshot.version == version
    else { return nil }
    return snapshot
  }

  /**
   Whether today has already counted towards the streak, on this device's
   calendar.

   The comparison is deliberately all that happens here. Whether a lapsed
   streak is still savable is a rule with freezes in it, it lives in
   `packages/shared`, and it is the app's to answer — a widget that reimplemented
   it would be a second copy free to disagree with the evening reminder.

   The device's day, not the profile's timezone, for the same reason
   `deviceDayKey` gives on the JS side: the phone is where the person is, and
   the answer is allowed to be loose in the direction of asking again.

   The Android widget answers the same question in JavaScript, where it is
   `countedToday` in `src/lib/companionSnapshot.ts` and has tests. This is the
   second copy of it; nothing can check that the two agree, so keep them
   spelled the same way.
   */
  func countedToday(now: Date = Date()) -> Bool {
    guard let last = streak.lastQualifiedDay else { return false }
    return last == Self.dayKey(now)
  }

  static func dayKey(_ date: Date) -> String {
    let formatter = DateFormatter()
    // POSIX, or a phone set to a non-Gregorian calendar formats a different
    // year entirely and nothing ever matches.
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }
}
