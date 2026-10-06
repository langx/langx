package expo.modules.calls

import android.content.Context

/**
 * What the process knows about a call outside JavaScript.
 *
 * In memory, because none of it outlives the process: a ring that the process
 * died under is ended by the server's own deadline, and a pending answer is
 * only ever read by the JavaScript that starts in the same process. The base
 * URL is the one exception — Decline needs it with nothing else running — and
 * it lives in `CallPrefs`.
 */
object CallState {
  /** A tap on a call's notification that JavaScript has not picked up yet. */
  data class PendingAction(val callId: String, val answer: Boolean)

  @Volatile var pending: PendingAction? = null
  /** The call whose ring is on screen, so a second push for it changes nothing. */
  @Volatile var ringingCallId: String? = null
  @Volatile var ongoing: Boolean = false
  /** Whether an activity of ours is resumed — the socket rings then, not this. */
  @Volatile var inForeground: Boolean = false
  /** Set by `CallsModule` while JavaScript is listening. */
  @Volatile var listener: ((event: String, callId: String?) -> Unit)? = null

  fun emit(event: String, callId: String? = null) {
    listener?.invoke(event, callId)
  }
}

/** The API's address, written by JavaScript at start and read by Decline. */
object CallPrefs {
  private const val FILE = "langx.calls"
  private const val KEY_BASE_URL = "baseUrl"

  fun setBaseUrl(context: Context, baseUrl: String) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY_BASE_URL, baseUrl).apply()
  }

  fun baseUrl(context: Context): String? =
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY_BASE_URL, null)
}
