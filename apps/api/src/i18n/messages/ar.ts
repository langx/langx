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

    whyThisMail: 'تصلك هذه الرسالة بسبب إعدادات الإشعارات في LangX.',
    unsubscribeLink: 'أوقف هذه الرسائل',
    unsubscribeText: 'أوقف هذه الرسائل: {url}',
    managePrefs: 'كل إعدادات الإشعارات',
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

    kind: {
      messages: 'ملخّصات الرسائل',
      streak: 'تذكيرات السلسلة',
      profileVisits: 'ملخّصات زيارات الملف',
      promotions: 'الأخبار والعروض',
      all: 'رسائل LangX',
      v1contact: 'الرسالة الوحيدة عن LangX الجديد',
    },
  },
}
