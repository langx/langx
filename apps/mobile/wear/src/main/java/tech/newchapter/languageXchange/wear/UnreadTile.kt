package tech.newchapter.languageXchange.wear

import android.content.Context
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.concurrent.futures.CallbackToFutureAdapter
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.google.android.gms.wearable.DataEventBuffer
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * The watch face's glance at who is waiting.
 *
 * A tile is the Android counterpart of an Apple complication and it answers
 * the same question the app's first screen does — **who is waiting** — with
 * one swipe instead of a launch. It deliberately answers nothing else: a tile
 * that listed threads would be the app, badly, on a surface nobody scrolls.
 *
 * **It reads the Data Layer directly rather than asking the app.** A tile is
 * rendered by the system in its own process, often while the app has never
 * been opened, so there is nothing to ask. The payload the phone already
 * publishes is the whole model here too, decoded by the same `WearPayload`
 * the app uses — one definition, two readers.
 *
 * **Asynchronous, because it has to be.** `onTileRequest` is `@MainThread`,
 * which is exactly why it returns a future rather than a tile. The first
 * version of this file blocked on `Tasks.await` for the Data Layer read; that
 * throws on the main thread, the throw was swallowed, and the tile rendered
 * its "open the app on your phone" state for ever while the app two swipes
 * away showed the list. The payload is read through the task's own callback
 * instead, and the future is completed from there.
 */
class UnreadTileService : TileService() {

  override fun onTileRequest(
      requestParams: RequestBuilders.TileRequest
  ): ListenableFuture<TileBuilders.Tile> =
      CallbackToFutureAdapter.getFuture { completer ->
        Wearable.getDataClient(this).dataItems.addOnCompleteListener { task ->
          val payload =
              if (task.isSuccessful) {
                var found: WearPayload? = null
                val buffer = task.result
                buffer.forEach { item ->
                  if (item.uri.path == PhoneLink.PATH_PAYLOAD) {
                    found =
                        WearPayload.decode(
                            DataMapItem.fromDataItem(item).dataMap.getString("payload"))
                  }
                }
                buffer.release()
                found
              } else {
                null
              }
          completer.set(tileFor(payload))
        }
        // The tag `getFuture` uses in a debugger and in its own timeout logs.
        "langx-unread-tile"
      }

  private fun tileFor(payload: WearPayload?): TileBuilders.Tile {
    val unread = payload?.conversations?.sumOf { it.unread } ?: 0

    /*
     Three states, and they are the app's three. No payload means the phone
     has never spoken to this watch and the honest answer is to go and open
     it; an empty list is good news and must not read as a failure; a count
     is the ordinary case.
    */
    val headline: String
    val caption: String
    when {
      payload == null -> {
        headline = ""
        caption = getString(R.string.watch_openOnPhone)
      }
      unread == 0 -> {
        headline = ""
        caption = getString(R.string.watch_nothingUnread)
      }
      else -> {
        headline = unread.toString()
        caption = getString(R.string.watch_unread)
      }
    }

    val column =
        LayoutElementBuilders.Column.Builder()
            .setWidth(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            /*
             Inset from the sides, because a tile is a circle on nearly every
             watch: the two-line caption — "Open LangX on your phone" in
             German runs long — otherwise reaches the curve.
            */
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setPadding(
                        ModifiersBuilders.Padding.Builder()
                            .setStart(androidx.wear.protolayout.DimensionBuilders.dp(24f))
                            .setEnd(androidx.wear.protolayout.DimensionBuilders.dp(24f))
                            .build())
                    .build())

    if (headline.isNotEmpty()) {
      column.addContent(
          LayoutElementBuilders.Text.Builder()
              .setText(headline)
              .setFontStyle(
                  LayoutElementBuilders.FontStyle.Builder()
                      .setSize(androidx.wear.protolayout.DimensionBuilders.sp(40f))
                      .setWeight(LayoutElementBuilders.FONT_WEIGHT_BOLD)
                      .setColor(argb(PRIMARY))
                      .build())
              .build())
    }

    column.addContent(
        LayoutElementBuilders.Text.Builder()
            .setText(caption)
            .setMaxLines(2)
            .setFontStyle(
                LayoutElementBuilders.FontStyle.Builder()
                    .setSize(androidx.wear.protolayout.DimensionBuilders.sp(14f))
                    .setColor(argb(if (headline.isEmpty()) TEXT_MUTED else TEXT))
                    .build())
            .build())

    val root =
        LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setClickable(
                        ModifiersBuilders.Clickable.Builder()
                            .setId("open")
                            .setOnClick(
                                ActionBuilders.LaunchAction.Builder()
                                    .setAndroidActivity(
                                        ActionBuilders.AndroidActivity.Builder()
                                            .setPackageName(packageName)
                                            .setClassName(MainActivity::class.java.name)
                                            .build())
                                    .build())
                            .build())
                    .build())
            .addContent(column.build())
            .build()

    val tile =
        TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            /*
             The system re-asks on its own schedule anyway; this is the floor,
             not the mechanism. What actually keeps the tile current is
             `PayloadTileRefresher` below, which asks for a redraw the moment a
             new payload lands. Fifteen minutes is the backstop for a watch
             that missed one.
            */
            .setFreshnessIntervalMillis(15 * 60 * 1000)
            .setTileTimeline(
                TimelineBuilders.Timeline.Builder()
                    .addTimelineEntry(
                        TimelineBuilders.TimelineEntry.Builder().setLayout(
                                LayoutElementBuilders.Layout.Builder().setRoot(root).build())
                            .build())
                    .build())
            .build()

    return tile
  }

  override fun onTileResourcesRequest(
      requestParams: RequestBuilders.ResourcesRequest
  ): ListenableFuture<ResourceBuilders.Resources> =
      Futures.immediateFuture(
          ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())

  private companion object {
    const val RESOURCES_VERSION = "1"

    /** `Palette`'s values, as ARGB ints — protolayout has no Compose colours. */
    const val PRIMARY = 0xFFFFC409.toInt()
    const val TEXT = 0xFFF2F3F5.toInt()
    const val TEXT_MUTED = 0xFF9BA1A6.toInt()
  }
}

/**
 * Redraws the tile when the phone says something new.
 *
 * Without this the tile is only as fresh as its own interval, which on a
 * wrist means a count that is quietly wrong for up to fifteen minutes. A
 * `WearableListenerService` is started by the system for the payload path
 * whether or not the app is running, which is exactly the case a tile exists
 * for.
 *
 * It asks for a redraw rather than passing the payload along: the tile reads
 * the same store this was woken by, so handing it data would be a second copy
 * that could disagree with the first.
 */
class PayloadTileRefresher : WearableListenerService() {
  override fun onDataChanged(events: DataEventBuffer) {
    TileService.getUpdater(this).requestUpdate(UnreadTileService::class.java)
  }

  override fun onMessageReceived(event: MessageEvent) {
    // Nothing: replies are the app's business. Overridden only because the
    // base class logs an unhandled event otherwise.
  }
}
