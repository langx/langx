package expo.modules.whatsappstickers

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.UriMatcher
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.File
import java.io.IOException
import org.json.JSONObject

/** One pack as `contents.json` lists it. */
data class StickerPackEntry(
    val identifier: String,
    val name: String,
    val publisher: String,
    val trayImageFile: String,
    val publisherWebsite: String,
    val privacyPolicyWebsite: String,
    val licenseAgreementWebsite: String,
    val imageDataVersion: String,
    val stickers: List<Pair<String, List<String>>>,
)

/**
 * `assets/whatsapp-stickers/contents.json`, the sample app's own format,
 * written by `scripts/build-whatsapp-stickers.ts` together with the pictures
 * beside it. Read once: it cannot change while the app runs.
 */
object StickerPackCatalog {
  const val ASSET_ROOT = "whatsapp-stickers"

  @Volatile private var cached: Pair<JSONObject, List<StickerPackEntry>>? = null

  private fun read(context: Context): Pair<JSONObject, List<StickerPackEntry>> =
      cached
          ?: synchronized(this) {
            cached
                ?: run {
                  val json =
                      context.assets.open("$ASSET_ROOT/contents.json").bufferedReader().use {
                        JSONObject(it.readText())
                      }
                  val packs = json.getJSONArray("sticker_packs")
                  val list =
                      (0 until packs.length()).map { i ->
                        val p = packs.getJSONObject(i)
                        val stickers = p.getJSONArray("stickers")
                        StickerPackEntry(
                            identifier = p.getString("identifier"),
                            name = p.getString("name"),
                            publisher = p.getString("publisher"),
                            trayImageFile = p.getString("tray_image_file"),
                            publisherWebsite = p.optString("publisher_website"),
                            privacyPolicyWebsite = p.optString("privacy_policy_website"),
                            licenseAgreementWebsite = p.optString("license_agreement_website"),
                            imageDataVersion = p.getString("image_data_version"),
                            stickers =
                                (0 until stickers.length()).map { j ->
                                  val s = stickers.getJSONObject(j)
                                  val emojis = s.getJSONArray("emojis")
                                  s.getString("image_file") to
                                      (0 until emojis.length()).map { k -> emojis.getString(k) }
                                },
                        )
                      }
                  (json to list).also { cached = it }
                }
          }

  fun load(context: Context): List<StickerPackEntry> = read(context).second

  fun link(context: Context, key: String): String = read(context).first.optString(key)
}

/**
 * What WhatsApp reads a pack through. A port of `StickerContentProvider` in
 * WhatsApp's official Android sample: the paths and the column names are
 * WhatsApp's contract and must stay exactly as they are.
 *
 * - `metadata`, `metadata/<id>` — the pack rows;
 * - `stickers/<id>` — one row per sticker: file name and emojis;
 * - `stickers_asset/<id>/<file>` — the picture itself.
 *
 * Only files the catalogue lists are served, so the provider cannot be used
 * to read anything else in the APK's assets.
 */
class StickerContentProvider : ContentProvider() {

  private val matcher = UriMatcher(UriMatcher.NO_MATCH)

  override fun onCreate(): Boolean {
    val authority = authority(requireNotNull(context))
    matcher.addURI(authority, METADATA, METADATA_CODE)
    matcher.addURI(authority, "$METADATA/*", METADATA_SINGLE_CODE)
    matcher.addURI(authority, "$STICKERS/*", STICKERS_CODE)
    matcher.addURI(authority, "$STICKERS_ASSET/*/*", STICKERS_ASSET_CODE)
    return true
  }

  private fun packs(): List<StickerPackEntry> = StickerPackCatalog.load(requireNotNull(context))

  override fun query(
      uri: Uri,
      projection: Array<out String>?,
      selection: String?,
      selectionArgs: Array<out String>?,
      sortOrder: String?,
  ): Cursor =
      when (matcher.match(uri)) {
        METADATA_CODE -> packCursor(packs())
        METADATA_SINGLE_CODE -> packCursor(packs().filter { it.identifier == uri.lastPathSegment })
        STICKERS_CODE -> stickerCursor(packs().firstOrNull { it.identifier == uri.lastPathSegment })
        else -> throw IllegalArgumentException("Unknown URI: $uri")
      }

