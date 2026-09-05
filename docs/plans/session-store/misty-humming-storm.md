# Sohbet, kayıt, onboarding, profil ve ayarlar

## Bağlam

Behic app2.langx.io üzerinde test ederken sırayla şunları istedi (numaralar aşağıdaki
işlerle eşleşiyor):

1. **A** Mesaja basılı tutunca yanıtlama çıkmıyor; WhatsApp gibi sağa swipe ile de olsun.
2. **B** Düzeltmede eski cümlenin tamamı çizili — yalnız değişen kısım farklı renkte olsun,
   düzeltmede de aynı şekilde belli olsun.
3. **C** v2 doğum tarihini tam tutsun (#500 kutlaması sonra). Mevcut profiller çöp, hepsi test;
   `birthYear` geçen her yer `birthDate` olacak, kullanıcılar tüm tablolarda güncellenecek.
4. **D** Alt tab bar'da ikon altındaki yazılar kalksın.
5. **E** Bildirim ayarları genişlesin: mesaj, streak, profil ziyareti, promosyon × push/e-posta.
6. **F** Uygulama ikonu değiştirilebilsin — yalnız Pro, şimdilik iki seçenek.
7. **G** Legal sekmesi + **Our Kitchen** (v1'in About Us'u), linkler tarayıcı modalinde açılsın.
8. **H** Parola alanında göz ikonu, aç-kapa.
9. **I** Kayıtta diller adım adım: ana dil → Continue → öğrenilen dil → Continue → seviye (1-4).
10. **J** Ülke yerinde konum izni istensin, konum çekilsin (opsiyonel); izin sonradan
    Ayarlar'dan verilebilsin, popup çıkmıyorsa modal ile telefon ayarlarına yönlendirilsin.
11. **L** Kayıtta parola iki kez girilsin ve eşleşsin; çok zor olmayan bir politika (min 6,
    max 20 gibi).
12. **N** Her üyenin ülkesi olmalı; kayıt anında **bağlantı IP'sinden** bulunup yazılsın ve
    elle değiştirilemesin.
13. **O** Discover'daki kullanıcı kartlarına ülke bayrağı (emoji olur).
14. **P** Aynı bayrak profil sayfasında da olsun (zaten var — doğrulanacak).
15. **Q** Bir kullanıcının profilini açtığımda onunla zaten aktif bir sohbet varsa, profildeki
    "mesaj yaz" kutusu gösterilmesin.
16. **S** Profildeki activity haritasının yerleşimi kaymış ve güncel streak'leri
    göstermiyor; streak olan günlerin kutusu boyalı olmalı.
17. **R** Her profilde day streak, correction ve token sayısı; ayrıca "This week" grafiği ve
    salt-okunur activity chart (kendi profilimdeki formatta). Ayarlar → Privacy'den açılıp
    kapanabilsin, varsayılan açık.

Behic'in bugünkü kararları: yaş kapısı **yıl bazlı kalıyor**; doğum tarihi girişi **native
tarih seçici**; IP → ülke için **api2 Cloudflare'in arkasına alınacak** — ve bunu Behic zaten
yaptı: `api2.langx.io` artık `server: cloudflare` + `cf-ray` ile cevap veriyor, `/health` hâlâ
200 ve `db: up`. Ülke UI'da kilitli, ama **konum izni IP'yi ezebilecek**.

Araştırmanın planı şekillendiren iki sonucu:

- **Yanıtlama zaten yazılmış ve `origin/main`'de** (`1b217419`, 08-29 04:37). app2'de
  görünmemesinin sebebi oradaki build'in daha eski olması: yayındaki bundle'da "Reply" /
  "Replying to" hiç geçmiyor, ama "Correction from" var. Fly'daki API de eski (`/likes` ve
  `/profiles/:id/followers` 404, `/feed` 401 → 08-29 02:39 ile 06:32 arası bir sürüm), yani
  reply sunucuda da yok. Kodda düzeltilecek bir şey yok; **deploy meselesi**.
- **Deploy'u langx-c7 oturumu yapıyor** (api2 + app2). Ben deploy'a girmiyorum; buradaki işler
  yeşil `main`'e indikten sonraki yayına biner. Paylaşılan checkout'un `main`'ine ve o
  oturumun commit'lenmemiş dosyalarına dokunmuyorum.

Yedi dal (+ `website` için bir dal), hepsi `origin/main`'den.

---

