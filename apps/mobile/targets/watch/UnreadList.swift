import SwiftUI

/**
 The first screen: who is waiting.

 Three states, and the difference between the last two is the one worth
 getting right. **Conversations** is the ordinary case. **No payload** means
 the phone has never spoken to this watch — a fresh install, or a signed-out
 account — and the answer is to go and open the app. **An empty list** means
 the phone spoke and there is nothing unread, which is good news and must not
 look like a failure.
 */
struct UnreadList: View {
  @EnvironmentObject private var store: WatchStore

  var body: some View {
    NavigationStack {
      content
        .navigationTitle("watch.unread")
    }
  }

  @ViewBuilder
  private var content: some View {
    if store.payload == nil {
      Placeholder(key: "watch.openOnPhone")
    } else if store.conversations.isEmpty {
      Placeholder(key: "watch.nothingUnread")
    } else {
      List(store.conversations) { conversation in
        NavigationLink(value: conversation.id) {
          Row(conversation: conversation)
        }
      }
      .navigationDestination(for: String.self) { id in
        ThreadView(conversationId: id)
      }
    }
  }
}

private struct Row: View {
  let conversation: WatchPayload.Conversation

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack {
        Text(conversation.name)
          .font(.headline)
          .lineLimit(1)
        Spacer()
        /*
         The count only when it is more than one. A "1" beside every row is
         noise on a screen this size — the row being there already says one
         message is waiting.
        */
        if conversation.unread > 1 {
          Text(conversation.unread.formatted())
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      if let last = conversation.messages.last {
        Text(last.body)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
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
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      Spacer()
    }
    .padding(.horizontal)
  }
}
