import type { Localized } from '@langx/shared'
import type { ServerMessages } from './en'

export const tr: Localized<ServerMessages> = {
  push: {
    streakTitle: { one: '{count} günlük seri! 🔥', other: '{count} günlük seri! 🔥' },
    streakBody: 'Seriyi sürdürmek için bugün bir mesaj gönder.',
    profileVisitsTitle: { one: '1 kişi profiline baktı', other: '{count} kişi profiline baktı' },
    profileVisitsBody: 'Kim olduğunu görmek için dokun.',
    badgeOneTitle: 'Yeni rozet: {label} 🏅',
    badgeManyTitle: { one: '1 yeni rozet kazandın 🏅', other: '{count} yeni rozet kazandın 🏅' },
    badgeBody: 'Güzel iş. Böyle devam.',
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

    existingSubject: 'Zaten bir LangX hesabın var',
    existingPreheader: 'Zaten bir LangX hesabın var',
    existingBody:
      'Biri bu e-posta ile kayıt olmayı denedi ama bu adrese ait bir hesap zaten var. Giriş yapmak için parolanı sıfırla ya da bu adresle Google veya Apple üzerinden giriş yap.',
    existingButton: 'Parolayı sıfırla',
    existingText: 'Zaten bir LangX hesabın var. Parolanı buradan sıfırla: {url}',

    whyThisMail: 'Bunu LangX bildirim ayarların yüzünden alıyorsun.',
    unsubscribeLink: 'Bu e-postaları kapat',
    unsubscribeText: 'Bu e-postaları kapat: {url}',
    managePrefs: 'Tüm bildirim ayarları',
    /** The one button a streak email has. */
    openChats: 'Mesaj gönder',

    digestSubject: { one: 'LangX’te 1 okunmamış mesaj', other: 'LangX’te {count} okunmamış mesaj' },
    digestPreheader: 'Senden haber bekleyenler var',
    digestBody: {
      one: 'Sen yokken {names} sana yazdı.',
      other: '{names} tarafından yazılmış {count} okunmamış mesajın var.',
    },
    digestMore: { one: 'Bir sohbet daha var.', other: '{count} sohbet daha var.' },
    digestButton: 'Oku ve yanıtla',

    visitsSubject: {
      one: 'Bu hafta 1 kişi profiline baktı',
      other: 'Bu hafta {count} kişi profiline baktı',
    },
    visitsPreheader: 'Profilin ilgi çekiyor',
    visitsBody: {
      one: 'Son bir haftada 1 kişi profiline baktı.',
      other: 'Son bir haftada {count} kişi profiline baktı.',
    },
    visitsNames: 'Aralarında: {names}.',
    visitsLocked: 'Kim olduklarını görmek için yükselt.',
    visitsButton: 'Kimlerin baktığını gör',

    badgeOneSubject: 'Yeni rozet: {label}',
    badgeManySubject: { one: '1 yeni rozet kazandın', other: '{count} yeni rozet kazandın' },
    badgeBody: 'Artık profilinde, bakan herkes görüyor.',
    badgeButton: 'Rozetlerine bak',

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
      v1contact: 'yeni LangX hakkındaki tek mesaj',
    },
  },
}
