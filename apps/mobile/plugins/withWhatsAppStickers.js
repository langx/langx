const { withInfoPlist } = require('expo/config-plugins')

/**
 * Lets the iOS app ask whether WhatsApp is installed, for "Add to WhatsApp"
 * on a sticker pack (`modules/whatsapp-stickers`).
 *
 * `canOpenURL` answers false for any scheme the app has not declared in
 * `LSApplicationQueriesSchemes`, installed or not — so without this the
 * button would never draw on an iPhone, and nothing would say why. WhatsApp's
 * own sample declares exactly `whatsapp`.
 *
 * Android needs nothing here: the module's own manifest carries the
 * `queries` entries and the content provider, and library manifests merge
 * into the app's at `prebuild`.
 *
 * Additive and idempotent, so another plugin's schemes survive. A native
 * change: it moves the runtime fingerprint.
 */
const SCHEMES = ['whatsapp']

function withWhatsAppStickers(config) {
  return withInfoPlist(config, (config) => {
    const current = config.modResults.LSApplicationQueriesSchemes ?? []
    const missing = SCHEMES.filter((scheme) => !current.includes(scheme))
    if (missing.length > 0) config.modResults.LSApplicationQueriesSchemes = [...current, ...missing]
    return config
  })
}

module.exports = withWhatsAppStickers
