package expo.modules.wearlink

import android.content.Context
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * One authenticated POST, from Kotlin, with no React runtime in the process.
 *
 * Extracted from `ReplyListenerService` when the car needed the same thing.
 * Both callers are started by the system into a bare process — a wrist reply
 * arrives at a `WearableListenerService`, a car reply at a `BroadcastReceiver`
 * — and neither can wait for JavaScript to reach the point where it could
 * send. It lives in this module rather than the car's because this is where
 * the credentials are written from JavaScript; see `WearCredentials`.
 *
 * Every guard — access, quota, token accounting — is on the server side of
 * these routes, shared with the socket, so there is nothing to re-check here
 * and nothing here may start checking.
 */
object NativeSend {

  /**
   * @param path Absolute path on the API, e.g. `/conversations/x/messages`.
   * @param timeoutMs Connect and read, both. The caller picks it because the
   *   patience available differs: a `WearableListenerService` has minutes and
   *   a `BroadcastReceiver`'s `goAsync` has about ten seconds.
   * @return true only for 2xx. Anything else is "not sent", including the
   *   refusals that are the server working correctly — a suspended account, a
   *   thread the sender was removed from. Neither caller has a screen to
   *   explain one on; the phone does, and that is where somebody is sent.
   */
  fun post(context: Context, path: String, body: JSONObject, timeoutMs: Int): Boolean {
    val credentials = WearCredentials.load(context) ?: return false

    return try {
      val connection = URL("${credentials.baseUrl}$path").openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Cookie", credentials.cookie)
      connection.connectTimeout = timeoutMs
      connection.readTimeout = timeoutMs

      connection.outputStream.use { stream -> stream.write(body.toString().toByteArray()) }

      val status = connection.responseCode
      connection.disconnect()
      status in 200..299
    } catch (error: Throwable) {
      false
    }
  }
}
