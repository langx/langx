import SwiftUI

/**
 One thread, and the only thing this app does other than read: a reply.

 What is drawn is whatever the phone sent — which for an unread conversation
 is at least the message that made it unread, and more when the phone happened
 to have the thread cached. There is no "load more", deliberately: the watch
 never causes a fetch, and a button that sometimes worked and sometimes sat
 there would be worse than not offering one.

 The conversation is looked up by id on every redraw rather than held. A new
 payload can arrive while this screen is open — the other person writing
 again, or the reply landing — and holding a copy would show the thread as it
 was when it was tapped.
 */
struct ThreadView: View {
  let conversationId: String
  @EnvironmentObject private var store: WatchStore

  var body: some View {
    ScrollView {
      if let conversation = store.conversation(id: conversationId) {
        VStack(alignment: .leading, spacing: 8) {
          ForEach(conversation.messages) { message in
            Bubble(message: message)
          }
          ReplyButton(conversationId: conversationId)
          Outcome(state: store.sending[conversationId])
        }
        .padding(.horizontal, 4)
        .navigationTitle(conversation.name)
      } else {
        /*
         The thread was in the last payload and is not in this one, which
         happens the moment it is read on the phone. Nothing is wrong, and
         there is nothing here any more — the same words as a watch that has
         not been spoken to, because the instruction is the same.
        */
        Placeholder(key: "watch.openOnPhone")
      }
    }
  }
}

private struct Bubble: View {
  let message: WatchPayload.Message

  var body: some View {
    HStack {
      if message.mine { Spacer(minLength: 24) }
      Text(message.body)
        .font(.footnote)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(message.mine ? Color.accentColor.opacity(0.35) : Color.gray.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 12))
      if !message.mine { Spacer(minLength: 24) }
    }
  }
}

/**
 Dictation, scribble or the tiny keyboard — whichever the wearer prefers.

 `TextFieldLink` is what hands that choice to the system instead of picking
 one. A watch app that opened dictation directly would be unusable in a quiet
 room, and one that opened the keyboard would be unusable while walking.
 */
private struct ReplyButton: View {
  let conversationId: String
  @EnvironmentObject private var store: WatchStore

  var body: some View {
    TextFieldLink(prompt: Text("watch.reply")) {
      Label("watch.reply", systemImage: "arrowshape.turn.up.left")
        .font(.footnote)
    } onSubmit: { text in
      store.reply(to: conversationId, body: text)
    }
    .buttonStyle(.bordered)
    .padding(.top, 4)
    /*
     No phone in range means no send, and the button says so by being off
     rather than by failing when pressed. `isReachable` is the watch's only
     honest signal here — it is about this moment, not about pairing.
    */
    .disabled(!store.reachable)
  }
}

private struct Outcome: View {
  let state: WatchStore.SendState?

  var body: some View {
    switch state {
    case .sending: line("watch.sending", .secondary)
    case .sent: line("watch.sent", .secondary)
    case .failed: line("watch.notSent", .orange)
    case nil: EmptyView()
    }
  }

  private func line(_ key: LocalizedStringKey, _ colour: Color) -> some View {
    Text(key)
      .font(.caption2)
      .foregroundStyle(colour)
  }
}
