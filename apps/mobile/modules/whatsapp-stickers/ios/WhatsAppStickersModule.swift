import ExpoModulesCore
import UIKit

/**
 * The iOS half of "Add to WhatsApp", as WhatsApp's official sample does it
 * (`Interoperability.swift` in github.com/WhatsApp/stickers): the pack goes
 * on the pasteboard under WhatsApp's type, then `whatsapp://stickerPack`
 * opens WhatsApp, which reads it from there.
 *
 * The JSON is not built here. `scripts/build-whatsapp-stickers.ts` writes it
 * once per pack into `Packs/`, where `whatsappStickers.test.ts` checks it,
 * and this hands the bytes over unchanged.
 *
 * `canOpenURL("whatsapp://")` only answers truthfully when `whatsapp` is in
 * `LSApplicationQueriesSchemes` — `plugins/withWhatsAppStickers.js` adds it.
 */
public class WhatsAppStickersModule: Module {
  private static let pasteboardType = "net.whatsapp.third-party.sticker-pack"
  private static let whatsAppURL = URL(string: "whatsapp://stickerPack")!
  // The sample's figure: long enough to open WhatsApp, short enough that a
  // pack does not sit on the pasteboard for the rest of the day.
  private static let pasteboardSeconds: TimeInterval = 60

  public func definition() -> ModuleDefinition {
    Name("WhatsAppStickers")

    AsyncFunction("isWhatsAppInstalled") { () -> Bool in
      UIApplication.shared.canOpenURL(URL(string: "whatsapp://")!)
    }.runOnQueue(.main)

    AsyncFunction("addStickerPack") { (identifier: String, promise: Promise) in
      guard UIApplication.shared.canOpenURL(Self.whatsAppURL) else {
        promise.reject("ERR_NO_WHATSAPP", "WhatsApp is not installed")
        return
      }
      guard let payload = Self.payload(for: identifier) else {
        promise.reject("ERR_UNKNOWN_PACK", "No sticker pack '\(identifier)' in this build")
        return
      }
      // `localOnly`: never through Universal Clipboard to the person's Mac.
      UIPasteboard.general.setItems(
        [[Self.pasteboardType: payload]],
        options: [
          .localOnly: true,
          .expirationDate: Date(timeIntervalSinceNow: Self.pasteboardSeconds),
        ])
      UIApplication.shared.open(Self.whatsAppURL) { opened in
        if opened {
          promise.resolve(nil)
        } else {
          promise.reject("ERR_NO_WHATSAPP", "WhatsApp could not be opened")
        }
      }
    }.runOnQueue(.main)
  }

  /**
   * `Packs/<identifier>.json` from the pod's resource bundle. With
   * `static_framework` the bundle is copied into the app's own, so it is
   * looked for there as well as beside this class.
   */
  private static func payload(for identifier: String) -> Data? {
    for host in [Bundle(for: WhatsAppStickersModule.self), Bundle.main] {
      guard let bundleURL = host.url(forResource: "WhatsAppStickers", withExtension: "bundle"),
        let bundle = Bundle(url: bundleURL),
        let url = bundle.url(forResource: identifier, withExtension: "json")
      else { continue }
      return try? Data(contentsOf: url)
    }
    return nil
  }
}
