export {}

/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time (see apiFetch.ts's
 * doc comment on the native/web split), but without this declaration
 * `process` itself resolves to `any` in this project — Expo/RN apps don't
 * pull in `@types/node` (its globals conflict with the DOM/RN environment,
 * e.g. `setTimeout`'s return type), so there's no other source of a
 * `NodeJS.ProcessEnv` type here.
 */
interface ExpoPublicEnv {
  readonly EXPO_PUBLIC_API_URL?: string
  /**
   * RevenueCat SDK keys. Public by design — they identify the app to
   * RevenueCat and are compiled into the bundle; the secret key that can
   * read and write subscriber records is a server-only variable and must
   * never appear under this prefix.
   *
   * The per-platform pair is what a released build uses. The Test Store
   * key is a single key covering both platforms, and is all this project
   * has until real App Store / Play configurations exist.
   */
  readonly EXPO_PUBLIC_REVENUECAT_IOS_KEY?: string
  readonly EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?: string
  /**
   * The Web Billing key — a third store rather than a third platform. It
   * belongs to its own RevenueCat app, with its own Stripe connection,
   * products and offering, and starts `rcb_` where the pair above start
   * `appl_` and `goog_`. Unset, the web paywall says purchasing is
   * unavailable and the two native builds are untouched.
   */
  readonly EXPO_PUBLIC_REVENUECAT_WEB_KEY?: string
  readonly EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY?: string
  /**
   * `'1'` replaces RevenueCat entirely with the local development harness
   * in `lib/fakePurchases.ts`, so the paywall can be bought from on web
   * and without store products. Only ever read together with `__DEV__`,
   * and the API needs its own `REVENUECAT_FAKE_STORE` for the purchase to
   * land anywhere — see `docs/billing-testing.md`.
   */
  readonly EXPO_PUBLIC_REVENUECAT_FAKE_STORE?: string
  /**
   * PostHog project API key and ingestion host. Public by design, like the
   * RevenueCat keys: the key can only write events, never read them. Unset,
   * the SDK is never loaded, Settings shows no analytics row and nothing
   * leaves the device — see `lib/analytics.ts`.
   */
  readonly EXPO_PUBLIC_POSTHOG_KEY?: string
  readonly EXPO_PUBLIC_POSTHOG_HOST?: string
}

declare global {
  const process: { env: ExpoPublicEnv }

  /**
   * The name Expo's own types reach for, given a shape so it is not `any`.
   *
   * `expo/types` declares `var process: NodeJS.Process`, and `NodeJS` is what
   * `@types/node` would define — which this project deliberately does not
   * install, for the reason above. So wherever Expo's types enter the program
   * that declaration wins, `process` becomes `any`, and the lint rules about
   * `any` start firing in files nobody touched: it takes only a dependency two
   * levels away that happens to reference `expo`.
   *
   * Deliberately looser than `ExpoPublicEnv` and not built from it. This is
   * the *other* `process` — the one `app.config.ts` reads under plain Node,
   * where the variables are not all `EXPO_PUBLIC_` and a test is allowed to
   * write one. Naming every key here would be a second catalogue to keep in
   * step; `string | undefined` is what an environment variable is, and it is
   * enough to stop `any` spreading.
   */
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined
    }
    interface Process {
      env: ProcessEnv
    }
  }
}
