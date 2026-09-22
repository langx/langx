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
 * The conversation an `OpenConversationIntent` phrase names.
 *
 * `\(\.$conversation)` in Swift, and the parameter's own name is what binds
 * the two — rename the property and every phrase stops matching, in eight
 * languages at once, with nothing to say so. The generator checks the pairing
 * against the Swift rather than trusting it.
 */
export const CONVERSATION = '${conversation}'

/**
 * The shortcuts, in the order Siri offers them.
 *
 * Three, for the three intents in `app-intents/OpenIntents.swift`. The last
 * one carries a **second** token, `${conversation}`, which is the parameter
 * Siri fills from the directory the app writes — and which obeys the same
 * rule as the app's name: present in every language, or that language's
 * phrase matches nothing.
 *
 * What is still missing is the plan's fourth idea, sending a message to a
 * named person, and it is missing for a reason that has nothing to do with
 * phrases; see `docs/plans/phase-1-app-intents.md`.
 */
export const SIRI_SHORTCUTS = ['openEchoReview', 'openChats', 'openConversation'] as const

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
    openConversation: [
      `Open my ${APPLICATION_NAME} chat with ${CONVERSATION}`,
      `Open ${CONVERSATION} in ${APPLICATION_NAME}`,
    ],
  },
  tr: {
    openEchoReview: [`${APPLICATION_NAME} tekrarımı aç`, `${APPLICATION_NAME} tekrarıma başla`],
    openChats: [`${APPLICATION_NAME} mesajlarımı aç`, `${APPLICATION_NAME} sohbetlerimi göster`],
    openConversation: [
      `${APPLICATION_NAME} sohbetimi ${CONVERSATION} ile aç`,
      `${CONVERSATION} sohbetini ${APPLICATION_NAME} ile aç`,
    ],
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
    openConversation: [
      `Abrir mi chat de ${APPLICATION_NAME} con ${CONVERSATION}`,
      `Abrir ${CONVERSATION} en ${APPLICATION_NAME}`,
    ],
  },
  ru: {
    openEchoReview: [
      `Открыть повторение в ${APPLICATION_NAME}`,
      `Начать повторение в ${APPLICATION_NAME}`,
    ],
    openChats: [`Открыть сообщения в ${APPLICATION_NAME}`, `Показать чаты в ${APPLICATION_NAME}`],
    openConversation: [
      `Открыть чат с ${CONVERSATION} в ${APPLICATION_NAME}`,
      `Открыть ${CONVERSATION} в ${APPLICATION_NAME}`,
    ],
  },
  ar: {
    openEchoReview: [`افتح مراجعة ${APPLICATION_NAME}`, `ابدأ مراجعة ${APPLICATION_NAME}`],
    openChats: [`افتح رسائل ${APPLICATION_NAME}`, `اعرض محادثات ${APPLICATION_NAME}`],
    openConversation: [
      `افتح محادثة ${APPLICATION_NAME} مع ${CONVERSATION}`,
      `افتح ${CONVERSATION} في ${APPLICATION_NAME}`,
    ],
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
    openConversation: [
      `Ouvrir ma conversation ${APPLICATION_NAME} avec ${CONVERSATION}`,
      `Ouvrir ${CONVERSATION} dans ${APPLICATION_NAME}`,
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
    openConversation: [
      `Meinen ${APPLICATION_NAME} Chat mit ${CONVERSATION} öffnen`,
      `${CONVERSATION} in ${APPLICATION_NAME} öffnen`,
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
    openConversation: [
      `Abrir minha conversa do ${APPLICATION_NAME} com ${CONVERSATION}`,
      `Abrir ${CONVERSATION} no ${APPLICATION_NAME}`,
    ],
  },
}

/** The source language, whose phrases are the catalogue's keys. */
export const SIRI_SOURCE: Locale = 'en'

/** How many times `APPLICATION_NAME` appears in a phrase. Apple wants one. */
export function applicationNameCount(phrase: string): number {
  return phrase.split(APPLICATION_NAME).length - 1
}

/**
 * Every `${token}` in a phrase, in the order they appear.
 *
 * Used to compare a translation against its English source: a phrase says the
 * same thing in eight languages only if it names the same things, and a token
 * dropped or duplicated in one of them is a phrase that language never
 * matches. Order is kept because it makes a failure readable, not because
 * Apple cares about it — `${conversation}` may lead in Russian and trail in
 * English, and both are right.
 */
export function tokensIn(phrase: string): string[] {
  return [...phrase.matchAll(/\$\{([a-zA-Z]+)\}/g)].map(([, token]) => token ?? '')
}

/**
 * The three SiriKit messaging intents the Intents extension answers — see
 * `targets/intents/Info.plist`, which declares the same three.
 */
export const SIRI_MESSAGING_INTENTS = [
  'INSendMessageIntent',
  'INSearchForMessagesIntent',
  'INSetMessageAttributeIntent',
] as const

export type SiriMessagingIntent = (typeof SIRI_MESSAGING_INTENTS)[number]

/**
 * The app's name as it is spoken in an example, literally.
 *
 * Not `APPLICATION_NAME`: that token is an App Shortcuts placeholder iOS
 * substitutes, and `AppIntentVocabulary.plist` is an older mechanism that
 * substitutes nothing. An example is shown to the person as written.
 */
export const SPOKEN_APP_NAME = 'LangX'

/**
 * One example sentence per messaging intent, per language, for the
 * `AppIntentVocabulary.plist` iOS reads them from.
 *
 * **Apple checks these at upload, not at build.** Build 172 of 2.6 compiled,
 * signed and uploaded without them, and App Store Connect then sent
 * ITMS-90626 — *Invalid Siri Support: no example phrase was provided* — for
 * all three intents in all eight languages: twenty-four warnings, delivered
 * after the binary was already there. Siri shows these to somebody who asks
 * what LangX can do, which is why each one names the app and a person.
 *
 * The person is Sofia, the demo account every example in this repo uses, and
 * never a real user's name.
 */
export const SIRI_INTENT_EXAMPLES: Record<Locale, Record<SiriMessagingIntent, string>> = {
  en: {
    INSendMessageIntent: 'Send a message to Sofia on LangX',
    INSearchForMessagesIntent: 'Read my new messages on LangX',
    INSetMessageAttributeIntent: 'Mark my LangX messages as read',
  },
  tr: {
    INSendMessageIntent: "LangX'te Sofia'ya mesaj gönder",
    INSearchForMessagesIntent: "LangX'teki yeni mesajlarımı oku",
    INSetMessageAttributeIntent: 'LangX mesajlarımı okundu olarak işaretle',
  },
  es: {
    INSendMessageIntent: 'Envía un mensaje a Sofia en LangX',
    INSearchForMessagesIntent: 'Lee mis mensajes nuevos de LangX',
    INSetMessageAttributeIntent: 'Marca mis mensajes de LangX como leídos',
  },
  ru: {
    INSendMessageIntent: 'Отправь сообщение Софии в LangX',
    INSearchForMessagesIntent: 'Прочитай мои новые сообщения в LangX',
    INSetMessageAttributeIntent: 'Отметь мои сообщения в LangX как прочитанные',
  },
  ar: {
    INSendMessageIntent: 'أرسل رسالة إلى صوفيا على LangX',
    INSearchForMessagesIntent: 'اقرأ رسائلي الجديدة على LangX',
    INSetMessageAttributeIntent: 'علّم رسائل LangX كمقروءة',
  },
  fr: {
    INSendMessageIntent: 'Envoie un message à Sofia sur LangX',
    INSearchForMessagesIntent: 'Lis mes nouveaux messages LangX',
    INSetMessageAttributeIntent: 'Marque mes messages LangX comme lus',
  },
  de: {
    INSendMessageIntent: 'Sende eine Nachricht an Sofia mit LangX',
    INSearchForMessagesIntent: 'Lies meine neuen LangX Nachrichten',
    INSetMessageAttributeIntent: 'Markiere meine LangX Nachrichten als gelesen',
  },
  'pt-BR': {
    INSendMessageIntent: 'Envie uma mensagem para Sofia no LangX',
    INSearchForMessagesIntent: 'Leia minhas novas mensagens do LangX',
    INSetMessageAttributeIntent: 'Marque minhas mensagens do LangX como lidas',
  },
}
