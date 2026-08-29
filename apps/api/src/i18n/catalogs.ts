import type { Catalog, Locale } from '@langx/shared'
import { ar } from './messages/ar'
import { de } from './messages/de'
import { en } from './messages/en'
import { es } from './messages/es'
import { fr } from './messages/fr'
import { ptBR } from './messages/pt-BR'
import { ru } from './messages/ru'
import { tr } from './messages/tr'

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
