import {
  DEFAULT_LOCALE,
  resolveLocale,
  translate,
  type Locale,
  type MessageParams,
  type Paths,
} from '@langx/shared'
import { catalogs } from './catalogs'
import { en } from './messages/en'

export type ServerMessageKey = Paths<typeof en>
export type ServerTranslateFn = (key: ServerMessageKey, params?: MessageParams) => string

/**
 * A `t` for one locale.
 *
 * Built per call rather than held in a module: unlike the app, the server has
 * no "current" locale — every request and every push is for a different
 * person, and a mutable one here would be a race between two of them.
 */
export function translator(locale: Locale): ServerTranslateFn {
  const catalog = catalogs[locale]
  return (key, params) => translate(catalog, en, locale, key, params)
}

/**
 * The locale to write in for a request that carries no stored preference.
 *
 * `Accept-Language` is already sorted by quality by the client, which is
 * exactly the order `resolveLocale` wants. The app sets it from whatever the
 * reader picked in Settings, so a user reading Turkish on an English phone
 * gets a Turkish verification email — the case a device-language guess gets
 * wrong.
 */
export function localeFromHeader(header: string | undefined): Locale {
  if (!header) return DEFAULT_LOCALE
  // "tr-TR,tr;q=0.9,en;q=0.8" → ['tr-TR', 'tr', 'en']
  const tags = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .filter((tag): tag is string => !!tag)
  return resolveLocale(tags)
}
