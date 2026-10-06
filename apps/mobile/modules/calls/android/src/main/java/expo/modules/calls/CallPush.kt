package expo.modules.calls

import android.content.Context
import org.json.JSONObject

/**
 * The two data pushes a call sends a phone: "ring" and "stop ringing".
 *
 * Called by `car-messaging`'s notification service, which is where every
 * push to this app arrives, before Expo decides what to do with it. Both are
 * data-only — no title, no text — so Expo would draw nothing for them and
 * hand them to no JavaScript while the app is in the background; this is the
 * only place they are seen at all.
 */
object CallPush {
  const val KIND_RING = "callRing"
  const val KIND_CANCEL = "callCancel"

  /** True when the push was a call's, and nothing else should handle it. */
  fun handle(context: Context, body: JSONObject?): Boolean {
    val kind = body?.optString("kind").orEmpty()
    if (kind != KIND_RING && kind != KIND_CANCEL) return false
    val callId = body?.optString("callId").orEmpty()
    if (callId.isEmpty()) return true

    if (kind == KIND_CANCEL) {
      CallService.stopRing(context, callId)
      return true
    }
    /*
     * With the app in front the socket has already put the call screen up, and
     * a second ring from the shade would be the same call twice.
     */
    if (CallState.inForeground || CallState.ringingCallId == callId) return true
    CallService.startRing(context, RingData.from(body!!))
    return true
  }
}

/** What a ring push carries, as `callRingDataSchema` in `@langx/shared` writes it. */
data class RingData(
    val callId: String,
    val video: Boolean,
    val callerName: String,
    val ringSeconds: Int,
    val callToken: String,
) {
  companion object {
    fun from(body: JSONObject) =
        RingData(
            callId = body.optString("callId"),
            video = body.optString("media") == "video",
            callerName = body.optString("callerName"),
            ringSeconds = body.optInt("ringSeconds", 45).coerceIn(1, 60),
            callToken = body.optString("callToken"),
        )
  }
}
