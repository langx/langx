package expo.modules.carmessaging

import android.annotation.SuppressLint
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import expo.modules.notifications.notifications.interfaces.INotificationContent
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Draws a message push as a conversation, so a car can read it out and answer.
 *
 * **Why the shape matters.** Android Auto has no template for messaging —
 * `CarAppService`'s categories are navigation, POI, settings and feature
 * cluster, and there is no messaging one. The car's whole messaging support
 * is a notification it knows how to parse: `MessagingStyle`, a `Person` per
 * speaker, a reply action marked `SEMANTIC_ACTION_REPLY` that shows no UI,
 * and a mark-as-read action beside it. Anything else is a line of text the
 * car will not read aloud and cannot answer.
 *
 * **What it changes, and what it leaves.** Everything but a message push
 * goes to `super` untouched. A message keeps Expo's notification whole — its
 * channel, icon, colour, badge, tap intent and the request it stores in
 * extras for `getPresentedNotificationsAsync` — and is rebuilt from it with
 * the style and the two actions replacing `BigTextStyle` and the category's
 * own Reply button.
 *
 * **The Reply button moves to Kotlin, and that is a fix.** The category
 * registered in `lib/notifications.ts` gives Android a reply action whose
 * `PendingIntent` goes back into Expo's response path, which means
 * JavaScript. On iOS that works — the system launches the app in the
 * background to handle it. On Android the process starts without a React
 * runtime, so the answer sits in Expo's store until somebody opens the app.
 * The action built here posts the reply itself, from a broadcast receiver,
 * which is what the car requires and what the shade needed anyway. The iOS
 * path in `useNotificationRouting` is untouched.
 */
class MessagePresenter(context: Context) : ExpoPresentationDelegate(context) {

  /**
   * One notification per *conversation*, which is not what Expo does.
   *
   * Expo notifies under the request's own identifier, and every push has a
   * new one — so three messages from the same person are three notifications
   * and the car reads three separate conversations. A `MessagingStyle` is a
   * thread, so this keys on the thread: a constant tag and an id derived from
   * the conversation, which is also what lets the next message find the last
   * one and append to it.
   */
  @SuppressLint("MissingPermission")
  override fun presentNotification(notification: Notification, behavior: NotificationBehaviorRecord?) {
    val content = notification.notificationRequest.content
    val conversationId = content.body?.optString(KEY_CONVERSATION_ID).orEmpty()
    val sender = content.title.orEmpty()

    /*
     * Everything that is not a message this app sent, and every case where
     * the app has asked for silence, is Expo's to handle exactly as before.
     * The title is required because it is the other person's name and a
     * `Person` without one is a voice the car cannot attribute.
     */
    if (content.categoryId != CATEGORY_MESSAGE ||
        conversationId.isEmpty() ||
        sender.isEmpty() ||
        behavior?.shouldPresentAlert == false) {
      super.presentNotification(notification, behavior)
      return
    }

    CoroutineScope(Dispatchers.IO).launch {
      val plain = createNotification(notification, behavior)
      NotificationManagerCompat.from(context)
          .notify(
              MessageActionReceiver.TAG,
              MessageActionReceiver.notifyId(conversationId),
              asConversation(plain, content, conversationId, sender),
          )
    }
  }

  private fun asConversation(
      plain: android.app.Notification,
      content: INotificationContent,
      conversationId: String,
      sender: String,
  ): android.app.Notification {
    val style = existingThread(conversationId) ?: NotificationCompat.MessagingStyle(me())
    /*
     * A LangX conversation is always two people, so no conversation title:
     * Android reserves that for group chats and a car reading "Ana Ruiz:
     * Ana Ruiz says…" is what setting one here would produce.
     */
    style.setGroupConversation(false)
    style.addMessage(
        NotificationCompat.MessagingStyle.Message(
            content.text.orEmpty(),
            System.currentTimeMillis(),
            Person.Builder().setName(sender).setKey(conversationId).build(),
        ),
    )

    return NotificationCompat.Builder(context, plain)
        .setStyle(style)
        // The category's own Reply, which would be a second button doing the
        // slower thing. See the note at the top.
        .clearActions()
        .addAction(replyAction(conversationId))
        // Invisible: the car and Wear use it, the shade has no room for a
        // button nobody asked for beside Reply.
        .addInvisibleAction(markAsReadAction(conversationId))
        .build()
  }

  /**
   * The thread as it already stands on screen, so the new message joins it.
   *
   * Read back out of the posted notification rather than kept in a file of
   * our own: the system is already storing it, it is thrown away when the
   * person dismisses the notification — which is exactly when the history
   * should stop — and there is nothing to clear at sign-out.
   */
  private fun existingThread(conversationId: String): NotificationCompat.MessagingStyle? {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return null
    val posted =
        manager.activeNotifications.firstOrNull {
          it.tag == MessageActionReceiver.TAG && it.id == MessageActionReceiver.notifyId(conversationId)
        }
            ?: return null
    return NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(posted.notification)
  }

  private fun me(): Person =
      Person.Builder().setName(context.getString(R.string.messageMeta_you)).setKey(KEY_ME).build()

  private fun replyAction(conversationId: String): NotificationCompat.Action {
    /*
     * `FLAG_MUTABLE` is required, not a preference: the car fills the
     * `RemoteInput` into this very intent, and an immutable one silently
     * arrives with no text at all.
     */
    val pending =
        PendingIntent.getBroadcast(
            context,
            MessageActionReceiver.notifyId(conversationId),
            MessageActionReceiver.intent(context, MessageActionReceiver.ACTION_REPLY, conversationId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
        )

    /*
     * No icon (`0`). Android has not drawn action icons in the shade since
     * Nougat, and the car draws none either — shipping a drawable would be a
     * file nothing renders. The two words come from the same eight catalogues
     * the rest of the app reads; see `src/i18n/nativeKeys.ts`.
     */
    return NotificationCompat.Action.Builder(
            0,
            context.getString(R.string.notifications_replyAction),
            pending,
        )
        .addRemoteInput(
            RemoteInput.Builder(MessageActionReceiver.KEY_REPLY)
                .setLabel(context.getString(R.string.notifications_replyPlaceholder))
                .build(),
        )
        .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
        // The car will not offer an action that says it opens a screen, and
        // this one must not: the phone stays in a pocket.
        .setShowsUserInterface(false)
        .build()
  }

  private fun markAsReadAction(conversationId: String): NotificationCompat.Action {
    // Immutable, unlike the reply: nothing is filled into it.
    val pending =
        PendingIntent.getBroadcast(
            context,
            MessageActionReceiver.notifyId(conversationId),
            MessageActionReceiver.intent(context, MessageActionReceiver.ACTION_MARK_READ, conversationId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    return NotificationCompat.Action.Builder(
            0,
            context.getString(R.string.notifications_markAsRead),
            pending,
        )
        .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
        .setShowsUserInterface(false)
        .build()
  }

  private companion object {
    /** `PUSH_CATEGORY_MESSAGE` in `packages/shared/src/push.ts`. */
    const val CATEGORY_MESSAGE = "message"
    /** The push's `data`, written by `fanOutMessage`. */
    const val KEY_CONVERSATION_ID = "conversationId"
    /** Any stable string; it only has to differ from the other speaker's. */
    const val KEY_ME = "me"
  }
}
