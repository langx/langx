/**
 * Metro turns an imported image into an asset id (a number). Expo's own types
 * do not declare it, `expo-env.d.ts` is generated and gitignored so nothing
 * committed can rely on it, and `require()` is banned by the lint config —
 * which leaves one small file that has to be a script rather than a module,
 * since an ambient declaration inside a module is not ambient at all.
 */
declare module '*.png' {
  const asset: number
  export default asset
}
