import SwiftUI

/**
 One thread, and the only thing this app does other than read: a reply.

 Drawn to `docs/plans/iphone-watch-and-carplay/watch.png` — the other person
 named at the top beside their disc, their words on the left in `fill`, yours
 on the right in `accentBg`, and one yellow pill at the bottom.

 **The yellow is the rule, not a choice.** `MessageBubble.tsx` states it for
 the app: yellow is the committing action, once per screen, and that is the
 send button. So the bubbles here are blue and grey exactly as they are on the
 phone, and Reply is the only yellow on the watch.

 What is drawn is whatever the phone sent — for an unread conversation that is
 at least the message that made it unread, and more when the phone happened to
 have the thread cached. There is no "load more", deliberately: the watch
 never causes a fetch, and a button that sometimes worked would be worse than
 not offering one.

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
        VStack(alignment: .leading, spacing: 6) {
          Header(name: conversation.name)
          ForEach(conversation.messages) { message in
            Bubble(message: message)
          }
          ReplyButton(conversationId: conversationId)
          Outcome(state: store.sending[conversationId])
        }
        .padding(.horizontal, 2)
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
    // The name is in the view rather than the bar: a watch title truncates to
    // nothing beside the clock, and the mockup puts the disc next to it.
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct Header: View {
  let name: String

  var body: some View {
    HStack(spacing: 6) {
      AvatarDisc(name: name, size: 22)
      Text(name)
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundStyle(Palette.text)
        .lineLimit(1)
      Spacer(minLength: 0)
    }
    .padding(.bottom, 2)
  }
}

private struct Bubble: View {
  let message: WatchPayload.Message

  var body: some View {
    HStack {
      if message.mine { Spacer(minLength: 20) }
      Text(message.body)
        .font(.system(size: 14))
        .foregroundStyle(Palette.text)
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(
          message.mine ? Palette.accentBg : Palette.fill,
          in: RoundedRectangle(cornerRadius: 13, style: .continuous)
        )
      if !message.mine { Spacer(minLength: 20) }
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
      Text("watch.reply")
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundStyle(Palette.primaryInk)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 9)
        .background(Palette.primary, in: Capsule())
    } onSubmit: { text in
      store.reply(to: conversationId, body: text)
    }
    .buttonStyle(.plain)
    .padding(.top, 6)
    /*
     No phone in range means no send, and the button says so by being off
     rather than by failing when pressed. `isReachable` is the watch's only
     honest signal here — it is about this moment, not about pairing.
    */
    .disabled(!store.reachable)
    .opacity(store.reachable ? 1 : 0.4)
  }
}

private struct Outcome: View {
  let state: WatchStore.SendState?

  var body: some View {
    switch state {
    case .sending: line("watch.sending", Palette.textMuted)
    case .sent: line("watch.sent", Palette.textMuted)
    case .failed: line("watch.notSent", .orange)
    case nil: EmptyView()
    }
  }

  private func line(_ key: LocalizedStringKey, _ colour: Color) -> some View {
    Text(key)
      .font(.caption2)
      .foregroundStyle(colour)
      .frame(maxWidth: .infinity)
  }
}
