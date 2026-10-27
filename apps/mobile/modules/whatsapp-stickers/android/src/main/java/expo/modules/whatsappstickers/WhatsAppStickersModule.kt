package expo.modules.whatsappstickers

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The Android half of "Add to WhatsApp": find WhatsApp, then ask it to add
 * a pack it will read out of [StickerContentProvider].
 *
 * Follows `AddStickerPackActivity` in WhatsApp's official sample
 * (github.com/WhatsApp/stickers), including `startActivityForResult` rather
 * than `startActivity`: that is the launch WhatsApp is tested against, and
 * only a for-result launch tells the receiving activity who called it. The
 * result itself (WhatsApp's `validation_error`) is not read — nothing here
 * could show it to the person usefully.
 */
class WhatsAppStickersModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("WhatsAppStickers")

    AsyncFunction("isWhatsAppInstalled") { installedWhatsApps(context).isNotEmpty() }

    AsyncFunction("addStickerPack") { identifier: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val name =
          StickerPackCatalog.load(context).firstOrNull { it.identifier == identifier }?.name
              ?: throw CodedException("ERR_UNKNOWN_PACK", "No sticker pack '$identifier' in this build", null)
      val installed = installedWhatsApps(context)
      if (installed.isEmpty()) throw CodedException("ERR_NO_WHATSAPP", "WhatsApp is not installed", null)

      val intent =
          Intent(ACTION_ENABLE_STICKER_PACK).apply {
            putExtra(EXTRA_PACK_ID, identifier)
            putExtra(EXTRA_PACK_AUTHORITY, StickerContentProvider.authority(context))
            putExtra(EXTRA_PACK_NAME, name)
          }
      try {
        // Both WhatsApp and WhatsApp Business: let the person pick, as the
        // sample does, rather than whichever one Android defaults to.
        if (installed.size == 1) {
          intent.setPackage(installed.first())
          activity.startActivityForResult(intent, REQUEST_ADD_PACK)
        } else {
          activity.startActivityForResult(Intent.createChooser(intent, null), REQUEST_ADD_PACK)
        }
      } catch (e: ActivityNotFoundException) {
        // A WhatsApp too old to know the action.
        throw CodedException("ERR_NO_WHATSAPP", "WhatsApp cannot add sticker packs", e)
      }
    }.runOnQueue(Queues.MAIN)
  }

  companion object {
    private const val ACTION_ENABLE_STICKER_PACK = "com.whatsapp.intent.action.ENABLE_STICKER_PACK"
    private const val EXTRA_PACK_ID = "sticker_pack_id"
    private const val EXTRA_PACK_AUTHORITY = "sticker_pack_authority"
    private const val EXTRA_PACK_NAME = "sticker_pack_name"
    private const val REQUEST_ADD_PACK = 200

    /** Both apps take sticker packs. Declared in this module's manifest `queries`. */
    private val WHATSAPP_PACKAGES = listOf("com.whatsapp", "com.whatsapp.w4b")

    fun installedWhatsApps(context: Context): List<String> =
        WHATSAPP_PACKAGES.filter { pkg ->
          try {
            context.packageManager.getApplicationInfo(pkg, 0).enabled
          } catch (_: PackageManager.NameNotFoundException) {
            false
          }
        }
  }
}
