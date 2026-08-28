/**
 * Whether the on-screen debug panels are drawn.
 *
 * **Off unless two independent things are true**: the explicit environment
 * flag, and `__DEV__`. The reasoning is `fakePurchases.ts`'s — Expo inlines
 * `EXPO_PUBLIC_*` at build time, so a flag left set in a shell can follow a
 * `pnpm build:web` into a published bundle without saying so. `__DEV__` is
 * the condition that holds regardless of how the environment is set, and it
 * is the reason a debug panel can be written without weighing what it leaks.
 */
export function isDebugPanelEnabled(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_DEBUG_PANEL === '1'
}
