import type { Catalog, Locale } from '@langx/shared'
import { ar } from './messages/ar'
import { de } from './messages/de'
import { en } from './messages/en'
import { es } from './messages/es'
import { fr } from './messages/fr'
import { ptBR } from './messages/pt-BR'
import { ru } from './messages/ru'
import { tr } from './messages/tr'

/**
 * Every supported locale, complete.
 *
 * `Localized<EnMessages>` on each file is what makes "complete" true rather
 * than hoped for: a key added to English and to no one else does not compile.
 */
export const catalogs: Record<Locale, Catalog> = {
  en,
  tr,
  es,
  ru,
  ar,
  fr,
  de,
  'pt-BR': ptBR,
}
