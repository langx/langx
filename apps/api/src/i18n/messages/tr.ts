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
    meetingTitle: 'Dil değişiminize bir saat kaldı',
    meetingBody: 'Sohbeti açmak için dokun.',
    bountyTitle: {
      one: 'Bildirimin için {count} jeton 🎉',
      other: 'Bildirimin için {count} jeton 🎉',
    },
    bountyBody: 'Yazdıklarını okuduk, değdi.',
    /** The same nudges on the phone, under the same switches. */
    promo: {
      addPhotoTitle: 'Bir fotoğraf ekle',
      addPhotoBody: 'Yüzü olan profiller çok daha fazla cevap alıyor.',
      streakBrokeTitle: {
        one: '{count} günlük serin bozuldu',
        other: '{count} günlük serin bozuldu',
      },
      streakBrokeBody: 'Onarım dünü geri koyar.',
      awayTitle: 'İnsanlar hâlâ burada',
      awayBody: 'Pratik yapacak yeni insanlar var.',
      awayLongTitle: 'Sen gelene kadar buradayız',
      awayLongBody: 'Serin ve token’ların bekliyor.',
      limitReachedTitle: 'Ücretsiz sınırlara takılıp duruyorsun',
      limitReachedBody: 'Bir plan bunları kaldırır.',
      trialEndingTitle: 'Ücretsiz haftan iki gün sonra bitiyor',
      trialEndingBody: 'Sürdürmek tek dokunuş.',
      winBackTitle: 'Planın bir hafta önce bitti',
      winBackBody: 'Oluşturduğun her şey hâlâ burada.',
      tokensWaitingTitle: { one: '{count} token bekliyor', other: '{count} token bekliyor' },
      tokensWaitingBody: 'Cüzdanını aç.',
      inviteFriendTitle: 'Bir arkadaşını davet et',
      inviteFriendBody: 'O katılınca ikiniz de token kazanırsınız.',
    },

    /** The feed reacting to something somebody left in it. */

    social: {
      followTitle: '{name} seni takip etmeye başladı',

      followBody: 'Profiline bakmak için dokun.',

      correctionTitle: '{name} cümleni düzeltti',

      correctionBody: 'Düzeltmeyi okumak için dokun.',

      answerTitle: '{name} cümleni seslendirdi',

      answerBody: 'Dinlemek için dokun.',

      commentTitle: '{name} gönderine yorum yaptı',

      commentBody: 'Okumak için dokun.',

      likesTitle: { one: 'Gönderin 1 beğeni aldı', other: 'Gönderin {count} beğeni aldı' },

      likesBody: 'Yazdığın şeyi beğendiler.',
    },

    /** Tokens arriving. */

    wallet: {
      poolTitle: {
        one: 'Dünkü havuz sana 1 token ödedi',
        other: 'Dünkü havuz sana {count} token ödedi',
      },

      poolBody: 'Cüzdanını açmak için dokun.',

      giftTitle: 'Saatlik hediyen hazır',

      giftBody: 'Cüzdanı aç ve al.',
    },

    /** Security, which no preference can switch off. */
    /** Billing, which no preference gates either. */
    billingFailedTitle: 'Ödemen alınamadı',
    billingEndedTitle: 'Planın sona erdi',
    billingBody: 'Planını kontrol etmek için dokun.',
    securityBody: 'Bu sen değilsen LangX’i aç.',
    securityBodyDevice: '{device} üzerinden. Bu sen değilsen LangX’i aç.',
    security: {
      newSignInTitle: 'Hesabına yeni giriş',
      passwordChangedTitle: 'Şifren değiştirildi',
      methodLinkedTitle: 'Yeni giriş yöntemi eklendi',
      methodUnlinkedTitle: 'Bir giriş yöntemi kaldırıldı',
    },
  },

  email: {
    ignore: 'Bunu sen istemediysen bu e-postayı yok sayabilirsin.',
    orPaste: 'Ya da bu bağlantıyı yapıştır: {url}',

    deleteSubject: 'LangX hesabını silmek istediğini onayla',
    deletePreheader: 'LangX hesabını silmek için son bir adım',
    deleteBody:
      'LangX hesabını silmeyi istedin. Aşağıdan onayla, hesabın silinmek üzere sıraya alınsın — fikrini değiştirmek için 30 günün var, tekrar giriş yapman yeterli.',
    deleteButton: 'Hesabımı sil',
    deleteText: 'LangX hesabının silinmesini onayla: {url}',
    deleteInvalid: 'Bu bağlantının süresi dolmuş ya da zaten kullanılmış.',
    deleteConfirmTitle: 'LangX hesabını sil',
    deleteConfirmBody:
      'Bu, hesabını silinmek üzere sıraya alır. 30 gün içinde tekrar giriş yaparsan iptal olur.',
    deleteConfirmButton: 'Evet, hesabımı sil',
    deleteDoneTitle: 'Hesabın silinmek üzere sıraya alındı',
    deleteDoneBody: '{days} gün içinde tekrar giriş yap, her şey geri gelsin.',
    deleteDonePurge: 'Veriler {date} tarihinde siliniyor.',

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
    magicLinkSubject: 'LangX giriş bağlantın',
    magicLinkPreheader: 'LangX’e girmek için dokun',
    magicLinkBody:
      'Giriş yapmak için düğmeye dokun. Bağlantı bir kez çalışır ve 15 dakika içinde geçersiz olur.',
    magicLinkButton: 'LangX’e gir',
    magicLinkText: 'LangX’e gir (bir kez çalışır, 15 dakikada geçersiz olur): {url}',

    existingSubject: 'Zaten bir LangX hesabın var',
    existingPreheader: 'Zaten bir LangX hesabın var',
    existingBody:
      'Biri bu e-posta ile kayıt olmayı denedi ama bu adrese ait bir hesap zaten var. Giriş yapmak için parolanı sıfırla ya da bu adresle Google veya Apple üzerinden giriş yap.',
    existingButton: 'Parolayı sıfırla',
    existingText: 'Zaten bir LangX hesabın var. Parolanı buradan sıfırla: {url}',

    existingLinkBody:
      'Biri bu e-posta ile kayıt olmayı denedi ama burada zaten bir hesabın var ve profilin onun üzerinde duruyor. Girmek için dokun — hatırlaman gereken bir parola yok. Bağlantı bir kez çalışır ve 15 dakika içinde geçersiz olur.',
    existingLinkText:
      'Zaten bir LangX hesabın var. Buradan gir (bir kez çalışır, 15 dakikada geçersiz olur): {url}',

    whyThisMail: 'Bunu LangX bildirim ayarların yüzünden alıyorsun.',
    unsubscribeLink: 'Bu e-postaları kapat',
    unsubscribeText: 'Bu e-postaları kapat: {url}',
    managePrefs: 'Tüm bildirim ayarları',
    /** The dark panel under every mail: the QR to get.langx.io. */
    getApp: 'Uygulamayı indir',
    getAppScan: 'Telefonunla tara ya da şu adresi aç:',
    getAppPlatforms: 'iPhone · Android · Tarayıcı',
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

    /** The monthly recap. Two halves: the reader's numbers and everybody's. */

    newsletterSubject: 'LangX’te {month} ayın',

    newsletterPreheader: 'Ay, rakamlarla: senin ve herkesin',

    newsletterYours: 'Senin ayın',

    newsletterEverybody: 'Herkesin ayı',

    newsletterQuiet:
      'Bu ay sessizdin — mesaj yok, düzeltme yok. Aşağıdakiler sessiz değildi ve hâlâ buradalar.',

    newsletterMessages: 'Gönderilen mesaj',

    newsletterCorrections: 'Yapılan düzeltme',

    newsletterTokens: 'Kazanılan token',

    newsletterStreak: 'Bugünkü seri',

    newsletterNewMembers: 'Yeni üye',

    newsletterMessagesSent: 'Gönderilen mesaj',

    newsletterCorrectionsMade: 'Yapılan düzeltme',

    newsletterButton: 'LangX’i aç',

    /** The day's replies to somebody's posts, in one letter. */

    feedDigestSubject: {
      one: 'Bugün yazdığına 1 yanıt geldi',
      other: 'Bugün yazdığına {count} yanıt geldi',
    },

    feedDigestPreheader: 'Paylaştığın cümlelere cevap verdiler',

    feedDigestBody: {
      one: 'Bugün paylaştığın bir cümleye cevap verildi.',
      other: 'Bugün paylaştığın cümlelere {count} kişi cevap verdi.',
    },

    feedDigestCorrections: { one: '1 düzeltme', other: '{count} düzeltme' },

    feedDigestAnswers: { one: '1 seslendirme', other: '{count} seslendirme' },

    feedDigestComments: { one: '1 yorum', other: '{count} yorum' },

    feedDigestMore: { one: 'Ve 1 gönderi daha.', other: 'Ve {count} gönderi daha.' },

    feedDigestButton: 'Yanıtları oku',

    /**

     * The nudges in `modules/notifications/promotions.ts`, in its order.

     * Every one of them is behind a switch and carries a way out.

     */

    promo: {
      addPhotoSubject: 'Bir fotoğraf ekle, seni bulsunlar',

      addPhotoBody:
        'Yüzü olan profiller çok daha fazla cevap alıyor. On saniye sürer, istediğin zaman değiştirebilirsin.',

      addPhotoButton: 'Fotoğrafımı ekle',

      streakBrokeSubject: {
        one: '{count} günlük serin bozuldu',
        other: '{count} günlük serin bozuldu',
      },

      streakBrokeBody: 'Dünü kaçırdın. Mağazadan bir onarım günü geri koyar ve seri devam eder.',

      streakBrokeButton: 'Dünü onar',

      awaySubject: 'İnsanlar sensiz de pratik yapıyor',

      awayBody: 'Bir hafta oldu. Konuşacak yeni insanlar var ve dillerin değişmedi.',

      awayButton: 'Kimler var, bak',

      awayLongSubject: 'Bundan sonra yazmayacağız',

      awayLongBody:
        'Bir ay uzun bir süre. Hesabın, serin ve token’ların hâlâ burada — istersen diye. Bu konuda son yazışımız.',

      awayLongButton: 'LangX’i aç',

      limitReachedSubject: 'Ücretsiz sınırlara takılıyorsun',

      limitReachedBody:
        'Son birkaç günde üç kez günlük sınıra takıldın. Bir plan bunları kaldırır — her gün daha fazla sohbet, daha fazla çeviri, daha fazla ek.',

      limitReachedButton: 'Planlara bak',

      trialEndingSubject: 'Ücretsiz haftan iki gün sonra bitiyor',

      trialEndingBody:
        'Sonrasında hesabın ücretsiz plana döner. Oluşturduğun her şey kalır; sınırlar geri gelir. Devam ettirmek tek dokunuş.',

      trialEndingButton: 'Planımı sürdür',

      winBackSubject: 'Planın bir hafta önce sona erdi',

      winBackBody:
        'Hiçbir şey alınmadı — serin, token’ların ve yazdığın her şey bıraktığın yerde. Duran şey ücretli sınırlar.',

      winBackButton: 'Planlara bak',

      tokensWaitingSubject: {
        one: '{count} token’ın bekliyor',
        other: '{count} token’ın bekliyor',
      },

      tokensWaitingBody:
        'Token’lar seri dondurma, gün onarımı, çerçeve ve unvan alır. Seninkiler iki haftadır duruyor.',

      tokensWaitingButton: 'Cüzdanımı aç',

      inviteFriendSubject: 'Tanıdığınla pratik daha iyi',

      inviteFriendBody:
        'Bir arkadaşını davet et, o katılınca ikiniz de token kazanın. Davet bağlantın Ayarlar’da.',

      inviteFriendButton: 'Davet bağlantımı al',
    },

    /** Onboarding finished: one mail, once in an account's life. */

    welcomeSubject: 'LangX’e hoş geldin',

    welcomePreheader: 'İlk sohbetin bir dokunuş uzağında',

    welcomeTitle: 'Hoş geldin, {name}',

    welcomeBody: 'Profilin {handle} adresinde yayında. İnsanlar genelde önce şunları yapıyor:',

    welcomeStep1: 'Öğrendiğin dili konuşan birini bul ve selam ver.',

    welcomeStep2: 'Akış’a bir cümle yaz, insanlar düzeltsin.',

    welcomeStep3: 'Yarın da gel — üst üste iki gün seriyi başlatır.',

    welcomeButton: 'Pratik yapacak birini bul',

    /** A day later, for an address nobody confirmed. */

    verifyReminderSubject: 'E-posta adresini doğrula',

    verifyReminderPreheader: 'Tek dokunuş, hesabın hazır',

    verifyReminderBody:
      'LangX hesabın tek bir şeyi bekliyor: bu adresin sana ait olduğunun kanıtı. Aşağıdaki bağlantı bunu yapar.',

    verifyReminderText: 'E-posta adresini doğrula: {url}',

    /** Money, so no switch — see `billingEmail`. */

    billingPlan: 'Plan: {tier}',

    billing: {
      paymentFailedTitle: 'LangX ödemen alınamadı',

      paymentFailedBody:
        'Mağaza aboneliğinin ödemesini alamadı. Tekrar deneyecek; bu sırada planın etkin kalır.',

      paymentFailedButton: 'Planımı kontrol et',

      planEndedTitle: 'LangX planın sona erdi',

      planEndedBody:
        'Aboneliğin sona erdi ve hesabın ücretsiz plana döndü. Oluşturduğun her şey duruyor.',

      planEndedButton: 'Planlara bak',
    },

    /**

     * The security notices. No switch behind them and no unsubscribe —

     * see `modules/security/notify.ts`.

     */

    securityDevice: 'Cihaz',

    securityPlace: 'Konum',

    securityWhen: 'Zaman',

    securityNotYou:
      'Bu sen değilsen şifreni hemen değiştir — bu, diğer tüm cihazlardaki oturumları kapatır.',

    securityButton: 'Şifremi değiştir',

    security: {
      newSignInTitle: 'LangX hesabına yeni giriş',

      newSignInBody: 'Hesabına daha önce görmediğimiz bir cihazdan giriş yapıldı.',

      passwordChangedTitle: 'LangX şifren değiştirildi',

      passwordChangedBody: 'Hesabının şifresi az önce değiştirildi.',

      methodLinkedTitle: 'LangX hesabına yeni bir giriş yöntemi eklendi',

      methodLinkedBody: 'Hesabına Google veya Apple ile giriş bağlandı.',

      methodUnlinkedTitle: 'LangX hesabından bir giriş yöntemi kaldırıldı',

      methodUnlinkedBody: 'Hesabına giriş yollarından biri kaldırıldı.',
    },

    kind: {
      messages: 'mesaj özetleri',
      streak: 'streak hatırlatmaları',
      profileVisits: 'profil ziyareti özetleri',
      social: 'akış bildirimleri',
      wallet: 'token haberleri',
      promotions: 'haberler ve kampanyalar',
      all: 'LangX’ten gelen e-postalar',
      v1contact: 'yeni LangX hakkındaki tek mesaj',
    },
    bountySubject: {
      one: 'Bildirimin için {count} jeton kazandın',
      other: 'Bildirimin için {count} jeton kazandın',
    },
    bountyPreheader: 'Haber verdiğin için teşekkürler.',
    bountyBody: {
      one: 'Gönderdiğini okuduk ve cüzdanına {count} jeton ekledik. Bu uygulama böyle düzeliyor — teşekkürler.',
      other:
        'Gönderdiğini okuduk ve cüzdanına {count} jeton ekledik. Bu uygulama böyle düzeliyor — teşekkürler.',
    },
    bountyButton: 'Cüzdanımı aç',
    bountyText: {
      one: 'Gönderdiğin bildirim için cüzdanına {count} jeton eklendi: {url}',
      other: 'Gönderdiğin bildirim için cüzdanına {count} jeton eklendi: {url}',
    },

    suspendedSubject: 'LangX hesabın askıya alındı',
    suspendedPreheader: 'Hesabınla ilgili bir bildirim incelendi',
    suspendedUntilBody:
      'Hesabınla ilgili bir bildirim bir kişi tarafından incelendi ve hesabın {until} tarihine kadar askıya alındı. O zamana kadar LangX’i kullanamazsın; profilin keşfette ve aramada görünmez.',
    suspendedPermanentBody:
      'Hesabınla ilgili bir bildirim bir kişi tarafından incelendi ve hesabın kalıcı olarak askıya alındı. Profilin keşfette ve aramada görünmez.',
    suspendedReason: 'Gerekçe: {reason}',
    suspendedAppeal:
      'Bunun yanlış olduğunu düşünüyorsan uygulamadan bir kez itiraz edebilir ya da bu e-postayı yanıtlayabilirsin.',
    suspendedText:
      'LangX hesabın askıya alındı. {detail} {reason} Uygulamadan bir kez itiraz edebilirsin.',
    suspensionUpdatedSubject: 'LangX askıya alma durumun güncellendi',
    suspensionUpdatedPreheader: 'İtirazına baktık',
    suspensionUpdatedShortened:
      'İtirazını okuduk. Askıya alma artık {until} tarihinde sona eriyor.',
    suspensionUpdatedLifted:
      'İtirazını okuduk. Askıya alma kaldırıldı — LangX’i yeniden kullanabilirsin.',
    suspensionUpdatedText: 'LangX askıya alma durumun güncellendi. {detail}',
  },

  reportReason: {
    spam: 'Spam',
    harassment: 'Taciz',
    hateSpeech: 'Nefret söylemi',
    inappropriateContent: 'Uygunsuz içerik',
    fakeProfile: 'Sahte profil',
    underage: '16 yaşından küçük',
    other: 'Başka bir şey',
  },
}
