import SwiftUI

/**
 The first screen: the chat list, as the phone draws it.

 Drawn to `docs/plans/iphone-watch-and-carplay/watch.png` — an accent title, a
 card per person with their initial on a coloured disc, and a dot for the ones
 that are unread.

 It shows recent conversations rather than only unread ones, which is what
 makes the dot mean something: a wrist that has answered everything is still a
 wrist somebody can start a sentence from.

 Three states, and the difference between the last two is the one worth
 getting right. **Conversations** is the ordinary case. **No payload** means
 the phone has never spoken to this watch — a fresh install, or a signed-out
 account — and the answer is to go and open the app. **An empty list** means
 the phone spoke and this account has no chats at all, which is a new account
 rather than a failure.
 */
struct ChatList: View {
  @EnvironmentObject private var store: WatchStore
  /*
   Read here, above the override below, so the screens can be handed back the
   direction the wearer actually reads in.
  */
  @Environment(\.layoutDirection) private var readingDirection

  var body: some View {
    NavigationStack {
      content
        .environment(\.layoutDirection, readingDirection)
        /*
         The title is drawn in the content rather than given to
         `.navigationTitle`, because the mockup's is yellow and watchOS will
         not colour a navigation title — `.tint` reaches the back chevron and
         nothing else. Drawing it costs the large-title behaviour, which this
         screen has no use for: there is one screenful of rows.

         Yellow, which on every other surface is reserved for the committing
         action, because a watch has no other colour on this screen and the
         title is what tells somebody at arm's length which app they are
         looking at — the job the medium widget gives its header row.
        */
        .navigationBarTitleDisplayMode(.inline)
    }
    /*
     The navigation bar, and only the bar, is pinned left-to-right.

     watchOS draws the time in the top right corner and never mirrors it,
     while SwiftUI mirrors the back chevron along with everything else — so in
     Arabic the chevron is drawn on top of the clock and the wearer loses
     both. Pinning the bar costs an Arabic reader a chevron on the side they
     do not expect; leaving it alone costs them the time, and a way back they
     can see. The content above is given its real direction again, so the
     rows, the bubbles and the text stay right-to-left.
    */
    .environment(\.layoutDirection, .leftToRight)
  }

  @ViewBuilder
  private var content: some View {
    if store.payload == nil {
      Placeholder(key: "watch.openOnPhone")
    } else if store.conversations.isEmpty {
      Placeholder(key: "chats.emptyTitle")
    } else {
      List {
        Text("tabs.chats")
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .foregroundStyle(Palette.primary)
          .listRowBackground(Color.clear)

        ForEach(store.conversations) { conversation in
          NavigationLink(value: conversation.id) {
            Row(conversation: conversation)
          }
          .listRowBackground(
            Palette.fill.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
          )
        }

        /*
         The last row, and the only screen on this watch that is not about a
         conversation. It is here rather than behind a toolbar button because
         a watch toolbar is one glyph wide and a glyph that means "which
         number goes on your watch face" does not exist.
        */
        NavigationLink(value: Destination.settings) {
          Text("watch.complication")
            .font(.system(size: 14, design: .rounded))
            .foregroundStyle(Palette.textMuted)
        }
        .listRowBackground(Color.clear)
      }
      .navigationDestination(for: Destination.self) { _ in
        ComplicationSettings()
          .environment(\.layoutDirection, readingDirection)
      }
      .navigationDestination(for: String.self) { id in
        /*
         Given the direction again, because a destination inherits the
         *stack's* environment rather than this view's — so without this the
         bar fix above would follow the thread down and leave an Arabic
         wearer reading right-to-left names in a left-to-right screen.
        */
        ThreadView(conversationId: id)
          .environment(\.layoutDirection, readingDirection)
      }
    }
  }
}

/// One case, and it exists so `navigationDestination` can tell a settings
/// push apart from a conversation id — both would otherwise be `String`.
enum Destination: Hashable {
  case settings
}

/**
 Which number the complication draws.

 Two rows rather than a toggle: a toggle needs a label saying what "on"
 means, and "Streak" and "Unread" say it without one. The choice is written
 into the group the complication reads, and the face redraws as it is made.
 */
private struct ComplicationSettings: View {
  @EnvironmentObject private var store: WatchStore

  var body: some View {
    List {
      row(.unread, "watch.showsUnread")
      row(.streak, "watch.showsStreak")
    }
  }

  private func row(_ shows: WatchDigest.Shows, _ key: LocalizedStringKey) -> some View {
    Button {
      store.setComplicationShows(shows)
    } label: {
      HStack {
        Text(key)
          .foregroundStyle(Palette.text)
        Spacer(minLength: 0)
        if store.complicationShows == shows {
          Image(systemName: "checkmark")
            .foregroundStyle(Palette.primary)
        }
      }
    }
    .buttonStyle(.plain)
    .listRowBackground(
      Palette.fill.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    )
  }
}

private struct Row: View {
  let conversation: WatchPayload.Conversation

  var body: some View {
    HStack(spacing: 8) {
      AvatarDisc(name: conversation.name)
      VStack(alignment: .leading, spacing: 1) {
        Text(conversation.name)
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .foregroundStyle(Palette.text)
          .lineLimit(1)
        if let last = conversation.messages.last {
          Text(last.body)
            .font(.system(size: 13))
            .foregroundStyle(Palette.textMuted)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 4)
      /*
       A dot, not a count. Nobody acts differently at two unread messages in
       one thread than at one, and on a screen this size the number costs the
       name a character. The dot says "this one".
      */
      if conversation.unread > 0 {
        Circle()
          .fill(Palette.accent)
          .frame(width: 7, height: 7)
      }
    }
    .padding(.vertical, 2)
  }
}

/**
 Both empty states, drawn the same way.

 The key is a `LocalizedStringKey`, so the words come out of
 `targets/_shared/Localizable.xcstrings` in whichever of the eight languages
 the watch is set to — the generator is what puts them there, and the check in
 it is what refuses a literal sentence in this file.
 */
struct Placeholder: View {
  let key: LocalizedStringKey

  var body: some View {
    VStack {
      Spacer()
      Text(key)
        .font(.footnote)
        .foregroundStyle(Palette.textMuted)
        .multilineTextAlignment(.center)
      Spacer()
    }
    .padding(.horizontal)
  }
}
