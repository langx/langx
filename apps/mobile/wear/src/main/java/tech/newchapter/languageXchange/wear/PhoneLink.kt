package tech.newchapter.languageXchange.wear

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable

/**
 * Everything the watch knows, and the only thing that talks to the phone.
 *
 * The Android twin of `targets/watch/WatchStore.swift`, and the same design:
 * a dependent app has no session and makes no network call, so this is not a
 * cache in front of an API — it is the whole model. What the phone last said
 * is what the watch believes, and when the phone has said nothing the honest
 * screen says to go and open it.
 *
 * **`DataClient`, not `MessageClient`, for the payload.** A data item is a
 * single value the system replaces and redelivers when the watch next comes
 * up, which is what `updateApplicationContext` gives us on Apple — so a watch
 * that was off while three messages arrived wakes holding the current state
 * instead of replaying three stale ones. Messages are for the reply, which is
 * a one-shot that wants an answer.
 *
 * `getDataItems` is read on start and not only awaited as a listener callback,
 * for the same reason the Swift side reads `receivedApplicationContext`: the
 * item survives across launches, so a cold start already has an answer and
 * does not flash the unreachable state.
 */
class PhoneLink(private val context: Context) : DataClient.OnDataChangedListener {

  var payload by mutableStateOf<WearPayload?>(null)
    private set

  /** Whether a phone is connected *right now*, which is what gates the reply. */
  var reachable by mutableStateOf(false)
    private set

  /** Keyed by conversation, so two threads in flight do not draw on each other. */
  var sending by mutableStateOf<Map<String, SendState>>(emptyMap())
    private set

  enum class SendState {
    SENDING,
    SENT,
    FAILED,
  }

  fun start() {
    Wearable.getDataClient(context).addListener(this)
    Wearable.getDataClient(context).dataItems.addOnSuccessListener { buffer ->
      buffer.forEach { item ->
        if (item.uri.path == PATH_PAYLOAD) apply(DataMapItem.fromDataItem(item))
      }
      buffer.release()
    }
    refreshReachability()
  }

  fun stop() {
    Wearable.getDataClient(context).removeListener(this)
  }

  fun conversation(id: String): WearConversation? =
      payload?.conversations?.firstOrNull { it.id == id }

  /**
   * Send a reply, and say what happened.
   *
   * `clientId` is minted here rather than on the phone, exactly as on Apple,
   * and for the same reason: a message whose acknowledgement never arrives is
   * indistinguishable from one never delivered, so the id has to exist before
   * the first attempt and be reused by the retry. The server's unique index
   * refuses the duplicate write.
   *
   * An unreachable phone is refused here rather than attempted — a wrist
   * showing a spinner before saying "not sent" is worse than saying it at once.
   */
  fun reply(conversationId: String, body: String) {
    val trimmed = body.trim()
    if (trimmed.isEmpty()) return
    if (!reachable) {
      sending = sending + (conversationId to SendState.FAILED)
      return
    }

    sending = sending + (conversationId to SendState.SENDING)
    val json =
        org.json.JSONObject()
            .put("conversationId", conversationId)
            .put("body", trimmed)
            .put("clientId", java.util.UUID.randomUUID().toString())
            .toString()

    Wearable.getNodeClient(context).connectedNodes.addOnSuccessListener { nodes ->
      val node = nodes.firstOrNull()
      if (node == null) {
        sending = sending + (conversationId to SendState.FAILED)
        return@addOnSuccessListener
      }
      Wearable.getMessageClient(context)
          .sendMessage(node.id, PATH_REPLY, json.toByteArray())
          /*
           Delivered, not sent. `sendMessage` succeeding means the phone
           received the bytes, not that the server accepted the message — the
           phone answers that on `PATH_REPLY_RESULT` below, and until it does
           the wrist keeps saying "sending".
          */
          .addOnFailureListener { sending = sending + (conversationId to SendState.FAILED) }
    }
  }

  /** The phone's verdict on a reply, written back as a data item. */
  private fun applyResult(map: DataMapItem) {
    val conversationId = map.dataMap.getString("conversationId") ?: return
    val ok = map.dataMap.getBoolean("ok", false)
    sending = sending + (conversationId to if (ok) SendState.SENT else SendState.FAILED)
  }

  private fun apply(map: DataMapItem) {
    payload = WearPayload.decode(map.dataMap.getString("payload"))
    /*
     A fresh list is a fresh slate. Without this a thread answered a minute ago
     still reads "Sent" after the reply has come back as an ordinary message —
     the outcome of a send that is now visible in the thread itself.
    */
    sending = emptyMap()
  }

  override fun onDataChanged(events: DataEventBuffer) {
    events.forEach { event ->
      if (event.type != DataEvent.TYPE_CHANGED) return@forEach
      when (event.dataItem.uri.path) {
        PATH_PAYLOAD -> apply(DataMapItem.fromDataItem(event.dataItem))
        PATH_REPLY_RESULT -> applyResult(DataMapItem.fromDataItem(event.dataItem))
      }
    }
    refreshReachability()
  }

  private fun refreshReachability() {
    Wearable.getNodeClient(context).connectedNodes.addOnSuccessListener { nodes ->
      reachable = nodes.isNotEmpty()
    }
  }

  companion object {
    /** Must match the paths in `modules/wear-link`. */
    const val PATH_PAYLOAD = "/langx/payload"
    const val PATH_REPLY = "/langx/reply"
    const val PATH_REPLY_RESULT = "/langx/reply-result"
  }
}
