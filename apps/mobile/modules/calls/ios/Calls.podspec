Pod::Spec.new do |s|
  s.name           = 'Calls'
  s.version        = '1.0.0'
  s.summary        = 'Rings an iPhone for a LangX call: PushKit and CallKit.'
  s.description    = 'Local Expo module. See modules/calls/index.ts.'
  s.author         = 'LangX'
  s.homepage       = 'https://github.com/langx/langx'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CallKit', 'PushKit', 'AVFoundation', 'StoreKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
