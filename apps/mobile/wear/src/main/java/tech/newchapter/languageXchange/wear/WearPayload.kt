package tech.newchapter.languageXchange.wear

import org.json.JSONObject

/**
 * The watch's reader for what the phone sends.
 *
 * Mirrors `watchPayloadSchema` in `packages/shared/src/watch.ts`, which is the
 * definition, and is the Android twin of `targets/watch/WatchPayload.swift` —
 * the same blob, decoded twice, because neither watch can import the other's
 * language. The obligation that comes with that is the same one the Swift file
 * carries: a field added on the JS side has to be optional here until a build
 * carrying both has shipped, since a watch updates on its own schedule.
 *
 * Hand-decoded with `org.json` rather than a serialization library: this is
 * one small object read in one place, and a dependency that has to agree with
 * a zod schema by convention is not safer than a `optString` that cannot throw.
 */
data class WearMessage(val id: String, val body: String, val mine: Boolean)

data class WearConversation(
    val id: String,
    val name: String,
    val unread: Int,
    val messages: List<WearMessage>,
)

data class WearPayload(val conversations: List<WearConversation>) {
  companion object {
    /** Must match `WATCH_PAYLOAD_VERSION`. */
    const val VERSION = 1

    /**
     * Decode what arrived, or null.
     *
     * Null covers three different things on purpose — nothing sent yet, a blob
     * from a newer phone build than this watch understands, and the empty
     * string the phone sends on sign-out — because the watch's answer to all
     * three is the same: do not trust this screen, go and look at the phone.
     * An empty `conversations` list is a *different* answer and means nothing
     * is unread, which is why it is not folded in here.
     */
    fun decode(json: String?): WearPayload? {
      if (json.isNullOrEmpty()) return null
      return try {
        val root = JSONObject(json)
        if (root.optInt("version") != VERSION) return null

        val conversations = root.optJSONArray("conversations") ?: return WearPayload(emptyList())
        val list = (0 until conversations.length()).map { index ->
          val item = conversations.getJSONObject(index)
          val messages = item.optJSONArray("messages")
          WearConversation(
              id = item.optString("id"),
              name = item.optString("name"),
              unread = item.optInt("unread"),
              messages =
                  (0 until (messages?.length() ?: 0)).map { position ->
                    val message = messages!!.getJSONObject(position)
                    WearMessage(
                        id = message.optString("id"),
                        body = message.optString("body"),
                        mine = message.optBoolean("mine"),
                    )
                  },
          )
        }
        WearPayload(list)
      } catch (error: Throwable) {
        // A blob we cannot read is a blob we do not have. Same answer as null.
        null
      }
    }
  }
}
