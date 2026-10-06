package expo.modules.calls

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.net.HttpURLConnection
import java.net.URL

/**
 * Decline on a ringing call, and Hang up on a call in progress.
 *
 * Decline has to work with no JavaScript in the process — the phone was woken
 * by a push and nothing else has started — so it goes to the server from here,
 * with the ticket the ring carried (`POST /calls/:id/decline`, header
 * `x-call-token`). The ticket can turn down that one call and nothing else;
 * see `callToken.ts` in the API. No cookie, so a phone signed in on a locked
 * keyring can still say no.
 *
 * Hang up only ever appears while a call is up, which means JavaScript is
 * running and holds the call; it is told, and does the hanging up.
 */
class CallActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_HANG_UP -> CallState.emit(EVENT_HANG_UP)
      ACTION_DECLINE -> {
        val callId = intent.getStringExtra(CallService.EXTRA_CALL_ID) ?: return
        val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        CallService.stopRing(context, callId)
        // And to JavaScript, if it is running and showing the same call.
        CallState.emit(EVENT_DECLINED, callId)
        val app = context.applicationContext
        val pending = goAsync()
        Thread {
              try {
                decline(app, callId, token)
              } finally {
                pending.finish()
              }
            }
            .start()
      }
    }
  }

  /** Best effort: a decline that does not land is a call that rings out on the caller's side. */
  private fun decline(context: Context, callId: String, token: String) {
    val baseUrl = CallPrefs.baseUrl(context) ?: return
    try {
      val connection = URL("$baseUrl/calls/$callId/decline").openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("x-call-token", token)
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      connection.outputStream.use { stream -> stream.write("{}".toByteArray()) }
      connection.responseCode
      connection.disconnect()
    } catch (_: Throwable) {}
  }

  companion object {
    private const val ACTION_DECLINE = "expo.modules.calls.DECLINE"
    private const val ACTION_HANG_UP = "expo.modules.calls.HANG_UP"
    private const val EXTRA_TOKEN = "langx.call.token"
    const val EVENT_HANG_UP = "hangUp"
    const val EVENT_DECLINED = "declined"
    private const val TIMEOUT_MS = 8_000

    fun decline(context: Context, callId: String, token: String): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            callId.hashCode(),
            Intent(context, CallActionReceiver::class.java)
                .setAction(ACTION_DECLINE)
                .putExtra(CallService.EXTRA_CALL_ID, callId)
                .putExtra(EXTRA_TOKEN, token),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun hangUp(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, CallActionReceiver::class.java).setAction(ACTION_HANG_UP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
  }
}
