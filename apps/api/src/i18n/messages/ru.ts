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
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Добавьте фото',
      addPhotoBody: 'Профили с лицом получают больше ответов.',
      streakBrokeTitle: {
        one: 'Серия из {count} дня прервалась',
        other: 'Серия из {count} дней прервалась',
      },
      streakBrokeBody: 'Починка вернёт вчерашний день.',
      awayTitle: 'Люди всё ещё здесь',
      awayBody: 'Новые собеседники.',
      awayLongTitle: 'Мы здесь, когда захотите',
      awayLongBody: 'Серия и токены ждут.',
      limitReachedTitle: 'Вы часто упираетесь в лимиты',
      limitReachedBody: 'Тариф снимает их.',
      trialEndingTitle: 'Бесплатная неделя заканчивается через два дня',
      trialEndingBody: 'Продлить — одно касание.',
      winBackTitle: 'Ваш тариф закончился',
      winBackBody: 'Всё созданное на месте.',
      tokensWaitingTitle: { one: 'Ждёт {count} токен', other: 'Ждут {count} токенов' },
      tokensWaitingBody: 'Откройте кошелёк.',
      inviteFriendTitle: 'Пригласите знакомого',
      inviteFriendBody: 'Токены получите оба.',
    },

    /** The feed reacting to something somebody left in it. */

    social: {
      followTitle: '{name} подписался на вас',

      followBody: 'Нажмите, чтобы открыть профиль.',

      correctionTitle: '{name} исправил вашу фразу',

      correctionBody: 'Нажмите, чтобы прочитать исправление.',

      answerTitle: '{name} озвучил вашу фразу',

      answerBody: 'Нажмите, чтобы послушать.',

      commentTitle: '{name} прокомментировал ваш пост',

      commentBody: 'Нажмите, чтобы прочитать.',

      likesTitle: { one: 'Ваш пост получил 1 лайк', other: 'Ваш пост получил {count} лайков' },

      likesBody: 'Кому-то понравилось написанное вами.',
    },

    /** Tokens arriving. */

    wallet: {
      poolTitle: {
        one: 'Вчерашний пул принёс вам 1 токен',
        other: 'Вчерашний пул принёс вам {count} токенов',
      },

      poolBody: 'Нажмите, чтобы открыть кошелёк.',

      giftTitle: 'Почасовой подарок готов',

      giftBody: 'Откройте кошелёк и заберите.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Платёж не прошёл',
    billingEndedTitle: 'Ваш тариф закончился',
    billingBody: 'Нажмите, чтобы проверить тариф.',
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

    /** The monthly recap. Two halves: the reader's numbers and everybody's. */

    newsletterSubject: 'Ваш {month} в LangX',

    newsletterPreheader: 'Месяц в цифрах — ваших и общих',

    newsletterYours: 'Ваш месяц',

    newsletterEverybody: 'Месяц всех',

    newsletterQuiet:
      'В этом месяце вы молчали — ни сообщений, ни исправлений. Те, кто ниже, — нет, и они всё ещё здесь.',

    newsletterMessages: 'Отправлено сообщений',

    newsletterCorrections: 'Сделано исправлений',

    newsletterTokens: 'Заработано токенов',

    newsletterStreak: 'Серия сегодня',

    newsletterNewMembers: 'Новых участников',

    newsletterMessagesSent: 'Отправлено сообщений',

    newsletterCorrectionsMade: 'Сделано исправлений',

    newsletterButton: 'Открыть LangX',

    /** The day's replies to somebody's posts, in one letter. */

    feedDigestSubject: {
      one: '1 ответ на ваш пост сегодня',
      other: '{count} ответов на ваши посты сегодня',
    },

    feedDigestPreheader: 'На ваши посты ответили',

    feedDigestBody: {
      one: 'Сегодня кто-то ответил на вашу фразу.',
      other: 'Сегодня на ваши фразы ответили {count} человек.',
    },

    feedDigestCorrections: { one: '1 исправление', other: '{count} исправлений' },

    feedDigestAnswers: { one: '1 запись', other: '{count} записей' },

    feedDigestComments: { one: '1 комментарий', other: '{count} комментариев' },

    feedDigestMore: { one: 'И ещё 1 пост.', other: 'И ещё {count} постов.' },

    feedDigestButton: 'Читать ответы',

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Добавьте фото — и вас найдут',

      addPhotoBody:
        'Профили с лицом получают заметно больше ответов. Это десять секунд, и фото можно поменять когда угодно.',

      addPhotoButton: 'Добавить фото',

      streakBrokeSubject: {
        one: 'Серия из {count} дня прервалась',
        other: 'Серия из {count} дней прервалась',
      },

      streakBrokeBody: 'Вчера пропущено. Починка из магазина вернёт день, и серия продолжится.',

      streakBrokeButton: 'Починить вчера',

      awaySubject: 'Здесь продолжают заниматься и без вас',

      awayBody: 'Прошла неделя. Появились новые собеседники, а ваши языки те же.',

      awayButton: 'Посмотреть, кто здесь',

      awayLongSubject: 'После этого письма мы замолчим',

      awayLongBody:
        'Месяц — долгий срок. Ваш аккаунт, серия и токены на месте, если они вам нужны, и это последнее, что мы об этом скажем.',

      awayLongButton: 'Открыть LangX',

      limitReachedSubject: 'Вы упираетесь в бесплатные лимиты',

      limitReachedBody:
        'За последние дни вы трижды упёрлись в дневной лимит. Тариф снимает их — больше разговоров, больше переводов, больше вложений каждый день.',

      limitReachedButton: 'Посмотреть тарифы',

      trialEndingSubject: 'Бесплатная неделя заканчивается через два дня',

      trialEndingBody:
        'После этого аккаунт вернётся на бесплатный тариф. Всё созданное останется, но лимиты вернутся. Продлить — одно касание.',

      trialEndingButton: 'Сохранить тариф',

      winBackSubject: 'Ваш тариф закончился неделю назад',

      winBackBody:
        'Ничего не забрали — серия, токены и всё написанное на месте. Закончились только платные лимиты.',

      winBackButton: 'Посмотреть тарифы',

      tokensWaitingSubject: { one: 'Вас ждёт {count} токен', other: 'Вас ждут {count} токенов' },

      tokensWaitingBody:
        'За токены покупают заморозки серии, починку дней, рамки и титулы. Ваши лежат уже две недели.',

      tokensWaitingButton: 'Открыть кошелёк',

      inviteFriendSubject: 'Вдвоём заниматься лучше',

      inviteFriendBody:
        'Пригласите знакомого — токены получите оба, когда он придёт. Ссылка в настройках.',

      inviteFriendButton: 'Взять ссылку',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'Добро пожаловать в LangX',

    welcomePreheader: 'До первого разговора — одно касание',

    welcomeTitle: 'Добро пожаловать, {name}',

    welcomeBody: 'Ваш профиль доступен по адресу {handle}. Вот с чего обычно начинают:',

    welcomeStep1: 'Найдите того, кто говорит на языке, который вы учите, и поздоровайтесь.',

    welcomeStep2: 'Опубликуйте фразу в Ленте и дайте её исправить.',

    welcomeStep3: 'Возвращайтесь завтра — два дня подряд начинают серию.',

    welcomeButton: 'Найти собеседника',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'Подтвердите адрес электронной почты',

    verifyReminderPreheader: 'Одно касание — и аккаунт готов',

    verifyReminderBody:
      'Вашему аккаунту LangX не хватает одного: подтверждения, что этот адрес ваш. Ссылка ниже это сделает.',

    verifyReminderText: 'Подтвердите адрес электронной почты: {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Тариф: {tier}',

    billing: {
      paymentFailedTitle: 'Платёж LangX не прошёл',

      paymentFailedBody:
        'Магазин не смог списать оплату подписки. Он попробует снова, а ваш тариф пока остаётся активным.',

      paymentFailedButton: 'Проверить тариф',

      planEndedTitle: 'Ваш тариф LangX закончился',

      planEndedBody:
        'Подписка закончилась, и аккаунт вернулся на бесплатный тариф. Всё, что вы создали, на месте.',

      planEndedButton: 'Посмотреть тарифы',
    },

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
      social: 'события ленты',
      wallet: 'новости о токенах',
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

    suspendedSubject: 'Ваш аккаунт LangX заблокирован',
    suspendedPreheader: 'Жалобу на ваш аккаунт рассмотрели',
    suspendedUntilBody:
      'Жалобу на ваш аккаунт рассмотрел человек, и аккаунт заблокирован до {until}. До этого времени вы не можете пользоваться LangX, а ваш профиль скрыт из поиска и подбора.',
    suspendedPermanentBody:
      'Жалобу на ваш аккаунт рассмотрел человек, и аккаунт заблокирован навсегда. Ваш профиль скрыт из поиска и подбора.',
    suspendedReason: 'Причина: {reason}',
    suspendedAppeal:
      'Если это ошибка, вы можете один раз подать апелляцию из приложения или ответить на это письмо.',
    suspendedText:
      'Ваш аккаунт LangX заблокирован. {detail} {reason} Вы можете один раз подать апелляцию из приложения.',
    suspensionUpdatedSubject: 'Блокировка вашего аккаунта LangX изменена',
    suspensionUpdatedPreheader: 'Мы рассмотрели вашу апелляцию',
    suspensionUpdatedShortened:
      'Мы прочитали вашу апелляцию. Блокировка теперь заканчивается {until}.',
    suspensionUpdatedLifted:
      'Мы прочитали вашу апелляцию. Блокировка снята — вы снова можете пользоваться LangX.',
    suspensionUpdatedText: 'Блокировка вашего аккаунта LangX изменена. {detail}',
  },

  reportReason: {
    spam: 'Спам',
    harassment: 'Домогательства',
    hateSpeech: 'Язык вражды',
    inappropriateContent: 'Неприемлемый контент',
    fakeProfile: 'Фальшивый профиль',
    underage: 'Младше 16 лет',
    other: 'Другое',
  },
  official: {
    welcome:
      'Привет, добро пожаловать в LangX! 👋 Рады, что вы с нами.\n\nСамое интересное начинается в разделе «Поиск»: найдите того, кто учит ваш язык и говорит на том, который нужен вам, поздоровайтесь — дальше практика идёт сама. По пути копятся токены.\n\nСюда приходят новости о LangX, так что заглядывайте. И LangX — проект с открытым кодом: он становится лучше потому, что люди нам рассказывают. Если что-то сломалось или вы придумали, что нам стоит сделать, «Настройки → О приложении → Обратная связь» попадёт прямо к нам. Мы читаем всё. И если знаете кого-то, кому здесь понравится, «Настройки → Поделиться и пригласить» принесёт токены вам обоим.',
    welcomeRate:
      'И ещё, если будет настроение: оценка LangX в {store} действительно помогает людям нас найти. Совершенно без обязательств.',
    welcomeClosing: 'Удачной практики — и успехов вам. 💛',
    assistantOffline:
      'Сейчас я не могу отвечать на сообщения. Если это терпит, попробуйте позже; если нет — напишите на {email}, там прочитает человек.',
    assistantLimit:
      'Больше я сейчас ответить не могу — попробуйте через несколько часов.\n\nОт меня ничего не зависит: пожаловаться на кого-то можно из его профиля, отправить ошибку или идею — из настроек, а на {email} в любое время ответит человек.',
    assistantError: 'На моей стороне что-то сломалось. Попробуйте отправить ещё раз через минуту.',
    assistantRefusal:
      'С этим я помочь не могу. Если я вас неправильно понял, на {email} ответит человек.',
  },
}
