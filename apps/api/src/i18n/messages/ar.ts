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
  },

  email: {
    ignore: 'إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد.',
    orPaste: 'أو الصق هذا الرابط: {url}',

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

    whyThisMail: 'تصلك هذه الرسالة بسبب إعدادات الإشعارات في LangX.',
    unsubscribeLink: 'أوقف هذه الرسائل',
    unsubscribeText: 'أوقف هذه الرسائل: {url}',
    managePrefs: 'كل إعدادات الإشعارات',
    /** The one button a streak email has. */
    openChats: 'أرسل رسالة',

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
    },
  },
}
