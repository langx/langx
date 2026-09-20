Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts and ends the agreed-call Live Activity.'
  s.description    = 'Local Expo module. See modules/live-activity/index.ts.'
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

  # `ExchangeActivity.swift` beside this file is a **symlink** into
  # `targets/_shared`, and it has to be. ActivityKit pairs a running activity
  # with the view that draws it by the attributes type, so the widget
  # extension and this module must agree exactly — and they are separate Swift
  # modules that cannot import each other, so the declaration is compiled
  # twice. A second real copy would be free to drift; a path out of this
  # directory is not an option either, because CocoaPods silently ignores a
  # `source_files` glob that climbs above the podspec. The symlink is what is
  # left, and `pod install` follows it.
  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