## PR 1 — Sohbet: swipe ile yanıtlama + düzeltme farkı (A, B)

### A. Dokunmatik web'de sağa swipe

`src/lib/swipeToReply.ts` (saf modül, react-native import etmiyor):

- `swipeToReplyEnabled(platform, hasTouch)` — native'de her zaman açık, web'de yalnız
  dokunmatik girişte. Eşikler (`SWIPE_ACTIVATE_PX` vb.) aynen kalıyor.
- Testine üç vaka: ios/android açık, dokunmatik web açık, fareli web kapalı.

`src/components/MessageBubble.tsx`:

- Dosya düzeyinde `HAS_TOUCH = Platform.OS !== 'web' || (typeof navigator !== 'undefined' &&
  navigator.maxTouchPoints > 0)` — export sırasında `navigator` yok, `typeof` koruması şart.
- `Platform.OS === 'web' ? {} : responder.panHandlers` yerine `swipeToReplyEnabled(...)`;
  üstündeki yorum bloğu yeni gerekçeyle yazılır.
- Web'de sarmalayıcı `Animated.View`'a `touchAction: 'pan-y'`; olmazsa yatay hareketi tarayıcı
  kendi jesti için yutar.
- Mevcut `translateX`'ten `interpolate` ile beliren bir yanıt oku (`Feather corner-up-left`),
  0 → `SWIPE_ACTIVATE_PX` arasında opaklık 0 → 1.

Masaüstünde fareyle metin seçimi bozulmuyor; oradaki yol menüdeki "Yanıtla".

### B. Düzeltmede sadece değişen kısım

Yeni saf modül `src/lib/correctionDiff.ts`:

```ts
export interface DiffSegment { text: string; changed: boolean }
export function diffCorrection(
  original: string, corrected: string,
): { original: DiffSegment[]; corrected: DiffSegment[] }
```

- Kelime bazlı LCS; her token peşindeki boşluğu taşır, böylece segmentler birleşince girdi
  birebir geri çıkar (testte değişmez olarak doğrulanır).
- Komşu aynı türden parçalar tek segmentte toplanır.
- Bire bir değişen tek token çiftlerinde karakter düzeyinde daraltma (ortak ön ek/son ek
  dışarıda): "gidiyom → gidiyorum" ve noktalama düzeltmelerinde farkın tam yerini gösterir;
  boşluksuz diller (zh/ja) doğal olarak bu yola düşer. Yalnız iki taraf da ~120 karakterin
  altındayken (mesaj sınırı 2000).
- Eşit metinlerde iki taraf da tek `changed: false` segment döner.

`MessageBubble.tsx` düzeltme dalı (bugün 170-186): `useMemo` ile diff; `correctionOriginal`
stilinden `textDecorationLine` kaldırılır ve yalnız `changed` segmentler `colors.danger` +
üstü çizili olur; düzeltilmiş satırda `changed` segmentler `colors.success` +
`fontWeight: '700'` (ayrım yalnız renge dayanmasın diye kalın da). `message.correction` yoksa
bugünkü davranış korunur.

Kapsam dışı: `chat/[id].tsx:1010`'daki *yazarken* görünen üstü çizili orijinal — yarım cümleye
karşı canlı diff her tuşta oynar.

## PR 2 — Tab bar, Legal, Our Kitchen (D, G)

### D. Tab bar: yalnız ikon

`app/(app)/_layout.tsx`: `screenOptions`'a `tabBarShowLabel: false`, işe yaramayan
`tabBarLabelStyle` kalkar, `title` **kalır** (ekran okuyucu ve web'de sekme başlığı oradan
gelir), `TabIcon` boyutu 22 → 24.

### G. Legal ve Our Kitchen

