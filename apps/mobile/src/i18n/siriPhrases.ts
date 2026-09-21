import type { Locale } from '@langx/shared'

/**
 * What somebody can say out loud to open part of this app.
 *
 * Deliberately **not** in `messages/*.ts`, and the reason is that these are
 * not strings the app draws. Nothing calls `t()` for them; they are matched
 * against speech by Siri, they never appear on a screen, and they obey a rule
 * no message key has — see `APPLICATION_NAME` below. Keeping them here means
 * `catalogs.test.ts` does not have to grow an exception, and a reader of
 * `en.ts` is not left wondering what `${applicationName}` is doing in a
 * sentence.
 *
 * `scripts/generate-xcstrings.ts` turns this into `AppShortcuts.xcstrings`,
 * which is the only file iOS reads phrases out of — `Localizable` is not
 * consulted for them, whatever else a target holds.
 */

/**
 * The token Siri replaces with the app's name, and the one hard rule here.
 *
 * Apple requires every phrase to contain it **exactly once**, in every
 * language. A phrase that drops it is not rejected and does not warn: iOS
 * simply never matches it, so the shortcut exists in that language and answers
 * to nothing. A translator moving it out of the sentence is the likely way
 * that happens, which is why `siriPhrases.test.ts` counts it in all eight.
 *
 * In Swift the same token is spelled `\(.applicationName)`; in the catalogue
 * it is `${applicationName}`, and the generator's job is partly to keep those
 * two spellings of one thing from drifting.
 */
export const APPLICATION_NAME = '${applicationName}'

/**
 * The shortcuts, in the order Siri offers them.
 *
 * Two, because two intents exist: `OpenEchoReviewIntent` and
 * `OpenChatsIntent` in `app-intents/OpenIntents.swift`. The third of the
 * plan's intents — send a message to a named person — is not here because it
 * is not built; see `docs/plans/phase-1-app-intents.md`.
 */
export const SIRI_SHORTCUTS = ['openEchoReview', 'openChats'] as const

export type SiriShortcut = (typeof SIRI_SHORTCUTS)[number]

/**
 * Two phrasings each, not one and not six.
 *
 * One is fragile — speech is not a command line, and "open" and "start" are
 * both what people say about a review. Six is a translation bill paid eight
 * times for diminishing returns, and Apple's own matching already forgives a
 * good deal of variation around a phrase it has.
 *
 * The first phrase of each pair is the one Apple shows in the Shortcuts app
 * and in Spotlight, so it is the plainer of the two in every language.
 */
export const SIRI_PHRASES: Record<Locale, Record<SiriShortcut, readonly [string, string]>> = {
  en: {
    openEchoReview: [`Open my ${APPLICATION_NAME} review`, `Start my ${APPLICATION_NAME} review`],
    openChats: [`Open my ${APPLICATION_NAME} messages`, `Show my ${APPLICATION_NAME} chats`],
  },
  tr: {
    openEchoReview: [`${APPLICATION_NAME} tekrarımı aç`, `${APPLICATION_NAME} tekrarıma başla`],
    openChats: [`${APPLICATION_NAME} mesajlarımı aç`, `${APPLICATION_NAME} sohbetlerimi göster`],
  },
  es: {
    openEchoReview: [
      `Abrir mi repaso de ${APPLICATION_NAME}`,
      `Empezar mi repaso de ${APPLICATION_NAME}`,
    ],
    openChats: [
      `Abrir mis mensajes de ${APPLICATION_NAME}`,
      `Mostrar mis chats de ${APPLICATION_NAME}`,
    ],
  },
  ru: {
    openEchoReview: [
      `Открыть повторение в ${APPLICATION_NAME}`,
      `Начать повторение в ${APPLICATION_NAME}`,
    ],
    openChats: [`Открыть сообщения в ${APPLICATION_NAME}`, `Показать чаты в ${APPLICATION_NAME}`],
  },
  ar: {
    openEchoReview: [`افتح مراجعة ${APPLICATION_NAME}`, `ابدأ مراجعة ${APPLICATION_NAME}`],
    openChats: [`افتح رسائل ${APPLICATION_NAME}`, `اعرض محادثات ${APPLICATION_NAME}`],
  },
  fr: {
    openEchoReview: [
      `Ouvrir ma révision ${APPLICATION_NAME}`,
      `Commencer ma révision ${APPLICATION_NAME}`,
    ],
    openChats: [
      `Ouvrir mes messages ${APPLICATION_NAME}`,
      `Afficher mes conversations ${APPLICATION_NAME}`,
    ],
  },
  de: {
    openEchoReview: [
      `Meine ${APPLICATION_NAME} Wiederholung öffnen`,
      `Meine ${APPLICATION_NAME} Wiederholung starten`,
    ],
    openChats: [
      `Meine ${APPLICATION_NAME} Nachrichten öffnen`,
      `Meine ${APPLICATION_NAME} Chats zeigen`,
    ],
  },
  'pt-BR': {
    openEchoReview: [
      `Abrir minha revisão do ${APPLICATION_NAME}`,
      `Começar minha revisão do ${APPLICATION_NAME}`,
    ],
    openChats: [
      `Abrir minhas mensagens do ${APPLICATION_NAME}`,
      `Mostrar meus chats do ${APPLICATION_NAME}`,
    ],
  },
}

/** The source language, whose phrases are the catalogue's keys. */
export const SIRI_SOURCE: Locale = 'en'

/** How many times `APPLICATION_NAME` appears in a phrase. Apple wants one. */
export function applicationNameCount(phrase: string): number {
  return phrase.split(APPLICATION_NAME).length - 1
}