  private fun packCursor(list: List<StickerPackEntry>): Cursor {
    val ctx = requireNotNull(context)
    val cursor =
        MatrixCursor(
            arrayOf(
                "sticker_pack_identifier",
                "sticker_pack_name",
                "sticker_pack_publisher",
                "sticker_pack_icon",
                "android_play_store_link",
                "ios_app_download_link",
                "sticker_pack_publisher_email",
                "sticker_pack_publisher_website",
                "sticker_pack_privacy_policy_website",
                "sticker_pack_license_agreement_website",
                "image_data_version",
                "whatsapp_will_not_cache_stickers",
                "animated_sticker_pack",
            ))
    for (p in list) {
      cursor.addRow(
          arrayOf<Any>(
              p.identifier,
              p.name,
              p.publisher,
              p.trayImageFile,
              StickerPackCatalog.link(ctx, "android_play_store_link"),
              StickerPackCatalog.link(ctx, "ios_app_store_link"),
              "",
              p.publisherWebsite,
              p.privacyPolicyWebsite,
              p.licenseAgreementWebsite,
              p.imageDataVersion,
              0,
              0,
          ))
    }
    return cursor
  }

  private fun stickerCursor(pack: StickerPackEntry?): Cursor {
    val cursor =
        MatrixCursor(arrayOf("sticker_file_name", "sticker_emoji", "sticker_accessibility_text"))
    pack?.stickers?.forEach { (file, emojis) -> cursor.addRow(arrayOf<Any?>(file, emojis.joinToString(","), null)) }
    return cursor
  }

  override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
    if (matcher.match(uri) != STICKERS_ASSET_CODE) return null
    val segments = uri.pathSegments
    if (segments.size != 3) return null
    val identifier = segments[1]
    val file = segments[2]
    val pack = packs().firstOrNull { it.identifier == identifier } ?: return null
    if (file != pack.trayImageFile && pack.stickers.none { it.first == file }) return null
    return open("${StickerPackCatalog.ASSET_ROOT}/$identifier/$file")
  }

  /**
   * The asset as a file descriptor. `openFd` only works on an asset stored
   * uncompressed, and whether the build compresses `.webp` is the Android
   * Gradle plugin's call, not ours — the sample turns compression off in
   * Gradle for this reason. Copying to the cache on failure works either way
   * without reaching into the app's build file.
   */
  private fun open(path: String): AssetFileDescriptor? {
    val ctx = requireNotNull(context)
    return try {
      ctx.assets.openFd(path)
    } catch (_: IOException) {
      try {
        val copy = File(ctx.cacheDir, path)
        if (!copy.exists()) {
          copy.parentFile?.mkdirs()
          val partial = File(copy.path + ".part")
          ctx.assets.open(path).use { input -> partial.outputStream().use { input.copyTo(it) } }
          partial.renameTo(copy)
        }
        AssetFileDescriptor(
            ParcelFileDescriptor.open(copy, ParcelFileDescriptor.MODE_READ_ONLY),
            0,
            AssetFileDescriptor.UNKNOWN_LENGTH)
      } catch (e: IOException) {
        Log.e(TAG, "cannot open $path", e)
        null
      }
    }
  }

  override fun getType(uri: Uri): String? {
    val authority = authority(requireNotNull(context))
    return when (matcher.match(uri)) {
      METADATA_CODE -> "vnd.android.cursor.dir/vnd.$authority.$METADATA"
      METADATA_SINGLE_CODE -> "vnd.android.cursor.item/vnd.$authority.$METADATA"
      STICKERS_CODE -> "vnd.android.cursor.dir/vnd.$authority.$STICKERS"
      STICKERS_ASSET_CODE -> if (uri.lastPathSegment?.endsWith(".png") == true) "image/png" else "image/webp"
      else -> null
    }
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int =
      throw UnsupportedOperationException()

  override fun update(
      uri: Uri,
      values: ContentValues?,
      selection: String?,
      selectionArgs: Array<out String>?,
  ): Int = throw UnsupportedOperationException()

  companion object {
    private const val TAG = "WhatsAppStickers"
    private const val METADATA = "metadata"
    private const val STICKERS = "stickers"
    private const val STICKERS_ASSET = "stickers_asset"
    private const val METADATA_CODE = 1
    private const val METADATA_SINGLE_CODE = 2
    private const val STICKERS_CODE = 3
    private const val STICKERS_ASSET_CODE = 4

    /** Must match `android:authorities` in this module's manifest. */
    fun authority(context: Context): String = "${context.packageName}.whatsappstickers"
  }
}
