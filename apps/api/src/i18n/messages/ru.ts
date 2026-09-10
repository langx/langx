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
    meetingTitle: 'Языковой обмен через час',
    meetingBody: 'Нажми, чтобы открыть беседу.',
    bountyTitle: {
      one: '{count} жетон за твоё сообщение 🎉',
      few: '{count} жетона за твоё сообщение 🎉',
      many: '{count} жетонов за твоё сообщение 🎉',
      other: '{count} жетона за твоё сообщение 🎉',
    },
    bountyBody: 'Мы прочитали то, что ты прислал, — это того стоило.',
    /** Security, which no preference can switch off. */
    securityBody: 'Откройте LangX, если это были не вы.',
    securityBodyDevice: 'С устройства {device}. Откройте LangX, если это были не вы.',
    security: {
      newSignInTitle: 'Новый вход в аккаунт',
      passwordChangedTitle: 'Пароль изменён',
      methodLinkedTitle: 'Добавлен способ входа',
      methodUnlinkedTitle: 'Удалён способ входа',
    },
  },

  email: {
    ignore: 'Если вы этого не запрашивали, просто проигнорируйте это письмо.',
    orPaste: 'Или вставьте эту ссылку: {url}',

    deleteSubject: 'Подтвердите удаление аккаунта LangX',
    deletePreheader: 'Ещё один шаг для удаления аккаунта LangX',
    deleteBody:
      'Вы запросили удаление аккаунта LangX. Подтвердите ниже, и он будет поставлен в очередь на удаление — у вас есть 30 дней, чтобы передумать: просто войдите снова.',
    deleteButton: 'Удалить аккаунт',
    deleteText: 'Подтвердите удаление аккаунта LangX: {url}',
    deleteInvalid: 'Срок действия ссылки истёк или она уже использована.',
    deleteConfirmTitle: 'Удаление аккаунта LangX',
    deleteConfirmBody:
      'Аккаунт будет поставлен в очередь на удаление. Вход в течение 30 дней отменяет его.',
    deleteConfirmButton: 'Да, удалить аккаунт',
    deleteDoneTitle: 'Аккаунт поставлен в очередь на удаление',
    deleteDoneBody: 'Войдите в течение {days} дней — и всё вернётся.',
    deleteDonePurge: 'Данные удаляются {date}.',

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
    magicLinkSubject: 'Ваша ссылка для входа в LangX',
    magicLinkPreheader: 'Нажмите, чтобы войти в LangX',
    magicLinkBody:
      'Нажмите кнопку, чтобы войти. Ссылка работает один раз и истекает через 15 минут.',
    magicLinkButton: 'Войти в LangX',
    magicLinkText: 'Войти в LangX (одноразовая ссылка, истекает через 15 минут): {url}',

    existingSubject: 'У вас уже есть аккаунт LangX',
    existingPreheader: 'У вас уже есть аккаунт LangX',
    existingBody:
      'Кто-то попытался зарегистрироваться с этой почтой, но аккаунт для неё уже существует. Чтобы войти, сбросьте пароль или войдите через Google или Apple с этим адресом.',
    existingButton: 'Сбросить пароль',
    existingText: 'У вас уже есть аккаунт LangX. Сбросьте пароль здесь: {url}',

    existingLinkBody:
      'Кто-то попытался зарегистрироваться с этой почтой, но у вас здесь уже есть аккаунт с вашим профилем. Нажмите, чтобы войти, — пароль не нужен. Ссылка работает один раз и истекает через 15 минут.',
    existingLinkText:
      'У вас уже есть аккаунт LangX. Войдите здесь (одноразовая ссылка, истекает через 15 минут): {url}',

    whyThisMail: 'Вы получаете это из-за настроек уведомлений в LangX.',
    unsubscribeLink: 'Отключить эти письма',
    unsubscribeText: 'Отключить эти письма: {url}',
    managePrefs: 'Все настройки уведомлений',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Скачайте приложение',
    getAppScan: 'Отсканируйте телефоном или откройте',
    getAppPlatforms: 'iPhone · Android · Браузер',
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

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Устройство',

    securityPlace: 'Место',

    securityWhen: 'Когда',

    securityNotYou:
      'Если это были не вы, сразу смените пароль — это завершит сеансы на всех остальных устройствах.',

    securityButton: 'Сменить пароль',

    security: {
      newSignInTitle: 'Новый вход в ваш аккаунт LangX',

      newSignInBody: 'Кто-то вошёл в ваш аккаунт с устройства, которого мы раньше не видели.',

      passwordChangedTitle: 'Пароль LangX изменён',

      passwordChangedBody: 'Пароль вашего аккаунта только что изменили.',

      methodLinkedTitle: 'К вашему аккаунту LangX добавлен способ входа',

      methodLinkedBody: 'К аккаунту подключён вход через Google или Apple.',

      methodUnlinkedTitle: 'Из вашего аккаунта LangX удалён способ входа',

      methodUnlinkedBody: 'Один из способов входа в аккаунт отключён.',
    },

    kind: {
      messages: 'сводки сообщений',
      streak: 'напоминания о стрике',
      profileVisits: 'сводки визитов в профиль',
      promotions: 'новости и предложения',
      all: 'письма от LangX',
      v1contact: 'единственное сообщение о новом LangX',
    },
    bountySubject: {
      one: 'Тебе начислен {count} жетон за твоё сообщение',
      few: 'Тебе начислено {count} жетона за твоё сообщение',
      many: 'Тебе начислено {count} жетонов за твоё сообщение',
      other: 'Тебе начислено {count} жетона за твоё сообщение',
    },
    bountyPreheader: 'Спасибо, что рассказал.',
    bountyBody: {
      one: 'Мы прочитали твоё сообщение и добавили в кошелёк {count} жетон. Так это приложение и становится лучше — спасибо.',
      few: 'Мы прочитали твоё сообщение и добавили в кошелёк {count} жетона. Так это приложение и становится лучше — спасибо.',
      many: 'Мы прочитали твоё сообщение и добавили в кошелёк {count} жетонов. Так это приложение и становится лучше — спасибо.',
      other:
        'Мы прочитали твоё сообщение и добавили в кошелёк {count} жетона. Так это приложение и становится лучше — спасибо.',
    },
    bountyButton: 'Открыть кошелёк',
    bountyText: {
      one: 'За твоё сообщение в кошелёк добавлен {count} жетон: {url}',
      few: 'За твоё сообщение в кошелёк добавлено {count} жетона: {url}',
      many: 'За твоё сообщение в кошелёк добавлено {count} жетонов: {url}',
      other: 'За твоё сообщение в кошелёк добавлено {count} жетона: {url}',
    },
  },
}
