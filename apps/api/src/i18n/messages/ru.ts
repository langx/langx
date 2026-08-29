import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const ru: Localized<ServerMessages> = {
  push: {
    /**
     * Russian splits at 1, at 2–4, and at 5+ — and again at 21, 22–24, 25+,
     * which is why this is a plural entry and not a string with a number in
     * front of it.
     */
    streakTitle: {
      one: 'Серия из {count} дня! 🔥',
      few: 'Серия из {count} дней! 🔥',
      many: 'Серия из {count} дней! 🔥',
      other: 'Серия из {count} дня! 🔥',
    },
    streakBody: 'Отправьте сегодня сообщение, чтобы её сохранить.',
  },

  email: {
    ignore: 'Если вы этого не запрашивали, просто проигнорируйте это письмо.',
    orPaste: 'Или вставьте эту ссылку: {url}',

    verifySubject: 'Подтвердите почту в LangX',
    verifyPreheader: 'Подтвердите почту, чтобы завершить настройку LangX',
    verifyBody: 'Подтвердите, что это ваш адрес, чтобы завершить создание аккаунта.',
    verifyButton: 'Подтвердить почту',
    verifyText: 'Подтвердите почту в LangX: {url}',

    resetSubject: 'Сброс пароля LangX',
    resetPreheader: 'Сброс пароля LangX',
    resetBody: 'Кто-то запросил сброс пароля для этого аккаунта. Если это были вы:',
    resetButton: 'Сбросить пароль',
    resetText: 'Сброс пароля LangX: {url}',
  },
}
