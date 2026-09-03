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
    profileVisitsTitle: {
      one: '1 человек посмотрел ваш профиль',
      other: 'Ваш профиль посмотрели: {count}',
    },
    profileVisitsBody: 'Нажмите, чтобы увидеть кто.',
    badgeOneTitle: 'Новый значок: {label} 🏅',
    badgeManyTitle: {
      one: 'Вы получили 1 новый значок 🏅',
      other: 'Вы получили новых значков: {count} 🏅',
    },
    badgeBody: 'Отличная работа. Так держать.',
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
    /** The one button a streak email has. */
    openChats: 'Отправить сообщение',

    digestSubject: {
      one: '1 непрочитанное сообщение в LangX',
      other: 'Непрочитанных сообщений в LangX: {count}',
    },
    digestPreheader: 'Вам ждут ответа',
    digestBody: {
      one: '{names} написал(а) вам, пока вас не было.',
      other: 'У вас {count} непрочитанных сообщений — от {names}.',
    },
    digestMore: { one: 'И ещё один диалог.', other: 'И ещё диалогов: {count}.' },
    digestButton: 'Прочитать и ответить',

    visitsSubject: {
      one: 'На этой неделе ваш профиль посмотрел 1 человек',
      other: 'На этой неделе ваш профиль посмотрели: {count}',
    },
    visitsPreheader: 'Ваш профиль замечают',
    visitsBody: {
      one: 'За последнюю неделю ваш профиль посмотрел 1 человек.',
      other: 'За последнюю неделю ваш профиль посмотрели: {count}.',
    },
    visitsNames: 'Среди них: {names}.',
    visitsLocked: 'Оформите подписку, чтобы увидеть кто.',
    visitsButton: 'Посмотреть, кто заходил',

    badgeOneSubject: 'Новый значок: {label}',
    badgeManySubject: {
      one: 'Вы получили 1 новый значок',
      other: 'Вы получили новых значков: {count}',
    },
    badgeBody: 'Он уже в вашем профиле — его видно всем.',
    badgeButton: 'Посмотреть значки',

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
