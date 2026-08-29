/**
 * Re-exported from `@langx/shared`, where the engine lives so the API can word
 * push notifications and emails with the same plural rules. Kept as a local
 * module because every screen imports its message types from `../i18n`, and a
 * component has no business knowing which package the rules came from.
 */
export type { Catalog, Localized, Message, MessageParams, Paths, Plural } from '@langx/shared'
