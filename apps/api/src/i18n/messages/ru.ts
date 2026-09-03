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

    whyThisMail: 'Вы получаете это из-за настроек уведомлений в LangX.',
    unsubscribeLink: 'Отключить эти письма',
    unsubscribeText: 'Отключить эти письма: {url}',
    managePrefs: 'Все настройки уведомлений',

    unsubscribeTitle: 'Отключить эти письма?',
    unsubscribeBody:
      'Вы перестанете получать {kind} на почту. Уведомления на телефоне не изменятся.',
    unsubscribeConfirm: 'Отключить',
    unsubscribeAll: 'Или отключить все письма от LangX',
    unsubscribedTitle: 'Готово — больше не придут.',
    unsubscribedBody: 'Включить обратно можно в любой момент в LangX: Настройки → Уведомления.',
    unsubscribeInvalid:
      'Ссылка недействительна. Откройте LangX и измените это в Настройках → Уведомления.',

    kind: {
      messages: 'сводки сообщений',
      streak: 'напоминания о стрике',
      profileVisits: 'сводки визитов в профиль',
      promotions: 'новости и предложения',
      all: 'письма от LangX',
    },
  },
}
