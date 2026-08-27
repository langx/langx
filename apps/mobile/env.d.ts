export {}

/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time (see apiFetch.ts's
 * doc comment on the native/web split), but without this declaration
 * `process` itself resolves to `any` in this project — Expo/RN apps don't
 * pull in `@types/node` (its globals conflict with the DOM/RN environment,
 * e.g. `setTimeout`'s return type), so there's no other source of a
 * `NodeJS.ProcessEnv` type here.
 */
declare global {
  const process: {
    env: {
      readonly EXPO_PUBLIC_API_URL?: string
    }
  }
}
