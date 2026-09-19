Pod::Spec.new do |s|
  s.name           = 'CompanionSnapshot'
  s.version        = '1.0.0'
  s.summary        = 'Writes the widget snapshot into the App Group container.'
  s.description    = 'Local Expo module. See modules/companion-snapshot/index.ts.'
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
end
