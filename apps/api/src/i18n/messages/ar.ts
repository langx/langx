import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const ar: Localized<ServerMessages> = {
  push: {
    /** Arabic uses all six categories; a `one`/`other` pair would be wrong four ways. */
    streakTitle: {
      zero: 'سلسلة من {count} يوم! 🔥',
      one: 'سلسلة من يوم واحد! 🔥',
      two: 'سلسلة من يومين! 🔥',
      few: 'سلسلة من {count} أيام! 🔥',
      many: 'سلسلة من {count} يومًا! 🔥',
      other: 'سلسلة من {count} يوم! 🔥',
    },
    streakBody: 'أرسل رسالة اليوم للحفاظ عليها.',
    profileVisitsTitle: { one: 'شخص واحد اطّلع على ملفك', other: '{count} أشخاص اطّلعوا على ملفك' },
    profileVisitsBody: 'اضغط لترى مَن.',
    badgeOneTitle: 'شارة جديدة: {label} 🏅',
    badgeManyTitle: { one: 'حصلت على شارة جديدة 🏅', other: 'حصلت على {count} شارات جديدة 🏅' },
    badgeBody: 'عمل رائع. واصل.',
    meetingTitle: 'تبادلك اللغوي بعد ساعة',
    meetingBody: 'اضغط لفتح المحادثة.',
    bountyTitle: {
      zero: '{count} رمز مقابل بلاغك 🎉',
      one: 'رمز واحد مقابل بلاغك 🎉',
      two: 'رمزان مقابل بلاغك 🎉',
      few: '{count} رموز مقابل بلاغك 🎉',
      many: '{count} رمزًا مقابل بلاغك 🎉',
      other: '{count} رمز مقابل بلاغك 🎉',
    },
    bountyBody: 'قرأنا ما أرسلته، وقد كان يستحق.',
    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'لم تتم عملية الدفع',
    billingEndedTitle: 'انتهت خطتك',
    billingBody: 'انقر للاطلاع على خطتك.',
    securityBody: 'افتح LangX إن لم تكن أنت.',
    securityBodyDevice: 'من {device}. افتح LangX إن لم تكن أنت.',
    security: {
      newSignInTitle: 'تسجيل دخول جديد إلى حسابك',
      passwordChangedTitle: 'تم تغيير كلمة المرور',
      methodLinkedTitle: 'تمت إضافة طريقة تسجيل دخول',
      methodUnlinkedTitle: 'تمت إزالة طريقة تسجيل دخول',
    },
  },

  email: {
    ignore: 'إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد.',
    orPaste: 'أو الصق هذا الرابط: {url}',

    deleteSubject: 'أكّد رغبتك في حذف حساب LangX',
    deletePreheader: 'خطوة أخيرة لحذف حساب LangX',
    deleteBody:
      'طلبت حذف حساب LangX. أكّد أدناه وسيُجدول الحساب للحذف — أمامك 30 يومًا لتغيير رأيك بتسجيل الدخول من جديد.',
    deleteButton: 'حذف حسابي',
    deleteText: 'أكّد حذف حساب LangX: {url}',
    deleteInvalid: 'انتهت صلاحية هذا الرابط أو استُخدم من قبل.',
    deleteConfirmTitle: 'حذف حساب LangX',
    deleteConfirmBody: 'هذا يجدول حسابك للحذف. تسجيل الدخول خلال 30 يومًا يلغي ذلك.',
    deleteConfirmButton: 'نعم، احذف حسابي',
    deleteDoneTitle: 'حسابك مُجدول للحذف',
    deleteDoneBody: 'سجّل الدخول خلال {days} يومًا ويعود كل شيء.',
    deleteDonePurge: 'تُحذف البيانات في {date}.',

    verifySubject: 'تأكيد بريدك في LangX',
    verifyPreheader: 'أكّد بريدك لإكمال إعداد LangX',
    verifyBody: 'أكّد أن هذا هو عنوان بريدك لإكمال إعداد حسابك.',
    verifyButton: 'تأكيد البريد',
    verifyText: 'تأكيد بريدك في LangX: {url}',

    resetSubject: 'إعادة تعيين كلمة مرور LangX',
    resetPreheader: 'إعادة تعيين كلمة مرور LangX',
    resetBody: 'طلب أحدهم إعادة تعيين كلمة المرور لهذا الحساب. إذا كنت أنت:',
    resetButton: 'إعادة تعيين كلمة المرور',
    resetText: 'إعادة تعيين كلمة مرور LangX: {url}',
    magicLinkSubject: 'رابط الدخول إلى LangX',
    magicLinkPreheader: 'انقر للدخول إلى LangX',
    magicLinkBody:
      'انقر على الزر لتسجيل الدخول. يعمل الرابط مرة واحدة وتنتهي صلاحيته خلال 15 دقيقة.',
    magicLinkButton: 'الدخول إلى LangX',
    magicLinkText: 'الدخول إلى LangX (يعمل مرة واحدة، تنتهي صلاحيته خلال 15 دقيقة): {url}',

    existingSubject: 'لديك حساب LangX بالفعل',
    existingPreheader: 'لديك حساب LangX بالفعل',
    existingBody:
      'حاول أحدهم التسجيل بهذا البريد، لكن يوجد حساب لهذا العنوان بالفعل. للدخول، أعد تعيين كلمة المرور أو سجّل الدخول عبر Google أو Apple بهذا العنوان.',
    existingButton: 'إعادة تعيين كلمة المرور',
    existingText: 'لديك حساب LangX بالفعل. أعد تعيين كلمة المرور من هنا: {url}',

    existingLinkBody:
      'حاول أحدهم التسجيل بهذا البريد، لكن لديك حساب هنا بالفعل وملفك الشخصي عليه. انقر للدخول — لا توجد كلمة مرور لتتذكرها. يعمل الرابط مرة واحدة وتنتهي صلاحيته خلال 15 دقيقة.',
    existingLinkText:
      'لديك حساب LangX بالفعل. سجّل الدخول من هنا (يعمل مرة واحدة، تنتهي صلاحيته خلال 15 دقيقة): {url}',

    whyThisMail: 'تصلك هذه الرسالة بسبب إعدادات الإشعارات في LangX.',
    unsubscribeLink: 'أوقف هذه الرسائل',
    unsubscribeText: 'أوقف هذه الرسائل: {url}',
    managePrefs: 'كل إعدادات الإشعارات',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'حمّل التطبيق',
    getAppScan: 'امسح الرمز بهاتفك أو افتح',
    getAppPlatforms: 'iPhone · Android · المتصفح',
    /** The one button a streak email has. */
    openChats: 'أرسل رسالة',

    digestSubject: {
      one: 'رسالة واحدة غير مقروءة في LangX',
      other: '{count} رسائل غير مقروءة في LangX',
    },
    digestPreheader: 'هناك من ينتظر ردّك',
    digestBody: {
      one: 'راسلك {names} أثناء غيابك.',
      other: 'لديك {count} رسائل غير مقروءة من {names}.',
    },
    digestMore: { one: 'ومحادثة أخرى.', other: 'و{count} محادثات أخرى.' },
    digestButton: 'اقرأ وردّ',

    visitsSubject: {
      one: 'اطّلع على ملفك شخص واحد هذا الأسبوع',
      other: 'اطّلع على ملفك {count} أشخاص هذا الأسبوع',
    },
    visitsPreheader: 'ملفك يلفت الانتباه',
    visitsBody: {
      one: 'خلال الأسبوع الماضي اطّلع على ملفك شخص واحد.',
      other: 'خلال الأسبوع الماضي اطّلع على ملفك {count} أشخاص.',
    },
    visitsNames: 'منهم: {names}.',
    visitsLocked: 'ارتقِ بخطتك لترى مَن كانوا.',
    visitsButton: 'شاهد مَن زار ملفك',

    badgeOneSubject: 'شارة جديدة: {label}',
    badgeManySubject: { one: 'حصلت على شارة جديدة', other: 'حصلت على {count} شارات جديدة' },
    badgeBody: 'صارت على ملفك الآن، يراها كل من يزوره.',
    badgeButton: 'اطّلع على شاراتك',

    unsubscribeTitle: 'إيقاف هذه الرسائل؟',
    unsubscribeBody: 'لن تصلك {kind} عبر البريد بعد الآن. إشعارات الهاتف لا تتأثر.',
    unsubscribeConfirm: 'أوقفها',
    unsubscribeAll: 'أو أوقف كل رسائل LangX',
    unsubscribedTitle: 'تم — لن تصلك بعد الآن.',
    unsubscribedBody: 'يمكنك تشغيلها متى شئت من LangX في الإعدادات ← الإشعارات.',
    unsubscribeInvalid: 'هذا الرابط غير صالح. افتح LangX وغيّره من الإعدادات ← الإشعارات.',

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'أهلاً بك في LangX',

    welcomePreheader: 'محادثتك الأولى على بُعد نقرة',

    welcomeTitle: 'أهلاً، {name}',

    welcomeBody: 'ملفك الشخصي متاح على ‎@{handle}‎. هذا ما يبدأ به معظم الناس:',

    welcomeStep1: 'ابحث عن شخص يتحدث اللغة التي تتعلمها وألقِ التحية.',

    welcomeStep2: 'انشر جملة في الموجز ودع الآخرين يصححونها.',

    welcomeStep3: 'عُد غداً — يومان متتاليان يبدآن سلسلة.',

    welcomeButton: 'ابحث عن شخص للتدرب معه',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'أكّد عنوان بريدك الإلكتروني',

    verifyReminderPreheader: 'نقرة واحدة ويصبح حسابك جاهزاً',

    verifyReminderBody:
      'ينقص حسابك في LangX شيء واحد: إثبات أن هذا العنوان لك. الرابط أدناه يقوم بذلك.',

    verifyReminderText: 'أكّد عنوان بريدك الإلكتروني: {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'الخطة: {tier}',

    billing: {
      paymentFailedTitle: 'لم تتم عملية الدفع في LangX',

      paymentFailedBody:
        'لم يتمكن المتجر من تحصيل قيمة اشتراكك. سيحاول مرة أخرى، وتبقى خطتك فعّالة في هذه الأثناء.',

      paymentFailedButton: 'تحقق من خطتي',

      planEndedTitle: 'انتهت خطتك في LangX',

      planEndedBody: 'انتهى اشتراكك وعاد حسابك إلى الخطة المجانية. كل ما أنشأته ما زال موجوداً.',

      planEndedButton: 'اطّلع على الخطط',
    },

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'الجهاز',

    securityPlace: 'المكان',

    securityWhen: 'الوقت',

    securityNotYou:
      'إن لم تكن أنت، غيّر كلمة المرور الآن — سيؤدي ذلك إلى تسجيل الخروج من كل الأجهزة الأخرى.',

    securityButton: 'تغيير كلمة المرور',

    security: {
      newSignInTitle: 'تسجيل دخول جديد إلى حسابك في LangX',

      newSignInBody: 'سجّل أحدهم الدخول إلى حسابك من جهاز لم نره من قبل.',

      passwordChangedTitle: 'تم تغيير كلمة مرور LangX',

      passwordChangedBody: 'تم تغيير كلمة مرور حسابك للتو.',

      methodLinkedTitle: 'تمت إضافة طريقة تسجيل دخول إلى حسابك في LangX',

      methodLinkedBody: 'تم ربط تسجيل الدخول بحساب Google أو Apple بحسابك.',

      methodUnlinkedTitle: 'تمت إزالة طريقة تسجيل دخول من حسابك في LangX',

      methodUnlinkedBody: 'تم فصل إحدى طرق تسجيل الدخول إلى حسابك.',
    },

    kind: {
      messages: 'ملخّصات الرسائل',
      streak: 'تذكيرات السلسلة',
      profileVisits: 'ملخّصات زيارات الملف',
      promotions: 'الأخبار والعروض',
      all: 'رسائل LangX',
      v1contact: 'الرسالة الوحيدة عن LangX الجديد',
    },
    bountySubject: {
      zero: 'حصلت على {count} رمز مقابل بلاغك',
      one: 'حصلت على رمز واحد مقابل بلاغك',
      two: 'حصلت على رمزين مقابل بلاغك',
      few: 'حصلت على {count} رموز مقابل بلاغك',
      many: 'حصلت على {count} رمزًا مقابل بلاغك',
      other: 'حصلت على {count} رمز مقابل بلاغك',
    },
    bountyPreheader: 'شكرًا لإخبارنا.',
    bountyBody: {
      zero: 'قرأنا ما أرسلته وأضفنا {count} رمز إلى محفظتك. هكذا يتحسّن هذا التطبيق — شكرًا لك.',
      one: 'قرأنا ما أرسلته وأضفنا رمزًا واحدًا إلى محفظتك. هكذا يتحسّن هذا التطبيق — شكرًا لك.',
      two: 'قرأنا ما أرسلته وأضفنا رمزين إلى محفظتك. هكذا يتحسّن هذا التطبيق — شكرًا لك.',
      few: 'قرأنا ما أرسلته وأضفنا {count} رموز إلى محفظتك. هكذا يتحسّن هذا التطبيق — شكرًا لك.',
      many: 'قرأنا ما أرسلته وأضفنا {count} رمزًا إلى محفظتك. هكذا يتحسّن هذا التطبيق — شكرًا لك.',
      other: 'قرأنا ما أرسلته وأضفنا {count} رمز إلى محفظتك. هكذا يتحسّن هذا التطبيق — شكرًا لك.',
    },
    bountyButton: 'افتح محفظتي',
    bountyText: {
      zero: 'أُضيف {count} رمز إلى محفظتك مقابل البلاغ الذي أرسلته: {url}',
      one: 'أُضيف رمز واحد إلى محفظتك مقابل البلاغ الذي أرسلته: {url}',
      two: 'أُضيف رمزان إلى محفظتك مقابل البلاغ الذي أرسلته: {url}',
      few: 'أُضيفت {count} رموز إلى محفظتك مقابل البلاغ الذي أرسلته: {url}',
      many: 'أُضيف {count} رمزًا إلى محفظتك مقابل البلاغ الذي أرسلته: {url}',
      other: 'أُضيف {count} رمز إلى محفظتك مقابل البلاغ الذي أرسلته: {url}',
    },
  },
}
