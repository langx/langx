import { Platform } from 'react-native'

/**
 * Small values that belong to the device rather than the account: whether the
 * intro has been watched, and an onboarding draft that has to survive the app
 * being closed halfway through.
 *
 * Everything here runs **before anyone is signed in**, which decides the
 * failure mode: a read that throws must look like "nothing stored", never like
 * an error. A device with storage disabled, a private browser window, or a
 * platform where neither backend exists should show the intro one extra time —
 * it must not be able to stop the app from starting.
 *
 * Native uses `expo-secure-store` (already a dependency, for the session
 * cookie); web uses `localStorage`. Not `AsyncStorage`: adding a third storage
 * dependency to hold two strings is not worth it when both platforms already
 * have something.
 *
 * `expo-secure-store` is imported lazily inside each call for the same reason
 * `expo-notifications` is (see docs/decisions.md) — a native module resolved at
 * module scope is evaluated on web too, where it has nothing to bind to.
 */
const isWeb = Platform.OS === 'web'

/** Keys are namespaced so a value here can never collide with Better Auth's. */
export const FLAG_KEYS = {
  /** Same name and same meaning as v1's. */
  introSeen: 'introSeen',
  onboardingDraft: 'onboardingDraft',
  /**
   * The handle of whoever's invite link was opened, held until onboarding can
   * send it.
   *
   * A device flag rather than anything on the account, because it is captured
   * before there is an account — that is the whole point of an invite link.
   * Cleared by `resetDraft`, so finishing onboarding leaves nothing behind.
   */
  pendingReferrer: 'pendingReferrer',
  /** `auto` | `light` | `dark`. A device preference, not an account one. */
  themePreference: 'themePreference',
  /**
   * `auto` | one of `SUPPORTED_LOCALES`. Device-level for the same reason the
   * theme is: the phone is what has a language setting, and a shared tablet
   * should not change language when someone else signs in.
   */
  localePreference: 'localePreference',
  /**
   * Which tips have been dismissed, and whether tips are wanted at all.
   *
   * One JSON blob rather than a flag per tip, and deliberately not
   * `readBoolFlag`: `setBoolFlag` writes `1` or *clears*, so a bool cannot
   * tell "never set" from "explicitly off" — and this setting defaults to on.
   *
   * Device-level for the same reason as the theme and the locale: a tip you
   * have read is a fact about you having read it on this phone.
   */
  tips: 'tips',
  /**
   * Which of your learning languages the feed composer is set to.
   *
   * Device-level like the theme and the locale, and for a reason of its own:
   * the value is a *wish*, never a fact. It can name a language the account
   * signed in here is not learning — a shared phone, or a language dropped
   * since it was written. `resolvePostLanguage` sanitises it on read, so
   * nothing here has to be kept in step with the profile.
   */
  postLanguage: 'postLanguage',
} as const

export type FlagKey = (typeof FLAG_KEYS)[keyof typeof FLAG_KEYS]

export async function readFlag(key: FlagKey): Promise<string | null> {
  try {
    if (isWeb) return globalThis.localStorage?.getItem(key) ?? null
    const SecureStore = await import('expo-secure-store')
    return await SecureStore.getItemAsync(key)
  } catch {
    // Storage that cannot be read is storage that holds nothing.
    return null
  }
}

export async function writeFlag(key: FlagKey, value: string): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.setItem(key, value)
      return
    }
    const SecureStore = await import('expo-secure-store')
    await SecureStore.setItemAsync(key, value)
  } catch {
    // A flag that could not be written is a nicety lost, never a failure worth
    // surfacing: the worst case is seeing the intro again.
  }
}

export async function clearFlag(key: FlagKey): Promise<void> {
  try {
    if (isWeb) {
      globalThis.localStorage?.removeItem(key)
      return
    }
    const SecureStore = await import('expo-secure-store')
    await SecureStore.deleteItemAsync(key)
  } catch {
    // As above.
  }
}

/** `true` only when the flag is explicitly set — an unreadable store is "no". */
export async function readBoolFlag(key: FlagKey): Promise<boolean> {
  return (await readFlag(key)) === '1'
}

export async function setBoolFlag(key: FlagKey, value: boolean): Promise<void> {
  if (value) await writeFlag(key, '1')
  else await clearFlag(key)
}

/**
 * Reads and parses a JSON value, returning `null` for anything that does not
 * come back as the expected shape. A draft written by an older build must not
 * be able to crash the screen that reads it.
 */
export async function readJsonFlag<T>(key: FlagKey): Promise<T | null> {
  const raw = await readFlag(key)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as T) : null
  } catch {
    return null
  }
}

export async function writeJsonFlag(key: FlagKey, value: unknown): Promise<void> {
  try {
    await writeFlag(key, JSON.stringify(value))
  } catch {
    // A value that cannot be serialised is not worth crashing over.
  }
}
