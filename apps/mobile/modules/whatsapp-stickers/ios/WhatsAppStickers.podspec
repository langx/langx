Pod::Spec.new do |s|
  s.name           = 'WhatsAppStickers'
  s.version        = '1.0.0'
  s.summary        = 'Hands a LangX sticker pack to WhatsApp through the pasteboard.'
  s.description    = 'Local Expo module. See modules/whatsapp-stickers/index.ts.'
  s.author         = 'LangX'
  s.homepage       = 'https://github.com/langx/langx'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # The pasteboard payloads `scripts/build-whatsapp-stickers.ts` writes, one
  # per pack, ready to hand over byte for byte.
  s.resource_bundles = { 'WhatsAppStickers' => ['Packs/*.json'] }
end
