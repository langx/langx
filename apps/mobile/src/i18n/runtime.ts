import {
  DEFAULT_LOCALE,
  translate,
  type Locale,
  type MessageParams,
  type Paths,
} from '@langx/shared'
import { catalogs } from './catalogs'
import { en } from './messages/en'

/**
 * Translation with no React and no `react-native` anywhere in its import
 * graph.
 *
 * Split from `I18nProvider` for a concrete reason: `vitest.config.ts` runs the
 * pure modules under `src/lib` in Node, where importing `react-native` fails
 * outright (`Flow is not supported`). Those modules take a `t` and their tests
 * have to be able to build one — so the thing that builds it cannot be in the
 * same file as `I18nManager`.
 */
export type MessageKey = Paths<typeof en>
export type TranslateFn = (key: MessageKey, params?: MessageParams) => string

/**
 * The locale the app is currently in, kept outside React.
 *
 * A deliberate mutable singleton, and the only one: `lib/alert.ts` and
 * `lib/toast.ts` are imperative APIs called from event handlers and `catch`
 * blocks, where there is no component to hold a hook. Threading `t` through
 * every one of those call sites would put a translation argument on functions
 * whose whole point is that they can be called from anywhere.
 *
 * Written by the provider on every locale change, so it is never more than a
 * render behind what is on screen.
 */
let activeLocale: Locale = DEFAULT_LOCALE

/** Called by `I18nProvider` only. */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale
}

/**
 * A `t` outside React — for tests, and for the few pure modules that format
 * their own text and are handed one by their caller.
 */
export function createTranslate(locale: Locale): TranslateFn {
  const catalog = catalogs[locale]
  return (key, params) => translate(catalog, en, locale, key, params)
}

/** For imperative code only. Anything inside a component wants `useT`. */
export function currentTranslate(): TranslateFn {
  return createTranslate(activeLocale)
}

/** The tag to send as `Accept-Language`, and to register a device with. */
export function currentLocale(): Locale {
  return activeLocale
}
