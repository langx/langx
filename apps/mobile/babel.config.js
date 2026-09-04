module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    /**
     * Reanimated's worklets are compiled here, not at runtime: the plugin is
     * what turns a `'worklet'`-marked function into something the UI thread can
     * run. Without it every `useAnimatedStyle` in the app throws on the first
     * frame, which is why this file grew a `plugins` key the day
     * `SwipeableRow` stopped using `PanResponder`.
     *
     * Last in the list, which the plugin's own docs require.
     */
    plugins: ['react-native-worklets/plugin'],
  }
}
