Pod::Spec.new do |s|
  s.name           = 'VideoFilter'
  s.version        = '1.0.0'
  s.summary        = 'Draws a camera filter into a recorded clip.'
  s.description    = 'Local Expo module. See modules/video-filter/index.ts.'
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
