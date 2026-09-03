import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const tr: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '{count} günlük seri! 🔥', other: '{count} günlük seri! 🔥' },
    streakBody: 'Seriyi sürdürmek için bugün bir mesaj gönder.',
  },

  email: {
    ignore: 'Bunu sen istemediysen bu e-postayı yok sayabilirsin.',
    orPaste: 'Ya da bu bağlantıyı yapıştır: {url}',

    verifySubject: 'LangX e-posta adresini doğrula',
    verifyPreheader: 'LangX kurulumunu bitirmek için e-postanı doğrula',
    verifyBody: 'Hesabının kurulumunu bitirmek için bu adresin sana ait olduğunu onayla.',
    verifyButton: 'E-postayı doğrula',
    verifyText: 'LangX e-posta adresini doğrula: {url}',

    resetSubject: 'LangX parolanı sıfırla',
    resetPreheader: 'LangX parolanı sıfırla',
    resetBody: 'Bu hesap için bir parola sıfırlama isteği geldi. Bu sensen:',
    resetButton: 'Parolayı sıfırla',
    resetText: 'LangX parolanı sıfırla: {url}',

    whyThisMail: 'Bunu LangX bildirim ayarların yüzünden alıyorsun.',
    unsubscribeLink: 'Bu e-postaları kapat',
    unsubscribeText: 'Bu e-postaları kapat: {url}',
    managePrefs: 'Tüm bildirim ayarları',

    unsubscribeTitle: 'Bu e-postalar kapatılsın mı?',
    unsubscribeBody: '{kind} artık e-postayla gelmeyecek. Telefonundaki bildirimler etkilenmez.',
    unsubscribeConfirm: 'Kapat',
    unsubscribeAll: 'Ya da LangX’ten gelen tüm e-postaları kapat',
    unsubscribedTitle: 'Tamam — artık gelmeyecek.',
    unsubscribedBody: 'İstediğin zaman LangX’te Ayarlar → Bildirimler’den geri açabilirsin.',
    unsubscribeInvalid:
      'Bu bağlantı geçerli değil. LangX’i açıp Ayarlar → Bildirimler’den değiştir.',

    kind: {
      messages: 'mesaj özetleri',
      streak: 'streak hatırlatmaları',
      profileVisits: 'profil ziyareti özetleri',
      promotions: 'haberler ve kampanyalar',
      all: 'LangX’ten gelen e-postalar',
    },
  },
}