- Yeni `src/lib/externalLinks.ts`: tüm dış adresler tek tabloda, tipli. Kaynak `website/`'daki
  `Socials.svelte` ve v1'in `environment.ts.sample`'ı (gerçek `environment.ts` gitignore'da).
  Testi her girdinin `https://` olduğunu ve tekrar etmediğini doğrular.
- Yeni `src/lib/openExternal.ts`: `expo-web-browser` (zaten bağımlılık) ile `openBrowserAsync`
  — native'de in-app tarayıcı modali, web'de yeni sekme.
- Ayarlar'a **Legal** bölümü: Privacy Policy (`langx.io/privacy-policy`), Terms
  (`/terms-conditions`), Cookie Policy (`/cookie-policy`), Data deletion (`/data-deletion`),
  Security (`github.com/langx/langx/blob/main/SECURITY.md`).
- Yeni ekran `app/(app)/kitchen.tsx` (`_layout`'ta `FULL_SCREEN`), başlık **"Our Kitchen"**,
  v1'in About Us sayfasının kart kart aynısı — v1'de uygulama içi sayfa olanlar dış bağlantıya
  çevrildi:
  - **Contributors**: Fundamentals → `github.com/langx/langx/graphs/contributors`,
    Our Backers → `backer.langx.io`.
  - **Support us**: Discord (`discord.langx.io`), Be a Patron (`patreon.com/langx`),
    GitHub Sponsors, Follow us on X (`x.com/langx_io`).
  - **LangX Token**: `token.langx.io`, Litepaper (`docs.langx.io`), X.
  - **About us**: `langx.io`, Insights (`insight.langx.io`), Backlog (`backlog.langx.io`),
    GitHub (`github.com/langx`), Release Notes, Issues, Contributing, Status
    (`status.langx.io`).
  - **Social**: Discord, Reddit (`reddit.com/r/langx`), X, Bluesky
    (`bsky.app/profile/langx.io`), Telegram (`t.me/langxapp`), Instagram
    (`instagram.com/langxapp`), TikTok (`tiktok.com/@langXapp`), Facebook
    (`facebook.com/langxapp`), YouTube (`youtube.com/@langxapp`), LinkedIn, Blog
    (`blog.langx.io`).
  - **Licenses**: BSD-3-Clause, MIT, Code of Conduct, Security.
- Etiketler sekiz dilde; `i18n/catalogs.test.ts` anahtar eşitliğini zorluyor.
- Bu adresler `website/`'takilerin ikinci kopyası olduğu için kök `REPO_MAP.md`'nin
  "Links between repos" tablosuna bir satır eklenir (kökte git yok, yerinde düzenlenir).

## PR 3 — Kayıt formu: göz ikonu, parola tekrarı, politika (H, L)

### H. Parola alanında göz ikonu

Üç parola girişi de aynı bileşeni kullanıyor (`sign-in.tsx:164`, `sign-up.tsx:79`,
`reset-password.tsx:66` → `FormField ... secureTextEntry`), dolayısıyla düzeltme tek dosyada:

- `FormField`, `secureTextEntry` geldiğinde kendi `revealed` state'ini tutar ve
  `secureTextEntry={!revealed}` verir; çağrı yerleri değişmez.
- Alan sonunda `Feather` `eye` / `eye-off` düğmesi, `position:'absolute'` + `end` (RTL'de ikon
  yazının sonunda kalsın diye `right` değil `end`), girişe ikon kadar `paddingEnd`.
- `accessibilityRole="button"`, i18n'den `common.showPassword` / `common.hidePassword`,
  `hitSlop`. `autoComplete` / `textContentType` ipuçlarına dokunulmuyor.

### L. Parola tekrarı ve politika

- `packages/shared`'da yeni saf `passwordSchema()`: **min 6, max 20**, sadece uzunluk —
  karakter sınıfı zorunluluğu yok ("çok zor olmasın"; uzunluk tabanlı kural NIST'in önerdiği
  yön). Testleri: 5 red, 6 kabul, 20 kabul, 21 red, parola trim edilmez.
- Better Auth'un `minPasswordLength` / `maxPasswordLength` ayarı aynı sayılara çekilir ki
  sunucu ve istemci aynı şeyi söylesin.
- `sign-up.tsx` ve `reset-password.tsx`'e ikinci bir "parolayı tekrar" alanı; eşleşmiyorsa
  gönder kapalı ve altında `auth.passwordsDoNotMatch`. Politika ihlali de yazarken aynı yerde
  gösterilir, sunucudan dönen hatayı beklemeden.
- Yeni i18n anahtarları sekiz dilde.

## PR 4 — Onboarding: doğum tarihi, dil adımları, ülke ve konum (C, I, J, N)

### C. `birthYear` → `birthDate`

Saklama biçimi **`'YYYY-MM-DD'` string**: doğum günü bir an değil takvim günü; Mongo `Date`'i
saat dilimine göre bir gün kayar. **Yaş kapısı yıl bazlı kalıyor** (Behic): `birthDate`'ten yıl
alınır, bugünkü `currentYear - year >= 18` aynen uygulanır, profilde gösterilen yaş da bugünkü
gibi yıl farkıdır. Tam tarih şimdilik yalnız #500 için saklanıyor.

- **shared** `age.ts`: `birthYearSchema`/`ageFromBirthYear` gider; `birthDateSchema()` (regex +
  gerçek takvim günü + ≥1900 + gelecek değil), `birthYearOf`, `ageFromBirthDate`,
  `meetsMinimumAge(birthDate, now)` gelir. `profile.ts`: onboarding şemasında `birthDate`.
- **api**: `Profile.birthDate: string`; `toPublicProfile` yine yalnız **yaş** yayar, ham tarih
  sadece `GET /profiles/me`'de. `discovery.ts` yaş aralığı tarih string'i karşılaştırmasına
  döner (`birthDate < '${yıl - ageMin + 1}-01-01'` / `>= '${yıl - ageMax}-01-01'`) — bugünkü
  davranışın birebir aynısı; `birthYear` üzerinde index yok, yenisi gerekmiyor. `handles/`:
  `toBirthYear` → `toBirthDate` (v1 zaten tam ISO tarih tutuyor, bugünkü ETL yılı alıp
  gerisini atıyor), `LegacyProfile.birthDate`, `legacyRestore` tam tarihi taşır.
  `scripts/migrate-profiles.ts` ve `seed-test-users.ts` güncellenir.
- Yeni `scripts/migrate-birthdate.ts`: `profiles` + `legacyProfiles`'ta `birthDate` yoksa
  `${birthYear}-01-01` yazar, `birthYear`'ı `$unset` eder, etkilenen handle'ları listeler;
  `--confirm` olmadan yalnız rapor, tek hesap için `--set handle=YYYY-MM-DD`. Aynı script
  PR 6'daki bildirim tercihlerini de genişletir (tek geçiş).
- **mobile**: `useOnboardingDraft.birthDate`; yeni `BirthDateField` — native'de
  `@react-native-community/datetimepicker` (`npx expo install`), `maximumDate` bugün /
  `minimumDate` 1900; web'de `.web.tsx` eşi (paketin web uygulaması yok) üç sayısal alan
  (gün/ay/yıl). İkisi de dışarıya tek bir `YYYY-MM-DD` verir. `handle.tsx`,
  `onboardingStep.ts` (+ testi), `queries.ts` tipleri, `me.tsx` yaş chip'i; i18n'de
  `yearOfBirth`/`yearPlaceholder` yerine `birthDate` anahtarları, sekiz dilde.
- **Testler**: `birthYear: 1995` geçen ~20 API testi ve shared/mobile fixture'ları mekanik
  olarak çevrilir. Yeni: `birthDateSchema` (2001-02-30, gelecek tarih, 1899), `birthYearOf`,
  `toBirthDate`, discovery aralık sınırları.

### I. Dil seçimi adım adım

Bugün `languages.tsx` tek ekran: "Native"/"Learning" sekmeleri ve seviye çipleri bir arada.
Üç rotaya bölünüyor:

1. `languages.tsx` — yalnız **ana diller**; Continue en az bir seçimle açılır.
2. Yeni `learning.tsx` — yalnız **öğrenilen diller**; ana diller `disabledCodes` ile kapalı.
3. Yeni `levels.tsx` — her seçilen dil için **1-4 seviye**. `LANGUAGE_LEVELS` zaten dört kademe
   (`absoluteBeginner … fluent`) ve `levelRank()` 1-4 veriyor; çipler bugünkü gibi ham enum
   adını değil **rakamı + `levelShortLabel`'ı** gösterir. Varsayılan seçili gelmez; seviyesiz
   devam edilemez, çünkü eşleştirmenin yarısı bu.

Ayrı rota olmasının sebebi: expo-router geri tuşu ve `onboardingStep.ts`'in "kaldığın yerden
devam" mantığı adım başına bir rota bekliyor. `furthestOnboardingStep` iki yeni adımla genişler
(+ testi), ilerleme çubuğu 4 yerine 6 olur. `LanguagePicker` olduğu gibi kullanılıyor.

### N + J. Ülke IP'den, konum ezebilir

Cloudflare proxy artık açık (Behic yaptı), yani her istekte `CF-IPCountry` geliyor. Yapılacak
iki doğrulama var: **Socket.io WebSocket yükseltmesi** CF üzerinden çalışıyor mu, ve başlık
origin'e gerçekten ulaşıyor mu (bir kez loglanıp bakılır).

**Başlık sahtelenemez olmalı:** Fly kaynağı IP'siyle hâlâ doğrudan erişilebilir, yani
`CF-IPCountry` elle gönderilebilir. CF'de bir Transform Rule paylaşılan bir sır başlığı ekler
(`X-LangX-Edge: <secret>`), API `CF-IPCountry`'yi **yalnız** sır eşleşiyorsa kabul eder. Sır
Fly secret'ı olarak durur.

- `POST /profiles` ülkeyi **sunucuda** yazar: `CF-IPCountry` geçerli bir ISO kodu ise `country`.
  İstemci artık `country` göndermiyor; `onboardingProfileSchema` ve `updateProfileSchema` bu
  alanı bırakıyor. Onboarding'deki (`photo.tsx`) ve `edit-profile.tsx`'teki `CountryPicker`
  kalkar; yerine bayrak + ülke adı olan salt-okunur bir satır ve "konumumla güncelle" düğmesi.
- **Ülke zorunlu.** `CF-IPCountry` `XX`/`T1` dönerse (Tor, bilinmeyen) tek yedek yol açılır:
  onboarding o durumda `CountryPicker`'ı gösterir. Böylece alan her profilde dolu olur.
- **Konum ezebilir (Behic'in kararı):** `src/lib/location.ts`'teki mevcut `captureLocation()`
  çağrılır — izni zaten doğru istiyor (`Lowest` doğruluk, önce `getForegroundPermissions`) ve
  başarısızlığın üç halini (`denied`/`disabled`/`unavailable`) `LOCATION_FAILURE_KEY` ile hazır
  metne çeviriyor. Fix alınınca `Location.reverseGeocodeAsync` ile `isoCountryCode` (+ `city`)
  çıkarılır ve `PATCH /profiles/me/country { source: 'location', country }` ile yazılır. Bu API
  **web'de yok**; orada düğme gösterilmez, ülke IP'den geleni kalır. Not olarak yazılı duracak:
  istemcinin bildirdiği ülke sunucuda doğrulanamıyor — serbest metin seçiciden yine de iyi.
- **Koordinatlar kaydedilmiyor.** Mesafeye göre sıralama Ayarlar'daki ayrı onaya bağlı; konumu
  bir kez okuyup ülkeye çevirmek başka şey, onu sessizce açmak başka.
- **Ayarlar'dan sonradan izin (J):** Privacy bölümünde "Konumumu kullan" satırı. Sistem
  popup'ı çıkmıyorsa (`canAskAgain === false`) ya da izin daha önce reddedildiyse, ne
  yapılacağını anlatan bir modal açılır ve `Linking.openSettings()` telefonun ayarlarına
  götürür. Metin platforma göre değişir (iOS "Ayarlar > LangX > Konum", Android "Uygulama
  bilgisi > İzinler"), sekiz dilde.
- **Gizlilik metni:** IP'den ülke çıkarmak kişisel veri işlemektir; `website/` gizlilik
  politikasına ve `docs/store/privacy-data-safety.md`'ye satır eklenir.

## PR 5 — Profil: bayrak, sohbet kutusu, istatistikler (O, P, Q, R)

- **O** Discover kartlarına ülke bayrağı: `@langx/shared`'daki `countryFlag()` zaten var ve
  profil ekranı onu kullanıyor (**P** böylece doğrulanmış oluyor — yeni iş değil, kartla aynı
  biçimde durduğu kontrol edilecek). Ülkesi olmayan eski kayıtlarda bayrak satırı hiç
  çizilmez; N'den sonra bu durum yeni kayıtlarda oluşmuyor.
- **Q** `profile/[handle].tsx`'teki "mesaj yaz" bölümü, o kişiyle **zaten bir sohbet varsa**
  gösterilmez; yerine sohbete götüren bir düğme çıkar. Sohbetin varlığı `toPublicProfile`'a
  eklenen, rotanın hesapladığı bir alandan gelir — `follow` (FollowState) için zaten kurulu
  olan kalıbın aynısı, çünkü bu da "bakan kişiye göre" bir cevap.
- **R** Profilde istatistikler:
  - `streak`, `corrections` ve `tokens` + "This week" grafiği: yeni
    `GET /profiles/:id/summary`, `/me/summary`'nin herkese açık dengi.
  - Activity chart: **zaten var** — `GET /profiles/:id/activity` (`activity.ts`) ve
    `privacy.activityMapVisible` ile korunuyor; eksik olan istemci tarafı. `ActivityMap`
    opsiyonel bir `userId` alır; verildiğinde public rotayı okur ve gün satın alma düğmesini
    çizmez. `WeeklyChart` zaten `week` prop'u alıyor, olduğu gibi kullanılır.
  - Yeni gizlilik bayrağı `privacy.statsVisible` (varsayılan **açık**) streak/correction/token
    ve haftalık grafiği kapsar; harita bugünkü `activityMapVisible`'da kalır. Ayarlar →
    Privacy'ye ikinci anahtar; iki bayrak da `updateProfileSchema`'nın kısmi `privacy` kalıbına
    uyar.
  - Kapalıyken sunucu alanları hiç göndermez — UI'da gizlemek yetmez.
- **S** Activity haritasının iki hatası, önce ekran görüntüsüyle tespit edilip sonra
  düzeltilir:
  - *Yerleşim:* `activityGrid` haftaları sütun, günleri satır olarak kuruyor ve `mondayIndex`
    gün anahtarını **cihazın yerel saat diliminde** çözüyor (`new Date('...T00:00:00')`);
    UTC'nin batısındaki bir cihazda bu, ızgarayı bir gün kaydırıyor. Gün anahtarı takvim
    günüdür, saat dilimi taşımaz — `mondayIndex` string'den hesaplanacak şekilde saf hale
    getirilir ve testine sınır günleri (ay/yıl dönümü, 29 Şubat) eklenir.
  - *Boş kutular:* harita `streakDays` koleksiyonundan çiziliyor; streak sayacı doluyken
    kutuların boş kalması, o günlerin `streakDays`'e yazılmadığı anlamına gelir. Önce
    `langx_dev`'de bir hesabın `streak.current`'ı ile `listStreakDays` çıktısı karşılaştırılır;
    fark buradaysa yazan yol (`dailyActivity` → `streakDays`) düzeltilir, haritada değil.
    Sonuç şu olmalı: **streak'i oluşturan her gün dolu kutu.**

## PR 6 — Bildirim ayarları (E)

Bugün tek bir `settings.notifications: boolean` var; yerine tür × kanal matrisi:

- **shared**: `NOTIFICATION_TYPES = ['messages','streak','profileVisits','promotions']`,
  `NOTIFICATION_CHANNELS = ['push','email']`, `notificationPrefsSchema` (tür → `{push,email}`),
  varsayılanlar: mesaj/streak/ziyaret push açık, e-posta kapalı; **promosyon ikisi de kapalı**
  (pazarlama izni opt-in olmak zorunda). Saf `notificationsAllowed(prefs, type, channel)` +
  testi.
- **api**: `ws/fanOut.ts` mesaj push'u `messages.push`'a, `reminderScheduler.ts` sorgusu
  `settings.notifications.streak.push: true`'ya, `devices.ts:226`'daki
  `'settings.notifications': true` yazımı yeni şekle bakar. Boolean → nesne geçişi
  `migrate-birthdate.ts` ile aynı script'te.
- **mobile**: tek anahtar yerine dört satır × iki `Toggle`.

**Bu PR'ın açıkça yapmadığı şey:** e-posta göndermek. Resend yalnız doğrulama e-postaları için
bağlı; şablon, gönderim ve promosyon için zorunlu "abonelikten çık" bağlantısı yok. E-posta
sütununun tamamının ve promosyonun arkasında henüz gönderici yok — tercih saklanır, gönderici
geldiğinde ona uyar. Profil ziyareti push'u da bugün yok (ziyaretçi listesi Pro özelliği
olduğu için ayrı bir ürün kararı). İstenirse ikisi de sonraki adımda eklenir.

## PR 7 — Uygulama ikonu, Pro'ya özel (F)

- `expo-alternate-app-icons@8` (peer `expo >=53`, SDK 57 uyumlu) + config plugin'e iki ikon
  (mevcut varsayılan ve bir alternatif, 1024×1024, `branding/` deposundan).
- Ayarlar'da iki kutucuklu seçici; `usePlanTier()` free dönüyorsa satır kilitli ve
  `/(app)/paywall`'a götürür. Seçim cihaz tercihi olarak saklanır (temanın kalıbı), sunucuda
  tutulmaz.
- **Uyarılar:** native değişiklik, OTA ile gitmez — yeni build gerekir; web'de ve Expo Go'da
  satır gösterilmez, yani app2.langx.io'da görünmeyecek.

## Ayrı PR — `website/` (zorunlu)

Yayındaki metin düzeltilmezse yanlış olur; CLAUDE.md bu kopyaların elle senkron tutulmasını
şart koşuyor:

- `TermsAndConditions.svelte:11` ve `PrivacyPolicy.svelte:19`: "year of birth" → tam doğum
  tarihi.
- Gizlilik politikasına: bağlantı IP'sinden **ülke** çıkarıldığı ve saklandığı, konum izni
  verilirse ülkenin oradan güncellendiği.
- `langx/docs` tarafı ilgili PR'ların içinde gider: `architecture.md` (144, 225, 469),
  `decisions.md` (33, 411 — kararın tersine çevrilmesi ve gerekçesi),
  `store/privacy-data-safety.md` (satır 15 "Year of birth" → "Date of birth", ayrıca IP → ülke
  satırı), `legal/promise-change.md`'ye bir madde.

---

## Çalışma düzeni (Behic'in verdiği yetki)

- Her PR'ın check'leri yeşile dönünce **merge etmek bende**; merge sonrası yerel `main`
  `origin/main` ile senkronlanır ve bir sonraki dal oradan açılır.
- Arada **ekran görüntüsü** paylaşılır ki ilerleme takip edilebilsin.
- Ara geri bildirimler **tek cümle**, ve her mesaj planın tahmini yüzdesiyle başlar
  (`%37 — ...` gibi).
- Hepsi bitince: önce **api2** (Fly), sonra **app2** (Cloudflare Pages) deploy edilir —
  istemci cevapları doğrulamadan okuduğu için sıra bu. Web build'i paylaşılan checkout'tan
  değil, atılabilir bir worktree'den alınır.
- Kapanışta temizlik: push'lanmamış commit kalmaz, işi biten dallar (yerel ve uzak) silinir,
  ve son bir özet verilir.

## Sıra ve doğrulama

Sıra: PR 1 → 2 → 3 (API'ye dokunmuyor, hızlı) → PR 4 ve 5 (API + tek migration script) → PR 6
→ PR 7 (native build gerektiriyor). Her dalda PR'dan önce dört kontrol: `pnpm test`,
`pnpm -r typecheck`, `pnpm lint`, `pnpm format:check` (Actions feature branch'te çalışmıyor).

- Yerel Expo web (`:8081`) + Playwright, iki context: `hasTouch: true` olanda balonu sağa
  sürüklemek yanıt bandını açmalı; `hasTouch: false` olanda hiçbir şey olmamalı ve metin seçimi
  çalışmalı.
- Düzeltme için iki tohum mesaj (kelime değişimi + ek düzeltmesi), açık ve koyu temada ekran
  görüntüsü.
- Kayıt formu: göz ikonuyla alanın `type`'ı `password` → `text` → `password`; eşleşmeyen
  parolada düğmenin kapalı kaldığı; 5 ve 21 karakterin reddi.
- Onboarding baştan sona (web varyantı Playwright ile): ana dil → öğrenilen dil → seviye →
  doğum tarihi → ülke. Ardından `migrate-birthdate.ts` önce raporla, sonra `--confirm` ile
  `langx_dev`'de; `langx` (prod) için Behic'in onayıyla.
- Ülke: sır başlığı olmadan doğrudan Fly IP'sine `curl -H 'CF-IPCountry: DE'` gönderilip
  **kabul edilmediği**, CF üzerinden gelen istekte ise doğru ülkenin yazıldığı. CF proxy açıldı,
  ayrıca Socket.io'nun WebSocket yükseltmesinin CF üzerinden çalıştığı canlıda doğrulanır.
  Konumla ezme ve Ayarlar'daki modal native gerektiriyor, Expo Go ile elle.
- Profil: sohbeti olan ve olmayan iki kullanıcıyla açılıp mesaj kutusunun gidip geldiği;
  `statsVisible` kapalıyken sunucu cevabında alanların hiç bulunmadığı.
- Tab bar, Our Kitchen ve bildirim matrisi: ekran görüntüsü, biri koyu temada.
- Deploy bu planın parçası değil — api2/app2'yi langx-c7 yayınlıyor; bu dallar merge edildikten
  sonraki yayına girer.
