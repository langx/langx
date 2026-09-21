package expo.modules.carmessaging

import android.annotation.SuppressLint
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import expo.modules.wearlink.NativeSend
import java.util.UUID
import org.json.JSONObject

/**
 * Answers a message from the car — or from the shade — with no app running.
 *
 * A receiver rather than a service or an activity. Google's page is explicit
 * that an `Activity` or `Fragment` handling a car action "can cause your app
 * to be blocked from Android Auto", and the practical reason is the same one
 * the wrist reply has: the system starts this into a bare process with no
 * React runtime, so the send has to be possible from Kotlin alone. It is the
 * third way into `POST /conversations/:id/messages` — after the socket and
 * the watch — and every guard is on the server side of it.
 */
class MessageActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val conversationId = intent.getStringExtra(EXTRA_CONVERSATION_ID) ?: return
    val reply = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY_REPLY)?.toString()

    /*
     * `goAsync` because the work is two network calls and `onReceive` runs on
     * the main thread with a few milliseconds of grace. It buys about ten
     * seconds, which is where TIMEOUT_MS comes from — shorter than the
     * wrist's fifteen for that reason and no other.
     */
    val pending = goAsync()
    val app = context.applicationContext
    Thread {
          try {
            when (intent.action) {
              ACTION_REPLY -> if (!reply.isNullOrBlank()) reply(app, conversationId, reply)
              ACTION_MARK_READ -> markRead(app, conversationId)
            }
          } finally {
            pending.finish()
          }
        }
        .start()
  }

  /**
   * Send it, and say so honestly if it did not go.
   *
   * The car's own interface says "Sent" the moment it fires this intent —
   * that is its UI, not ours, and it cannot be told otherwise. So a failure
   * has to be visible afterwards, and the place it is visible is the
   * notification the person replied to: it stays, with the words they wrote
   * added as their own message and "Reply not sent" under it. On success it
   * goes away instead, because the thread has been answered.
   */
  private fun reply(context: Context, conversationId: String, text: String) {
    val sent =
        NativeSend.post(
            context,
            "/conversations/$conversationId/messages",
            /*
             * A fresh `clientId` per attempt. The wrist keeps one across
             * retries so the unique index refuses a double write; here there
             * is nothing to keep it in — the car offers no retry, and a
             * person who answers again from the phone is writing a second
             * message on purpose.
             */
            JSONObject().put("body", text).put("clientId", UUID.randomUUID().toString()),
            SEND_TIMEOUT_MS,
        )

    if (!sent) {
      showUnsent(context, conversationId, text)
      return
    }

    // Answering is reading. Without this the thread is answered and still
    // counted, on this phone and on every other device the account has.
    NativeSend.post(context, "/conversations/$conversationId/read", JSONObject(), READ_TIMEOUT_MS)
    NotificationManagerCompat.from(context).cancel(TAG, notifyId(conversationId))
  }

  private fun markRead(context: Context, conversationId: String) {
    NativeSend.post(context, "/conversations/$conversationId/read", JSONObject(), READ_TIMEOUT_MS)
    /*
     * Cancelled either way. The person said they have read it, and a
     * notification that stays put because a request failed is the app
     * arguing with them; the count reconciles the next time the app is open.
     */
    NotificationManagerCompat.from(context).cancel(TAG, notifyId(conversationId))
  }

  /**
   * Rebuilt from the notification that is still on screen, which is why this
   * needs no icon, channel or tap intent of its own — it keeps the ones the
   * message arrived with.
   *
   * If it is gone, nothing is posted. A dismissed notification means the
   * person has already moved on from the shade, and the honest state then is
   * a thread that is simply still unanswered in the app.
   */
  @SuppressLint("MissingPermission")
  private fun showUnsent(context: Context, conversationId: String, text: String) {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val posted =
        manager.activeNotifications.firstOrNull {
          it.tag == TAG && it.id == notifyId(conversationId)
        }
            ?: return

    val style =
        NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(posted.notification)
            ?: return
    style.addMessage(
        NotificationCompat.MessagingStyle.Message(text, System.currentTimeMillis(), null as Person?),
    )

    NotificationManagerCompat.from(context)
        .notify(
            TAG,
            notifyId(conversationId),
            NotificationCompat.Builder(context, posted.notification)
                .setStyle(style)
                .setSubText(context.getString(R.string.notifications_replyFailed))
                .build(),
        )
  }

  companion object {
    const val ACTION_REPLY = "tech.newchapter.languageXchange.REPLY"
    const val ACTION_MARK_READ = "tech.newchapter.languageXchange.MARK_READ"
    const val KEY_REPLY = "reply"
    const val EXTRA_CONVERSATION_ID = "conversationId"

    /**
     * One tag for every message notification, told apart by id. Deliberately
     * not the tag expo-notifications uses — its own is the push's identifier,
     * which is new every time — so nothing here collides with a notification
     * it still owns.
     */
    const val TAG = "langx:message"

    /** A thread's notification, stable across the messages in it. */
    fun notifyId(conversationId: String): Int = conversationId.hashCode()

    fun intent(context: Context, action: String, conversationId: String): Intent =
        Intent(context, MessageActionReceiver::class.java)
            .setAction(action)
            .putExtra(EXTRA_CONVERSATION_ID, conversationId)

    /**
     * Nine seconds for both together, against the ten a broadcast gets.
     *
     * The wrist allows fifteen for the same send; here the ceiling is not
     * patience but the receiver's own deadline, and a send that takes six
     * seconds has already failed in every way that matters to somebody
     * driving. The read is given the smaller half because it is the one
     * whose failure costs least — an unread count reconciles itself.
     */
    private const val SEND_TIMEOUT_MS = 6_000
    private const val READ_TIMEOUT_MS = 3_000
  }
}
