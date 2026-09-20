package expo.modules.wearlink

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * Posts a wrist reply to the API, from Kotlin, with no app running.
 *
 * The Android twin of `ReplySender.swift`, and it exists for the same reason
 * the Apple one does — the correction the plan needed. A reply from the wrist
 * reaches a phone whose app may be dead; the system starts *this service* into
 * a bare process with no React runtime and a few seconds of wall clock, so the
 * send has to be possible from native code alone.
 *
 * The route is `POST /conversations/:id/messages`, the REST twin of
 * `message:send`. Every guard — access, quota, token accounting — is on the
 * server side of it, shared with the socket, so there is nothing to re-check
 * here and nothing here may start checking.
 *
 * The verdict goes back as a data item rather than as a reply to the message,
 * because `MessageClient` has no reply channel: the watch sends and this
 * answers on a second path, which is what lets the wrist show "sent" or
 * "not sent" rather than only "delivered to the phone".
 */
class ReplyListenerService : WearableListenerService() {

  override fun onMessageReceived(event: MessageEvent) {
    if (event.path != PATH_REPLY) return

    val body = String(event.data)
    val request =
        try {
          JSONObject(body)
        } catch (error: Throwable) {
          return
        }

    val conversationId = request.optString("conversationId")
    val text = request.optString("body")
    val clientId = request.optString("clientId")
    if (conversationId.isEmpty() || text.isEmpty() || clientId.isEmpty()) return

    val ok = send(conversationId, text, clientId)

    val result = PutDataMapRequest.create(PATH_REPLY_RESULT)
    result.dataMap.putString("conversationId", conversationId)
    result.dataMap.putBoolean("ok", ok)
    result.dataMap.putLong("writtenAt", System.currentTimeMillis())
    Wearable.getDataClient(this).putDataItem(result.asPutDataRequest().setUrgent())
  }

  private fun send(conversationId: String, body: String, clientId: String): Boolean {
    val credentials = WearCredentials.load(this) ?: return false

    return try {
      val url = URL("${credentials.baseUrl}/conversations/$conversationId/messages")
      val connection = url.openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Cookie", credentials.cookie)
      /*
       Fifteen seconds, matching the Apple side. `sendMessage`'s own patience
       is longer, but a person looking at a watch face has far less — and a
       send that was actually committed is not lost by saying it failed,
       because the retry carries the same `clientId` and the unique index
       refuses the second write.
      */
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS

      connection.outputStream.use { stream ->
        stream.write(JSONObject().put("body", body).put("clientId", clientId).toString().toByteArray())
      }

      /*
       Anything but 2xx is "not sent", including the refusals that are the
       server working correctly — a suspended account, a thread the sender was
       removed from. The watch has one line to say it in and no screen to
       explain it on; the phone does, and that is where somebody is being sent.
      */
      val status = connection.responseCode
      connection.disconnect()
      status in 200..299
    } catch (error: Throwable) {
      false
    }
  }

  private companion object {
    /** Must match the paths in `wear/PhoneLink.kt`. */
    const val PATH_REPLY = "/langx/reply"
    const val PATH_REPLY_RESULT = "/langx/reply-result"
    const val TIMEOUT_MS = 15_000
  }
}
