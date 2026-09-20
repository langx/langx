import SwiftUI

/**
 The first screen: who is waiting.

 Drawn to `docs/plans/iphone-watch-and-carplay/watch.png` — an accent title, a
 card per person with their initial on a coloured disc, and a dot for the ones
 that are unread.

 Three states, and the difference between the last two is the one worth
 getting right. **Conversations** is the ordinary case. **No payload** means
 the phone has never spoken to this watch — a fresh install, or a signed-out
 account — and the answer is to go and open the app. **An empty list** means
 the phone spoke and there is nothing unread, which is good news and must not
 look like a failure.
 */
struct UnreadList: View {
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
      Placeholder(key: "watch.nothingUnread")
    } else {
      List {
        Text("watch.unread")
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
