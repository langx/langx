# Cüzdan, Pro hoşgeldin paketi, ve tek bildirim anahtarı

## Context

Üç ayrı istek, tek oturumda çıktı. Ortak noktaları yok — üç ayrı PR olacaklar,
ve **1 numaralı iş peer'in dalı inmeden başlayamaz**.

1. **Cüzdan.** Profildeki bakiye tile'ı bugün `/(app)/store` adlı, başlığı
   "Tokens" olan tek bir ekrana gidiyor: bakiye, günlük havuz, mağaza teklifleri
   ve (peer'in şu an eklediği) kazanç geçmişi hepsi aynı sayfada. Behic bunun
   bir **cüzdan** olmasını, token'ın ise içine tıklayınca çıkan bir alt katman
   olmasını istedi. Amaç: "neyim var / ne alabilirim" ile "bunlar nereden geldi"
   sorularını ayırmak.

2. **Pro hoşgeldin paketi.** Behic Pro'ya 4.000, Pro+'a 10.000 token hediye
   etmeyi önerdi. Bu haliyle yapılamaz (aşağıda), yerine **token değil, token'ın
   satın aldığı eşya** veriliyor. Hissedilen değer aynı, uyum riski yok.

3. **Tek bildirim anahtarı.** Ayarlar ekranı 4 bildirim türü × 2 kanal (push,
   email) matrisi çiziyor. Email sütununun **hiçbir göndericisi yok** —
   `apps/api/src/email/` sadece doğrulama ve şifre sıfırlama gönderiyor. 8
   hücrenin 6'sı hiçbir şey yapmıyor. Behic kanalları tek anahtara indirmek
   istedi; matrisi kuran yorumun gerekçesi (türleri ayırmak) korunuyor, sadece
   kanal ekseni kalkıyor.

---

## İş 1 — Cüzdan / Token ayrımı

### Önce: peer'i bekle

`langx-05` şu anda `tokens/pool-pays-at-0400` dalında `store.tsx`'i yeniden
yazıyor; geçmiş listesini oraya koydu, `src/lib/tokenHistory.ts` +
`tokenHistory.test.ts` yazdı, 8 katalogu ve `docs`'u kendi PR'ında bitiriyor.
Sunucu tarafı bitti ve yeşil (55 test). **`store.tsx`, `tokenHistory.ts` ve
i18n katalogları o inene kadar dokunulmaz** — mesajlaştık, bunu biliyor ve
bölmeyi benim yapacağımı da biliyor.

O indikten sonra: `git worktree add ../langx-wallet origin/main` (peer'in
commit'i main'de olacak) **ve içinde `pnpm install`** — `CLAUDE.md` neden
paylaşılan `node_modules`'ün sessizce yanlış `packages/shared`'e çözüldüğünü
anlatıyor.

### İsimlendirme

Üç isim, üçü de kodda zaten doğru şeyi anlatıyor:

| Kavram | İsim | Neden |
| --- | --- | --- |
| Kap: bakiye, sahip olunanlar, alınabilecekler | `wallet` | API zaten `GET /me/wallet`, tip `Wallet`, hook `useWallet()`. Başka bir isim veri katmanıyla UI'ı çelişkiye sokar. |
| Alınabilecekler kataloğu | `store` (değişmez) | `buildStoreOffers`, `StoreOffer`, `StoreRow`, `store.buy/owned/...` bir dükkânı doğru tarif ediyor. Cüzdanın içinde bir bölüm başlığı olur. |
| Kazanç defteri: geçmiş, havuz, toplamlar | `tokens` | `useTokens()`, `TokenSummary`, `/me/tokens`, `/me/tokens/history` zaten böyle. |

### Dosyalar

- `git mv apps/mobile/app/(app)/store.tsx apps/mobile/app/(app)/wallet.tsx`,
  bileşen adı `WalletScreen`.
- Yeni `apps/mobile/app/(app)/tokens.tsx` (`TokensScreen`).
- `apps/mobile/app/(app)/_layout.tsx` — `<Tabs.Screen name="store">` satırı
  `wallet` ve `tokens` olarak **ikiye çıkar**. Her `(app)` ekranı gizli bir tab;
  kayıt unutulursa tab bar geri gelir ve alt padding ikilenir. `routeLiterals`
  testi dosyaları tarar, kaydı taramaz — **bunu hiçbir test yakalamaz.**
- `apps/mobile/app/(app)/me.tsx` — tile `router.push('/(app)/wallet')`, etiket
  `${t('me.wallet')} ›`.
- `src/lib/storeOffers.ts`, `components/store/StoreRow.tsx`, `src/lib/tokenHistory.ts`
  — **hiç değişmez.** Peer'in geçmiş UI'ı yeniden yazılmaz, olduğu gibi taşınır.
- Yeni `apps/mobile/src/components/tokens/HistoryDayRow.tsx`: peer'in
  `store.tsx` içine gömdüğü açılır gün satırı, JSX'i aynen alınarak bileşene
  çıkarılır (`ListRow` n tane alt satır ifade edemiyor, o yüzden yeni bileşen).

### İçerik bölümü

**`/(app)/wallet`** — "neyim var, ne alabilirim"
1. `ScreenHeader title={t('wallet.title')} onBack={() => goBackTo('/(app)/me')}`
2. Bakiye bloğu, **artık `Pressable`** → `router.push('/(app)/tokens')`.
   Altında `wallet.earnedSpent` ("12.480 kazanıldı · 3.200 harcandı") ve
   `wallet.balanceHint` ("Nereden geldiğine bak") — dokunmanın görünür sebebi,
   profildeki `›` ile aynı mantık.
3. **Sahip olduklarım** — 4. işin takma seçicisi buraya oturuyor (o iş inene
   kadar iki `StatTile`: `wallet.streakFreezes`, `wallet.itemsOwned`).
4. `wallet.storeTitle` başlığı + mevcut `offers.map(...)` → `StoreRow` bloğu,
   birebir.
5. Disclaimer (yeniden yazılmış, aşağıda) — uygulamada tek yerde.

`useTokens()` bu ekrandan **düşer**; hiçbir şey `TokenSummary` okumuyor artık.

**`/(app)/tokens`** — "bunlar nereden geldi"
1. `ScreenHeader title={t('tokens.title')} onBack={() => goBackTo('/(app)/wallet')}`
2. `xp.data.tokens`'tan üç `StatTile`: bu hafta / bu ay / tüm zamanlar.
3. `tokens.intro` — kazanç cümlesi mağazadan buraya taşınır.
4. Havuz bloğu: peer'in `lastPayout` tasarımı **aynen** taşınır. Projeksiyon
   yok — `token.ts`'in şema yorumu neden olmadığını anlatıyor, peer de mesajında
   teyit etti.
5. Geçmiş listesi: `useTokenHistory()`, `buildTokenHistory()`, `HistoryDayRow`,
   `history.hasNextPage` ile "daha fazla".

Hiçbir bölüm iki ekranda birden durmaz.

### i18n

Peer `tokenKind.*` (9 kanal etiketi) ve `store.history*` / `store.shareFor` /
`store.noShareYet` / `store.poolCap` / `store.poolPaidAt` anahtarlarını kendi
dalında ekliyor. Ben onun üstünde:

- Yeni `wallet.*`: `title` ("Wallet"), `balance`, `balanceHint`, `earnedSpent`,
  `streakFreezes`, `itemsOwned`, `storeTitle`, `disclaimer`.
- Yeni `tokens.*`: `title` ("Tokens"), `intro`, `thisWeek`, `thisMonth`,
  `allTime` + peer'in `store.*` havuz/geçmiş anahtarlarının taşınmışı.
- `me.tokens` → `me.wallet`.
- `store.*`'ta sadece alım-satım anahtarları kalır (`buy`, `owned`,
  `restoreStreak`, `streakFreeze`, `frameKind`, `titleKind`, …).
- `store.todayCounts` yanlış gruptaydı; tek tüketicisi `WeeklyChart.tsx` —
  `weekly.counts` olur.
- `tokenKind.*` yerinde kalır, ekran bölünmesinden etkilenmez.

8 dilin hepsi (`en,tr,de,fr,es,pt-BR,ru,ar`) — İngilizceye tiplendikleri için
eksik anahtar derlenmiyor. `catalogs.test.ts` `{placeholder}` kümelerini de
karşılaştırıyor.

### Disclaimer ve "wallet" kelimesi — dikkat

`docs/release-runbook.md:316-318`, `docs/token-messaging-brief.md`'ye atıfla
**coin/chain/wallet ikonografisini App Review 3.1.5(b) gerekçesiyle yasaklıyor.**
Ekranı "Wallet" diye adlandırmak savunulabilir (puan tutuyor, adres yok, connect
akışı yok, zincir yok) ama brief **aynı PR'da** güncellenmezse runbook'u okuyan
bir sonraki kişi uygulamayı uyumsuz sayar.

- `docs/token-messaging-brief.md`'ye "kullandığımız / kullanmadığımız kelimeler"
  notu: puan bakiyesi tutan uygulama içi ekranın adı olarak "Wallet" serbest;
  yasak olan **kripto cüzdanı** — wallet **address**, "connect wallet", coin/chain
  ikonu, ve saklama/transfer ima eden her ifade. Yeni ekranlarda coin/chain
  glifi yok (Feather `award`/`gift`).
- `docs/decisions.md`'ye bir kayıt — bu repo *nedenini* yazıyor, ve "brief wallet
  çerçevesini yasaklarken ekranın adı Wallet" tam olarak notsuz bırakılınca
  yanlış görünen türden bir karar.
- Yeni İngilizce disclaimer:
  > Tokens are in-app points. They cannot be bought, traded, withdrawn or used
  > to unlock Pro — only streak freezes and cosmetics. There is no chain, no
  > contract and no market.

  "no wallet" düşer; satın alınamaz / takas edilemez / çekilemez / Pro açamaz /
  zincir yok / piyasa yok korunur.

**Kardeş repo'lardaki aynı iddia — bu daldan düzeltilmez, ayrı iş olarak
raporlanır** (`REPO_MAP.md`: elle senkron, hiçbir şey kontrol etmiyor):
- `docs/` (GitBook), 12 dosyada "…there is no wallet to connect." →
  "…no blockchain wallet to connect." (`learn-2-earn/connect-wallet.md`,
  `claim-your-tokens.md`, `token/staking.md`, `langx-nft.md`, `trading.md`,
  `library/technology/*` 7 dosya). `token/README.md` ve `token/token.md`'deki
  "no wallet address" **doğru**, kalır.
- `token-website/index.html` (meta + hero şeridi) ve `tools/og-source.html`:
  "No wallet" → "No chain" (OG görseli yeniden üretilir). `privacy.html`'deki
  "no wallet" siteyle ilgili, kalır.
- `website/src/lib/data/token.ts:55` "no wallet address" — doğru, kalır.

### Test sonuçları

- `routeLiterals.test.ts`: `ROUTE_CALLEES` **değişmez** — yeni literal'lerin
  hepsi zaten listede olan `router.push` / `goBackTo` üzerinden geçiyor.
  `structured > 40` / `broad > 60` tabanları yükseliyor, düşmüyor. `me.tsx`'teki
  push güncellenmezse test doğru şekilde patlar.
- `catalogs.test.ts`: 8 katalog eşitlenene kadar kırmızı.
- `storeOffers.test.ts`, `tokenHistory.test.ts`: dokunulmaz.

---

## İş 2 — Pro / Pro+ hoşgeldin paketi

### Neden token değil

Üçü de doğrulandı, üçü de görüş değil:

1. `docs/token-messaging-brief.md:17` — "**Not purchasable.** There is no way to
   buy tokens, with money or anything else." Bu dosya App Review 3.1.5(b) için
   var. Aynı iddia `docs/legal/promise-change.md`'de (**henüz yayınlanmamış** —
   yani sözü vermeden revize etmiş olurduk), `store.disclaimer`'da 8 dilde,
   `website/`, `token-website/` ve GitBook'ta 15+ dosyada.
2. **Bakiye ile all-time liderlik tablosu aynı sayı.** `wallet.ts:43`
   `earned = readAggregates(db, userId).all`, `leaderboard.ts` de tam olarak
   `tokenAggregates`'i sıralıyor. `TOKEN_GRANT_KINDS` hafta/ay/yıl kovalarını
   koruyor ama `all`'u koruyamaz — bakiye oradan okunuyor. Token hediyesi
   zorunlu olarak all-time tablosunu parayla oynatır.
3. **Ölçek.** Tüm kozmetik kataloğu 21.000 token. 10.000 hediye kataloğun
   yarısını ilk gün alır; token'ın tek çıkışı kozmetikler ve streak freeze.

### Ne yapılacak

Token yerine **token'ın satın aldığı şey**: `profiles.cosmetics` ve
`profiles.streakFreezes` alanlarına doğrudan yazılır, ledger'a hiç dokunulmaz.

- Pro: bir çerçeve + 2 streak freeze
- Pro+: tüm çerçeveler + bir unvan + 2 streak freeze

(Kesin içerik `packages/shared/src/cosmetics.ts`'te config olarak, hard-code
değil — `CLAUDE.md`: "Limits and rules are config".)

### Nereye bağlanır

`apps/api/src/modules/billing/refresh.ts` → `refreshEntitlement()` **tek huni**:
hem RevenueCat webhook'u hem de client'ın `POST /billing/refresh` fallback'i
buradan geçiyor. Ücretsizden ücretliye geçişte paket verilir.

**Idempotent olmak zorunda** — `refreshEntitlement` her yenilemede çağrılıyor.
Profilde bir mandal (`proWelcomePackAt`, tier bazında), `streakRestoredAt`'in
kurduğu kalıpla. Aboneliği bırakıp geri dönen ikinci kez almaz; Pro'dan Pro+'a
yükselen sadece aradaki farkı alır.

Abonelik biterse verilen kozmetikler **geri alınmaz** — geri alma, iptal anında
profilin görünüşünü bozar ve destek talebi üretir. Bu bir karar, not düşülür.

### Dokunulanlar

`packages/shared/src/cosmetics.ts` (paket tanımı + tipi),
`apps/api/src/modules/billing/refresh.ts`, `modules/profiles/profiles.ts`
(mandal alanı), yeni test `refresh.test.ts` (iki kez çağır → bir kez ver;
free→pro→pro_plus → fark verilir), i18n (paketi anlatan satır, muhtemelen
paywall ekranında). `docs/token-messaging-brief.md`'ye bir satır: Pro eşya
veriyor, token vermiyor — "not purchasable" bu yüzden ayakta kalıyor.

---

## İş 3 — Tek bildirim anahtarı

### Şu an

`apps/mobile/app/(app)/settings.tsx` 4 tür × 2 kanal matrisi çiziyor. Gerçekte
çalışan **2 hücre var**:

| tür | push | email |
| --- | --- | --- |
| `messages` | ✅ `ws/fanOut.ts` | ✗ |
| `streak` | ✅ `modules/push/reminderScheduler.ts` | ✗ |
| `profileVisits` | ✗ | ✗ |
| `promotions` | ✗ | ✗ |

`PUSH_KINDS` zaten kapalı bir birleşim: `['message', 'streakReminder']`.
`apps/api/src/email/templates.ts` sadece `verificationEmail` ve
`resetPasswordEmail` içeriyor, `EmailSender` hiçbir `modules/` dosyasında
import edilmiyor.

Matrisi kuran yorumun gerekçesi (**türleri** ayırmak: streak dürtmesini
istemeyen, beklediği mesajı da kapatmak zorunda kalmasın) **korunuyor** —
kalkan sadece kanal ekseni.

### Şekil

`packages/shared/src/notifications.ts`:
- `NotificationPrefs = Record<NotificationType, boolean>`
- `NOTIFICATION_CHANNELS` ve `NotificationChannel` kalkar
- `notificationsAllowed(prefs, type)` — kanal parametresi düşer
- `DEFAULT_NOTIFICATION_PREFS = { messages: true, streak: true, profileVisits: true, promotions: false }`

`notificationsAllowed` **üç şekli birden okumak zorunda** (üçü de üretimde
canlı): `boolean` (v1 profilleri), matris (`{push, email}`), ve yeni düz
boolean. Matris dalı `.push`'u okur — `email` hiç göndermediği için sadık
eşleme o. `push || email` **alınmaz**: push'u kapatıp email'i açık bırakan
kullanıcıya push'u sessizce geri açar.

### Dokunulanlar

- `packages/shared/src/notifications.ts` + `notifications.test.ts` (suite'in
  neredeyse tamamı kanal şekilli, yeniden yazılır — üç şekil için de test)
- `packages/shared/src/profile.ts` — `notificationPrefsSchema` düzleşir
- `apps/api/src/modules/profiles/profiles.ts` — repository'deki iç içe döngü
  tek seviyeye iner (`settings.notifications.${type}`). Mongo, mevcut
  `{push,email}` alt-dokümanının üstüne boolean `$set`'ini kabul ediyor.
- `apps/api/src/ws/fanOut.ts`, `modules/push/devices.ts`,
  `modules/push/reminderScheduler.ts` — çağrılardan kanal argümanı düşer.
  `devices.ts`'teki `'settings.notifications': { $ne: false }` ön-filtresi
  çalışmaya devam ediyor ama yorumu yanlışlaşıyor, düzeltilir.
- `apps/mobile/app/(app)/settings.tsx` — `channelHead`/`channelLabel`/`channels`
  stilleri ve iki sütun kalkar; `accessory={<Toggle …/>}` tek anahtar olur.
- i18n: `settings.push` ve `settings.email` (sütun başlıkları) 8 dilden silinir.
  Zaten ölü olan `settings.pushTitle`/`settings.pushBody` de silinir.
  `notifications.*` satır metinleri aynen kalır.
- `apps/api/src/routes/profiles.test.ts` — "changes one notification switch"
  testi yeni şekle göre güncellenir.
- **Test boşluğu, kapatılır:** `catalogs.test.ts`'in "dynamically built keys"
  bloğu `notifications.${type}` anahtarlarını kontrol etmiyor, ve `settings.tsx`
  `as MessageKey` cast'i kullanıyor — bugün bir tür eklense ekranda ham
  `notifications.foo` yazar ve hiçbir test patlamaz.

### Göç

`notificationsAllowed`'ın uyum dalı sayesinde göç **zorunlu değil**; geri dönüş
de güvenli kalır. Yine de temizlik için
`apps/api/scripts/migrate-notifications.ts`, ev kalıbıyla: varsayılan kuru
çalışma, yazmak için `--apply`, idempotent atlama koşulu, hem
`COLLECTIONS.profiles` hem `legacyProfiles`. Örnek:
`apps/api/scripts/migrate-birthdate.ts` — zaten bir kere bu alanı
`boolean → matris` diye dönüştürmüş.

### Açık soru (engelleyici değil)

`profileVisits` ve `promotions`'ın hiçbir kanalda göndericisi yok. Tek anahtara
inince "hiçbir şey yapmayan anahtar" daha görünür oluyor. Öneri: **kalsınlar** —
mevcut gerekçe (rıza gönderici gelmeden önce kayda geçsin) hâlâ geçerli ve
`promotions` için doğru olan da bu. Behic aksini isterse gönderici gelene kadar
gizlenebilir.

---

## İş 4 — Kozmetikler: çalışır, görünür, geniş

### Başlangıç noktası: mağaza şu an hiçbir şey satmıyor

Doğrulandı, repo genelinde tek bir render noktası yok. `frame.gold`'u 5.000
token'a alan kullanıcının uygulamasında hiçbir şey değişmiyor —
`profile.cosmetics` dizisine bir string ekleniyor, o kadar. `Avatar.tsx`'in
`frame` prop'u yok, hiçbir ekran isim yanına unvan yazmıyor, ve **"hangisi
takılı" diye bir alan da yok.**

Hazır olan: `GET /profiles/:handle` zaten `cosmetics: string[]` gönderiyor
(kullanılmıyor), ve `purchase()` fiyat dışı koşulla reddetmeyi zaten iki yerde
yapıyor (zaten sahipsin / freeze bankası dolu) — hem ön kontrol hem atomik
`findOneAndUpdate` filtresinde. Kilitli eşya için yeni kalıp gerekmiyor.

### 4a. Takma modeli

`Profile`'a yeni alan: `equipped?: { frame?: string; title?: string }`.
`updateProfileSchema`'ya eklenir, `PATCH /profiles/me` üzerinden değişir,
`Wallet` ve `PublicProfile` DTO'larına çıkar.

**Doğrulama sunucuda**: takılan id `COSMETICS`'te olmalı, doğru `kind` olmalı,
**ve kullanıcının `cosmetics` dizisinde bulunmalı** — sahip olmadığı çerçeveyi
takmak reddedilir. İstemci kontrolü yeterli değil.

**Göç yok.** Alan opsiyonel, yokluğu "hiçbir şey takılı değil" demek. Ama
`equipped.frame` boşken kullanıcı çerçeve sahibiyse **sahip olduğu en pahalısı
varsayılan olarak çizilir** — açık seçim bunu ezer. Böylece bugüne kadar
kozmetik almış olan kimse "aldığım şey nerede" demez, ve göç betiği yazmaya
gerek kalmaz.

### 4b. Katalog: 10 çerçeve + 10 unvan, yeniden fiyatlandırılmış

`packages/shared/src/cosmetics.ts` genişler **ve mevcut altı kozmetiğin fiyatı
yükselir.** Bu ekonomiyi düzelten asıl hamle: bugünkü katalog toplam 21.000
token, yani çok aktif bir kullanıcının (~700/gün) **30 günde** hepsini alıp
bitirdiği bir çıkış. Yeni merdiven toplam ~393.000 — token'ın harcanacak bir
yeri olur.

Yan fayda: v1'in en büyük bakiyesi 2,28M ÷ 100 = 22.800 token. Eski
fiyatlarla dönen bir v1 kullanıcısı katalogun neredeyse tamamını ilk gün
alırdı; yeni merdivende altın çerçeve civarına kadar geliyor.

> **Uygulamadan önce tek sorgu:** eski fiyattan kozmetik almış kullanıcı var mı
> (`profiles` içinde `cosmetics` dizisi boş olmayanlar). v2 henüz mağazalarda
> değil ama app2.langx.io üretim veritabanını okuyor, yani mümkün. Varsa
> ya fiyat farkı iade edilir ya da o alımlar olduğu gibi bırakılır — ikisi de
> kabul edilebilir, ama **bilmeden fiyat yükseltilmez.**

`Cosmetic` iki alan kazanır:

```ts
export interface Cosmetic {
  id: string
  kind: CosmeticKind
  label: string
  price: number
  /** Çerçeveler için: mobil tarafın temaya çevirdiği renk rolü. */
  tone?: CosmeticTone
  /** Fiyattan başka koşul. Yoksa sadece bakiye yeter. */
  requires?: { longestStreak?: number; corrections?: number }
}
```

`tone` bir **renk rolü adı**, ham hex değil — `tokens.ts` "paletler yalnızca
`useTheme()` üzerinden okunur, modül seviyesinde import edilmez" diyor. Mobil
tarafta `frameTone(colors, tone)` eşlemesi yapılır. Mevcut palette `accent`,
`success`, `streak`, `pro`, `proPlus`, `info`, `warning`, `ink` zaten var;
`bronze`/`silver`/`gold` metalikleri palete üç yeni giriş olarak eklenir (light
+ dark).

Önerilen katalog (isimler tartışmaya açık, merdiven değil):

| Çerçeve | Fiyat | | Unvan | Fiyat |
| --- | --- | --- | --- | --- |
| `frame.slate` | 1.000 | | `title.beginner` | 1.500 |
| `frame.bronze` ↑ | 2.500 | | `title.learner` ↑ | 3.000 |
| `frame.sky` | 4.000 | | `title.helper` | 5.000 |
| `frame.silver` ↑ | 6.000 | | `title.tutor` ↑ | 8.000 |
| `frame.mint` | 9.000 | | `title.mentor` | 12.000 |
| `frame.ember` | 13.000 | | `title.linguist` | 15.000 |
| `frame.gold` ↑ | 18.000 | | `title.polyglot` ↑ | 17.000 |
| `frame.violet` | 25.000 | | `title.scholar` | 20.000 |
| `frame.midnight` | 35.000 | | `title.master` | 50.000 |
| `frame.aurora` 🔒 | 50.000 | | `title.legend` | 100.000 |

↑ = mevcut id, fiyatı yükseldi. Toplam ~393.000 token; ~700/gün kazanan çok
aktif bir kullanıcı için ~560 gün, yani katalog tükenmiyor.

Ölçek kontrolü: doğrudan ödüller günde en fazla 200 (mesaj) + düzeltmeler,
havuz payı en fazla 500. 100.000'lik `title.legend` bu tavanlarda ~140 günlük
tam performans — hedef olarak uzak, ulaşılmaz değil.

1.000'lik giriş bilerek `signupBonus`'un (250) üstünde: yeni kullanıcı ilk
şeyini kazanarak alır, hediye edilerek değil.

**Unvan olarak "native" kullanılmıyor** — kullanıcı hakkında doğrulanmamış bir
olgu iddia eder.

### 4c. Zor eşya: `frame.aurora`

```ts
requires: { longestStreak: 365, corrections: 5000 }
```

İkisi de **azalmayan** sinyaller, atomik yeniden kontrolün dürüst olması için
şart. İkisi de ürünün zaten tanıdığı en tepe eşikler:
`TOKEN_RULES.streakMilestones`'ın en büyüğü 365, `CORRECTION_THRESHOLDS`'ın en
büyüğü 5.000. Yani mağaza ile rozet ekranı aynı hikâyeyi anlatıyor.

Sunucu tarafı, `purchase()` içinde mevcut iki reddin şekliyle:
- `profile.streak.longest` — profilde duran alan, **atomik filtrede de**
  kontrol edilir.
- Düzeltme sayısı — `countCorrectionsWritten(db, userId)`, iki indeksli
  `countDocuments`. Hesaplanan bir değer olduğu için sadece ön kontrol
  yapılabilir; monoton arttığı için bu kabul edilebilir, koda not düşülür.

İstemci tarafında **yeni istek yok**: `xp.data.streak.longest` ve
`xp.data.lifetime.corrections` mağaza ekranında zaten mevcut.

Fiyatla kapı birbirini destekliyor: 5.000 düzeltme tek başına 50.000 token
kazandırır (düzeltme başına 10), yani kapıyı geçen biri fiyatı zaten
karşılayabiliyor. Kapı "kim alabilir"i, fiyat "ne zaman"ı belirliyor.

### 4d. Çizim

**Çerçeve** — `Avatar.tsx` yeni `frame?: string` prop'u alır. Halka, mevcut
görünümü saran ve `size + 2*ringWidth` boyutunda bir dış `View` olarak çizilir;
iç görünüm olduğu gibi kalır, böylece **çevrimiçi noktası yerinden oynamaz**
(nokta iç daireye `bottom/end: 0` ile mutlak konumlu). `borderWidth`'i mevcut
görünüme vermek içeriği küçültür ve noktayı kaydırır — o yol seçilmiyor.
Halka kalınlığı boyutla orantılı, en az 2px (liderlik tablosunda avatar 36px).

**Unvan** — isim yanında bir `Chip`. `TierBadge.tsx` tam olarak bu kalıbın
mevcut örneği (isim yanında `tone`'lu küçük çip), o mirror alınır.

**Nerede** (kapsam kararı: profiller + liderlik tablosu):
- `app/(app)/me.tsx` — kendi profil hero'su (avatar 72)
- `app/(app)/profile/[handle].tsx` — public profil hero'su (avatar 84).
  `PublicProfile` DTO'suna `equipped` eklenir; `cosmetics` zaten gidiyor.
- `app/(app)/leaderboard.tsx` — satır (avatar 36).
  `modules/tokens/leaderboard.ts:134`'teki projeksiyon `{handle, displayName,
  avatarUrl, streak}` — `equipped` eklenir. Sahip olunanların tamamı değil,
  sadece takılı olan; yük küçük kalır.

Keşfet / akış / sohbet listesi / beğenenler / takipçiler **bu işte
değişmiyor**; altı ayrı API modülüne alan eklemek gerekirdi ve küçük
avatarlarda halka görsel gürültü yapıyor.

### 4e. Önizleme (token harcamadan anlamak)

`StoreRow` sol tarafına bir **önizleme yuvası**: çerçeveler için kullanıcının
**kendi avatarı** o çerçeveyle (36px), unvanlar için kendi görünen adıyla çip.
Ayrı bir ekran/sheet değil — 18 satırlık bir listede her satır kendini
anlatmalı, gezinme eklemek anlamayı zorlaştırır.

### 4f. Kilitli durum

`StoreRow` bugün üç durum çiziyor ve **"henüz alamazsın" ile "paran yetmiyor"
aynı görünüyor** (ikisi de gri rakam). Dördüncü durum eklenir.

`StoreOffer` genişler: `locked: boolean` ve
`requirement?: { kind: 'streak' | 'corrections'; current: number; threshold: number }`.
`affordable` **kullanılmaz** — o alan "bakiye yetiyor" demek, anlamı
bozulmamalı. Kilitli satır ilerlemeyi yazar: "1.240 / 5.000 düzeltme".

`buildStoreOffers` saf kalır, `StoreInput`'a `longestStreak` ve
`lifetimeCorrections` eklenir. `storeOffers.test.ts` genişler: kilitli iken
`locked: true` ve bakiye ne olursa olsun satın alınamaz; iki eşiğin biri
tutup diğeri tutmazken hâlâ kilitli; ikisi de tutunca fiyat kuralı devreye
girer.

### 4g. i18n

18 kozmetik × 8 dil = 144 etiket, `cosmetics.*` grubuna. `cosmeticKey()`
`frame.midnight` → `cosmetics.frameMidnight` eşlemesini zaten yapıyor, id'ler
camelCase'lenebilir olmalı. `catalogs.test.ts`'in "dynamically built keys"
bloğu kozmetikleri **zaten kapsıyor** — eksik etiket testi kırar.

Ayrıca: takma seçicisi başlıkları, kilitli satırın ilerleme metni, önizleme
erişilebilirlik etiketleri.

### 4h. Dokunulanlar

`packages/shared/src/cosmetics.ts` (katalog + `tone` + `requires`),
`profile.ts` (`equipped` şeması), `apps/api/src/modules/tokens/wallet.ts`
(kapı kontrolü), `modules/profiles/profiles.ts` (`equipped` alanı, doğrulama,
`toPublicProfile`), `modules/tokens/leaderboard.ts` (projeksiyon),
`apps/mobile/src/components/ui/Avatar.tsx` (+`frame`), yeni
`components/ui/CosmeticTitle.tsx`, `src/lib/theme/tokens.ts` (üç metalik renk),
`src/lib/storeOffers.ts` + testi, `components/store/StoreRow.tsx`,
`app/(app)/wallet.tsx` (seçici), `me.tsx`, `profile/[handle].tsx`,
`leaderboard.tsx`, 8 katalog.

`docs/token-messaging-brief.md`'deki "spend on cosmetic frames and titles"
listesi ve `docs/` (GitBook) `token/utility.md` genişleyen katalogla
güncellenir — ikisi de elle senkron.

---

## İş 5 — Filtrelerin Pro çizgisi yeniden çiziliyor

### Bugün

`DISCOVERY_PRO_FILTER_KEYS` yedi anahtar: `gender`, `onlyMyGender`, `country`,
`minLevel`, `maxLevel`, `ageMin`, `ageMax`. Hepsi tek bir `advancedFilters`
bayrağı ardında. Ücretsiz kalan: `targetLanguage` ve `online`.

### Yeni çizgi

| Filtre | Bugün | Olacak |
| --- | --- | --- |
| Seviye (`minLevel`/`maxLevel`) | Pro | **Ücretsiz** |
| Yaş (`ageMin`/`ageMax`) | Pro | **Ücretsiz** |
| Ülke (`country`) | Pro | **Ücretsiz** |
| Cinsiyet (`gender`) | Pro | Pro |
| Sadece kendi cinsiyetim (`onlyMyGender`) | Pro | Pro |
| Şehir (`city`) | **yok** | Pro (yeni) |

`DISCOVERY_PRO_FILTER_KEYS = ['gender', 'onlyMyGender', 'city']`. Sunucu
kapısı (`discovery.ts:125-132`) bu listeyi okuduğu için **başka hiçbir yerde
değişiklik gerekmiyor** — anahtar listeden çıkınca gate de kalkıyor. Aynı
şekilde `filters.tsx`'teki `set(patch, pro)` çağrılarında ilgili bölümler
`true` yerine varsayılana döner ve `SectionTitle locked` kalkar.

Bu bir **söz iyileştirmesi**: `docs/legal/promise-change.md` "free forever"ın
bozulduğu üç şeyden biri olarak filtreleri sayıyor. Üçünü geri vermek o
belgeyi zayıflatmıyor, güçlendiriyor — yayınlanmadan önce güncellenir.

### ⚠️ `city` filtre olarak bugün işe yaramaz

`city` profilde var (`profiles.city?: string`) ama:
- **serbest metin**, elle yazılıyor — geocode yok, liste yok
- **onboarding hiç sormuyor**; yalnızca `edit-profile`'da opsiyonel bir alan
- kodun kendi yorumu: *"`city` … no screen ever asked for it — the
  declaration was describing a field that was always empty."*

Yani bugün eklenirse Pro'ya, çoğunlukla boş bir alan üzerinde çalışan ve
"Istanbul" / "İstanbul" / "istanbul" eşleşmeyen bir filtre satılmış olur.
Filtreyi işler kılmak için aynı PR'da gerekenler:

1. **Normalleştirilmiş eşleşme.** Profile yazarken `cityKey` (küçük harf,
   aksan/noktalama sadeleştirilmiş, Türkçe `İ/ı` dahil) türetilip ayrı bir
   alanda saklanır; filtre onun üzerinden eşleşir. Ham `city` görüntüleme için
   kalır. Yeni indeks `db/indexes.ts`'e (elle indeks yasak).
2. **Şehir sorulur.** `edit-profile`'daki alan onboarding'e de eklenir, ya da
   en azından profil eksiklik uyarısına girer. Sorulmayan alan üzerinde filtre
   satılmaz.
3. Mevcut dokümanlar `city`'yi "Shown on profile … Optional" diye tarif ediyor
   (`docs/store/privacy-data-safety.md`); artık keşfette de kullanıldığı için
   o satır güncellenir — bu bir veri kullanım beyanı, üslup değil.

Coğrafi yakınlık zaten Pro+ `sort=nearby` olarak var (koordinat, ~1 km
yuvarlanmış). `city` onunla çakışmıyor: biri sıralama, diğeri filtre.

### Dokunulanlar

`packages/shared/src/discovery.ts` (`city` şeması + `DISCOVERY_PRO_FILTER_KEYS`),
`limits.ts` (`advancedFilters` doc-comment'i artık yanlış — "gender / country /
age / CEFR" yazıyor), `apps/api/src/modules/discovery/discovery.ts` (`city`
eşleşmesi), `modules/profiles/profiles.ts` (`cityKey` türetimi),
`db/indexes.ts`, `apps/mobile/src/lib/discoveryFilters.ts` (yerel `PRO_KEYS`
kopyası — **iki yerde yaşıyor, ikisi de güncellenir**), `app/(app)/filters.tsx`,
`app/(onboarding)/` (şehir sorusu), 8 katalog (şehir bölümü + paywall kopyası).

Paywall kopyası `advancedFiltersBody: 'Search by gender, country, age and
level.'` **artık yanlış olacak** — 8 dilde "cinsiyet ve şehir" olarak
düzeltilir. Aynı iddia `website/src/lib/data/plans.ts`
(`'Filters: gender, country, age, level'`), `features.ts`, ve
`langx/docs/architecture.md:276` tablosunda. Dördü de elle senkron.

### Testler

`apps/api/src/routes/discovery.test.ts`'in `describe('Pro filters')` bloğu
büyük ölçüde ters çevrilir: seviye/yaş/ülke artık **free bir hesap için 200
dönmeli**, cinsiyet/şehir hâlâ 403. Ayrıca bugün hiç olmayan iki test eklenir:
`DISCOVERY_PRO_FILTER_KEYS`'in içeriğini doğrudan doğrulayan bir shared testi,
ve `discoveryFilters.ts` için (`hasProFilters`/`withoutProFilters`) bir mobil
testi — ikisi de şu an test edilmemiş, ve bu iş tam olarak o listeyi
değiştiriyor.

---

## İş 6 — Rozetler: yeni eksenler ve gerçekten zor olanlar

### Bugün

9 rozet, 2 tür. `streak` rozetleri `TOKEN_RULES.streakMilestones`'ın
anahtarlarından **üretiliyor** (7/30/100/365), `correction` rozetleri
`CORRECTION_THRESHOLDS = [1, 10, 100, 1000, 5000]`'den.

### Önce: üç sessiz tuzak kapatılır

Yeni tür eklemeden önce, çünkü üçü de **derleme hatası vermeden yanlış
davranıyor**:

1. `apps/api/src/modules/tokens/badges.ts` → `progressOf(kind: string)`.
   `BadgeKind` değil `string`. Yeni bir tür eklenirse sessizce
   **düzeltme sayısı** dalına düşer. `Record<BadgeKind, number>` haline
   getirilir — eksik tür artık derlenmez.
2. `apps/mobile/src/i18n/labels.ts` → `badgeLabel` aynı şekilde: streak değilse
   düzeltme varsayıyor. Bir mesaj rozeti "50.000 düzeltme" yazar.
3. `BadgeGrid.tsx` ikon seçimi ve `leaderboard.tsx`'teki `toGo` kopyası da
   ikili `kind === 'streak'` dallanması. `BadgeDefinition`'a `icon` eklenir.

`badges.test.ts`'in tür döngüsü `['streak','correction'] as const` diye
sabitlenmiş — `BADGE_KINDS` üzerinden dönmeli, yoksa yeni türler test dışı
kalır.

### Genişleme

**Mevcut eksenler:**
- `streakMilestones`'a **180, 730 (2 yıl), 1095 (3 yıl)** eklenir
- `CORRECTION_THRESHOLDS`'a **10.000, 25.000** eklenir

**Yeni eksenler** (üçü de azalmayan — rozet geri alınamaz):

| Tür | Kaynak | Maliyet | Eşikler |
| --- | --- | --- | --- |
| `messages` | `profile.stats.messagesSent` | bedava, profil zaten okunuyor | 100 / 1.000 / 10.000 / 50.000 |
| `tokens` | `readAggregates(db, userId).all` | bir `_id` nokta araması | 10.000 / 50.000 / 250.000 |
| `veteran` | `profile.createdAt` (gün farkı) | bedava | 365 / 730 / 1.095 |

Toplam 9 → 24 rozet.

### 3 yıllık rozet: iki tane, kasten

- **`streak.1095`** — 1.095 gün kesintisiz. Gerçekten zor olan bu; v1'in en
  uzun serisi 446 gündü, yani bugün kimsenin sahip olmadığı ve yıllarca
  olmayacağı bir rozet.
- **`veteran.1095`** — 3 yıllık üyelik. Emek değil sadakat ölçüyor, ve
  ulaşılabilir olduğu için 1.095 günlük seriyi süs olmaktan çıkarıyor.

### ⚠️ `streakMilestones`'a değer eklemek ödeme de yaratır

Bunlar tek kayıttan besleniyor: `badges.ts` anahtarlardan rozeti üretiyor,
`streak.ts` → `streakMilestoneBonus(current)` ile **token ödemesini** yapıyor.
Yani 1095 eklemek hem rozet hem ödül demek — istenen bu, ama iki koşulla:

1. **Ödeme miktarları benzersiz olmalı.** `streakMilestoneDates` `earnedAt`'i
   miktardan geriye çözüyor (`amount → days`); iki kilometre taşı aynı miktarı
   öderse ikisi de erken olana yazılır. Kodun yorumu bunu söylüyor ama
   **hiçbir test korumuyor** — bu iş bir benzersizlik testi ekler.
2. Yeni ödemeler: 180 → 1.500, 730 → 12.000, 1.095 → 25.000. Merdiven
   mevcut 7/30/100/365 = 50/250/1.000/5.000 ile tutarlı ve hepsi farklı.

Not: `streakMilestoneBonus` yalnızca serinin **tam o değere** ilerlediği gün
danışılıyor. Onarılıp bir kilometre taşının üstüne atlayan kullanıcı rozeti
alır (`longest`'ten), ödemeyi ve `earnedAt`'i almaz. Mevcut davranış, bu iş
değiştirmiyor, ama not düşülüyor.

### Dokunulanlar

`packages/shared/src/badges.ts` (türler, eşikler, `icon`),
`token.ts` (`streakMilestones`), `apps/api/src/modules/tokens/badges.ts`
(`progressOf` → `Record`, yeni sayaçlar), `apps/mobile/src/i18n/labels.ts`,
`components/BadgeGrid.tsx`, `app/(app)/leaderboard.tsx`, 8 katalog
(yeni tür etiketleri ve çoğul biçimleri), `badges.test.ts`.

`docs/` (GitBook) `library/badges.md` ve `me.leaderboardSubtitle`
("Streaks and corrections") artık eksik — güncellenir.

---

## İş 7 — "Profilimi önizle"

### Sunucuda değişiklik yok

`GET /profiles/:handleOrId` kendine bakan istek için zaten doğru cevaplıyor:
`toPublicProfile` **viewer'dan bağımsız** saf bir izin listesi, ve
`recordProfileView` `if (viewer._id === viewedId) return 'self'` ile başlıyor —
yani önizleme kendi ziyaretçi listeni kirletmiyor.

Gizlilik bayrakları da dürüst yansıyor, çünkü hepsi **hedef** profile
uygulanıyor: `hideOnlineStatus` (nokta sönük görünür), `statsVisible`
(alanlar hiç gönderilmez), `activityMapVisible` (sayı değil yoğunluk bandı).

### İki dürüstlük boşluğu, not düşülür

- `settings.discoverable` **hiç yansımıyor** — keşifte görünmeyen bir profil
  handle ile hâlâ tam okunabiliyor. Kullanıcı "önizleme"yi "keşifte böyle
  görünüyorum" diye okursa yanıltıcı olur. Ekrana bir satır: bu, profil
  bağlantına tıklayanın gördüğü.
- Takipçi sayıları **senin** engellediklerini dışlıyor (`readFollowState`
  viewer bazlı filtreliyor), bir yabancınınki dışlamaz. Küçük sapma, düzeltmeye
  değmez, kayda geçer.

### İş: iki ungated şeyi kapatmak, sonra bir satır

`app/(app)/profile/[handle].tsx` `isSelf`'i hesaplıyor ama sadece **iki** şeyi
gizliyor: üç nokta menüsü ve Takip Et butonu. Şunlar kendi profilinde de
çiziliyor:

- **Mesaj yazma alanı** — `user.conversationId` self için `undefined` olduğundan
  görünüyor; gönder'e basmak `startConversation({ toUserId: <kendi id'in> })`
  çağırıyor.
- **Şikâyet et / Engelle** alt bloğu — üç nokta menüsündeki aynı iki eylem
  `isSelf` ile gizleniyor, alttaki blok gizlenmiyor. Yani bugün **kendini
  engelleyebiliyorsun.**

İkisi de mevcut hata; önizleme girişi eklenmeden düzeltilmeleri gerekiyor,
çünkü bu ekranı "başkasının profili" gibi okutan tam olarak onlar.

Sonra `me.tsx`'te diller satırının ardına bir `ListRow`:
`openProfile(profile.handle, '/(app)/me')` — `navigation.ts`'teki mevcut
yardımcı, `?from=` kodlamasını yapıyor ve geri okunu Keşfet yerine profile
döndürüyor. Yeni anahtarlar `me.*` grubuna, 8 dile.

`routeLiterals.test.ts`: `openProfile` zaten `ROUTE_CALLEES`'te, yeni bir
yardımcı eklenmiyor.

---

## İş 8 — Keşfet: hep online önce, ve kullanıcı adı araması

### 8a. "Online first" kalıcı hale gelir — ama üç sıralamanın hepsinde değil

`online` bugün bir filtre değil, `onlineBucket` adında hesaplanan 1/0 alanı ve
**birinci sıralama anahtarı** — yani her çevrimiçi profil her çevrimdışının
önünde. Üç sıralamada üç ayrı sonuç doğuruyor:

| Sıralama | Kalıcı yapılırsa | Karar |
| --- | --- | --- |
| `recommended` | İstenen davranış. Zaten çip açıkken skorun önüne geçiyor. | **Kalıcı yap** |
| `active` | `lastActiveAt` azalan zaten 5 dakikalık pencereyi tepeye koyuyor, yani **anlamsal olarak hiçbir şey değişmiyor**. Ama `active` keyset imleç kullanıyor (`$skip` değil); önüne `onlineBucket` koymak imleci geçersizleştirir — satırlar tekrarlanır veya atlanır. Üstelik indeksin verdiği sırayı bozup bloklayan bir bellek içi sıralama ekler. | **Dokunma** |
| `nearby` | 90 km'deki çevrimiçi biri, 1 km'deki çevrimdışının önüne geçer. `$geoNear`'ın en-yakın garantisi atılır ve mesafe ikincil olur. Bu, Pro+'ın satın alınan özelliğini bozar. | **Dokunma** |

Yani: `sort=recommended` için koşulsuz, diğer ikisi olduğu gibi. Bu "her zaman
online first sırala" isteğinin varsayılan sekmedeki karşılığı.

**Bedeli söylenmeli:** `onlineBucket` hesaplanan bir alan, **hiçbir zaman
indekslenemez**. Bugün bloklayan bellek içi sıralama yalnızca çipi açan
kullanıcı için ödeniyor; kalıcı olunca **her varsayılan keşfet isteği** ödüyor.
Kabul edilebilir ama bilinerek kabul edilmeli.

`privacy.hideOnlineStatus` açık olan kimse yükseltilmiyor (`$cond` içindeki
`$ne` şartı) — bu davranış aynen korunur, ve onu koruyan tek şey
`discovery.test.ts:275`'teki test.

**Kaldırılanlar:** `discover.tsx`'teki çip, `filters.tsx`'teki tüm
`filters.availability` bölümü, `online` alanı (`discovery.ts` şeması,
`discoveryFilters.ts`, `activeCount`, `withoutProFilters`), ve 8 dilde
`discover.onlineFirst` / `filters.onlineFirst` / `filters.availability`.
İmleç sabitleme (`encodeOnlineOffsetCursor`) **kalır** ve artık hep geçerlidir.

`discovery.test.ts:305`'teki *"And without the chip the score still wins, so
this is opt-in"* iddiası silinir — tam tersini yapıyoruz.

> **Yoldaki mevcut hata, aynı PR'da düzeltilir:** `discovery.ts:258` **her**
> imleci `decodeOnlineOffsetCursor`'dan geçiriyor, `sort=active`'in keyset
> imleci dahil. `active` imleci `<iso>|<userId>` biçiminde, yani `|` içeriyor
> ve sabitlenmiş-kesim dalına düşüyor; `lastActiveAt`'i bir saatten eski olan
> birinin ötesine sayfalamak **400 VALIDATION_FAILED** dönüyor. Mevcut test
> yakalamıyor çünkü fikstürlerin hepsi saniyeler önce aktif.

### 8b. Kullanıcı adından arama

Bugün **hiçbir arama uç noktası yok** — ne route, ne `$regex`, ne `$text`
sorgusu. `db/indexes.ts:71`'de `{ displayName: 'text', bio: 'text' }` diye
kullanılmayan bir metin indeksi duruyor ama `handle`'ı kapsamıyor (ve Mongo
koleksiyon başına tek metin indeksine izin veriyor).

Handle'lar `handleSchema` ile **küçük harfe zorlanarak** saklanıyor ve
`handle_unique` btree indeksi var — yani `^term` biçiminde **başa sabitlenmiş**
bir regex bu indeksi verimli kullanır. Serbest `$regex` değil, prefix.

Yeni: `GET /profiles/search?q=` + `useProfileSearch()`.

Uyması gereken kurallar, keşfetten farkıyla:
- `blockedUserIds` (**iki yönlü** — engellediklerim ve beni engelleyenler).
  `blocks.ts`'in yorumu bunun tek kaynak olduğunu söylüyor.
- Engellenen biri **404 değil, listede yok** — `profiles.ts:103`'ün gerekçesi:
  403 hesabın var olduğunu doğrular.
- `deletedAt` yok.
- `settings.discoverable: true` — arama bir gözatma, bağlantı çözümlemesi
  değil. (Not: `GET /profiles/:handle` bunu **kontrol etmiyor**; keşifte
  görünmeyen birine linkle hâlâ ulaşılıyor. Kasıtlı, bozulmuyor.)
- **Karşılıklı dil uyumu aranmaz.** Keşfet bunu şart koşuyor, arama koşmamalı —
  adını bilen birini bulmak dil eşleşmesine bağlı olamaz.

İstemci: hazır `SearchInput` bileşeni ve `useDebounce` kancası **yok**;
ikisi de ilk kez yazılır. `LanguagePicker.tsx:76-85`'teki arama satırı
(Feather `search` ikonu + dolgulu pill içinde `TextInput`) görsel kalıp,
`searchCountries`'in sıralama mantığı (tam eşleşme → önek → alt dize) davranış
kalıbı. `useInfiniteQuery` + `placeholderData: keepPreviousData` şart — yoksa
her tuş vuruşunda liste boşalır.

Yeri: filtre butonunun yanına bir arama ikonu, açılınca üstte arama satırı.

---

## İş 9 — Sohbetler: sabitlenmiş, arşivlenmiş, ve "sıra bende"

### Üç mimari gerçek, tasarımı bunlar belirliyor

**1. Konuşmada kişiye özel alt-doküman yok.** `participants: [string, string]`
düz bir id ikilisi. Kişiye özel tek alan `unread: Record<string, number>` —
userId ile anahtarlanmış bir **harita**, nokta yollarıyla güncelleniyor
(`unread.<uid>`). Kopyalanacak kalıp bu.

**2. `pinned` adı zaten dolu — ve paylaşımlı.** Konuşma dokümanındaki
`pinned: { messageId, byUserId, at }` **sabitlenmiş mesaj**, sabitlenmiş sohbet
değil, ve iki tarafa birden ait. `conversation:pinned` soket olayı da var.
Yeni alanlar `pinnedBy` / `archivedBy` diye adlandırılır.

**3. Konuşmalar ham gidiyor — görünüm katmanı yok.** `listConversations`
projeksiyonsuz, tam doküman döndürüyor; istemci bugün **karşı tarafın okunmamış
sayısını** da alıyor. Mesajlarda `toMessageView` var ve docblock'u kuralı
yazmış: *"per-user state lands on the same document … shipping either one raw
tells the other person things they have no business knowing."* Kişiye özel alan
eklemeden önce **`toConversationView(conversation, viewerId)` yazılmalı** —
yoksa "karşı taraf seni arşivledi" sızar.

### Alan biçimi: dizi değil, harita

`participants` zaten multikey; **Mongo iki multikey dizi alanını tek indekste
birleştiremez.** Yani `{ participants: 1, archivedBy: 1 }` reddedilir. Çözüm,
`unread`'in zaten kullandığı biçim:

```ts
archivedBy?: Record<string, true>   // nokta yolu `archivedBy.<uid>` skaler → indekslenebilir
pinnedBy?:   Record<string, true>
```

Yeni indeks (`db/indexes.ts`, elle indeks yasak; mevcut anahtarı yerinde
değiştirmek `IndexOptionsConflict` verir — **yeni adla** eklenir).

### Sıralama ve sayfalama

Sabitleme sıralamayı bileşik yapıyor (`pinned` sonra `lastMessage.createdAt`),
ama imleç `<tarih>|<id>` biçiminde ve bunu ifade edemiyor. Öneri: **sabitlenmiş
sohbetler ayrı, sayfalanmayan ve sayısı sınırlı bir sorguyla** çekilir
(en fazla ~20), geri kalanı bugünkü keyset imleciyle sayfalanır. İmleç
kodlamasını genişletmekten basit ve `dedupeById`'nin uyardığı tuzağa girmiyor.

`conversationCache.ts`'teki **`moveToHead` koşulsuz** — sabitlenmemiş bir
sohbete mesaj gelince sabitlenmişlerin üstüne fırlar. Sıralama-farkında hale
getirilir.

### Sekmeler

`feed.tsx`'in kalıbı birebir uygulanır: `useState` + `SegmentedControl` +
filtrenin sorgu anahtarına girmesi.

| Sekme | Sorgu |
| --- | --- |
| Tümü | `archivedBy.<uid>` yok |
| Sıra bende | + `lastMessage.senderId != <uid>` |
| Arşiv | `archivedBy.<uid>` var |

**"Sıra bende" ölçütü `lastMessage.senderId`**, `unread` değil. İkisi
ayrışabiliyor: mesajı okuyup cevaplamamış olabilirsin — ve o durumda sıra hâlâ
sende. Sunucu tarafı düz bir eşitlik filtresi, `participants_recent`
indeksinin taradığı küme zaten tek kullanıcıyla sınırlı olduğu için
indeks-sonrası filtre kabul edilebilir.

Sunucu tarafında filtreleme seçiliyor (istemci tarafı yalnızca yüklenmiş
sayfaları süzer, yani "sıra bende" listesi eksik çıkar). Bedeli:
`keys.conversations` bugün **düz bir sabit**, `keys.feed` gibi
parametrelenmemiş. Filtre anahtara girince `useSocket.ts` ve
`conversationCache.ts`'teki tüm `setQueryData(keys.conversations, …)`
çağrıları `setQueriesData({ queryKey: ['conversations'] }, …)` olur — dosyanın
`keys.messagesAround` için zaten belgelediği önek numarası.

### Eylemler: uzun basma, kaydırma sonra

`react-native-gesture-handler` **kurulu değil** (ve kasten: `RangeSlider` ve
`store.tsx` yorumları bunu yazıyor). Ama iki hazır kalıp var:

- **Uzun basma menüsü** — `messageMenu.ts` + `MessageMenuHost.tsx` +
  `messageActions.ts` tamamen genel; adları `message*` ama mesaja özgü tek şey
  props'ların tipi. Sabitle / Arşivle / Okunmadı yap menüsü bunun küçük bir
  genellemesi, ve uygulamanın kullanıcısına zaten öğrettiği hareket.
- **Kaydırma** — `swipeToReply.ts` saf matematiği `PanResponder` üzerinde
  çözmüş ve docblock'u aynen şöyle diyor: *"Rightwards only … leaves the other
  direction free for a later action."* Sola kaydırıp arşivleme için yazılı bir
  davet. İkinci aşama olarak yapılır; önce menü.

### Dokunulanlar

`apps/api/src/modules/chat/conversations.ts` (alanlar + yeni
`toConversationView`), `messages.ts` (`listConversations` filtre + projeksiyon),
`mutations.ts` (sabitle/arşivle), `routes/messages.ts`, `packages/shared/src/chat.ts`
(sorgu şeması + DTO), `db/indexes.ts`, `apps/mobile/app/(app)/chats.tsx`,
`src/lib/conversationCache.ts`, `src/hooks/useSocket.ts`, `src/api/queries.ts`,
8 katalog (sekme adları, eylem etiketleri, sekme başına boş durum).

---

## İş 10 — Profili paylaş: link + QR

### Önce: paylaşılacak bir sayfa yok

`app/(app)/profile/[handle].tsx` `_layout.tsx`'te
`<Stack.Protected guard={!!session}>` içinde, ve `GET /profiles/:handleOrId`
`preHandler: requireAuth`. Yani `https://app.langx.io/profile/sofia` linkini
açan **oturumsuz** biri giriş ekranını görüyor. Paylaşım özelliğinin asıl işi
budur: **herkese açık bir profil sayfası ve herkese açık bir okuma uç noktası.**

Ne gösterileceği ayrı bir gizlilik kararı: `toPublicProfile` bugün oturum açmış
bir kullanıcıya yaş, ülke, şehir, diller, seri ve fotoğrafları veriyor. Aynısını
kimliksiz internete vermek farklı bir şey. Öneri: kimliksiz görünümde ad,
handle, avatar, diller, seviye ve bir "Uygulamada aç" düğmesi; yaş/şehir/
fotoğraf galerisi oturum ister.

### Evrensel linkler beyan edilmiş ama çalışmıyor

`app.config.ts` iOS `associatedDomains` ve Android `autoVerify` intent
filtresini bildiriyor, `apple-app-site-association` ve `assetlinks.json`
depoda ve catch-all `"/": "/*"` ile **her yolu** uygulamaya yönlendiriyor,
`appLinks.test.ts` de bunları sabitlere karşı doğruluyor. Ama
`docs/release-runbook.md:150` açık madde olarak duruyor: **`app.langx.io` bu
dosyaları henüz servis etmiyor.** Yani link bugün tarayıcıda açılır,
uygulamada değil. Paylaşım özelliği bunu beklemez ama eksikliği bilinmeli.

Paylaşım URL'i üreticisi `packages/shared/src/appIdentity.ts`'e (`APP_LINK_HOST`
orada) — `externalLinks.ts` sabit bir tablo, kişiye özel URL üretmek için
yapılandırılmamış.

### QR: yerel modül eklemeden

`react-native-qrcode-svg` `react-native-svg` gerektiriyor; o da **native
modül** demek, yani yeni derleme ve OTA ile dağıtılamaz. `_layout.tsx`'teki
yorum zaten `react-native-svg`'yi ikonlar için reddetmiş.

**Öneri: QR'ı sunucuda üret.** `apps/api`'ye `qrcode` (saf JS), uç nokta bir
PNG/SVG döndürür, istemci **zaten kurulu** `expo-image` ile çizer. Native modül
yok, OTA güvenli, ve web'de de aynı kodla çalışır.

Paylaşma: React Native'in yerleşik `Share` API'si (bağımlılık gerektirmez),
"Linki kopyala" için **zaten kurulu** `expo-clipboard` (`chat/[id].tsx`
kullanıyor).

Bugün uygulamada hiç `share.*` veya `qr.*` i18n anahtarı yok; hepsi yeni,
8 dile.

---

## İş 11 — Web'de QR ile oturum açma

### İyi haber: Better Auth eklentisi diskte hazır

`better-auth@1.7.1` kurulu ve `dist/plugins/` altında **`device-authorization`**
(RFC 8628) ile **`one-time-token`** var. Şu an `plugins: [expo()]` — hiçbiri
etkin değil. `device-authorization` tam olarak bu akış: web bir cihaz kodu
ister → QR olarak gösterir → mobil onaylar → web `/device/token`'ı yoklar.

### Soket bu işi yapamaz, yoklama yapılır

`ws/index.ts`'teki `io.use` **oturumsuz her bağlantıyı reddediyor**, ve QR
ekranında bekleyen web istemcisi tanımı gereği oturumsuz. `CLAUDE.md`'nin
kuralı da net: *"The WebSocket must never become a back door around
authorisation."* Eklentinin kendi yoklama akışı kullanılır; soket katmanı
değişmez.

### Güvenlik: pazarlık edilemezler

1. **Tarama tek başına giriş yapmaz.** Mobil, QR'ı okuduktan sonra
   **açık bir onay ekranı** gösterir: hangi tarayıcı, hangi IP/ülke, ne zaman.
   Kullanıcı onaylamadan oturum açılmaz. Omuz üstünden veya ekran görüntüsünden
   okunan bir QR'a karşı tek gerçek savunma bu.
2. **Kısa ömür ve tek kullanım.** `translationCache`'in
   `{ expiresAt: 1 }, expireAfterSeconds: 0` TTL indeksi kopyalanacak kalıp;
   tek-kullanımlık talep için `handleReservations`'ın atomik
   `findOneAndUpdate` guard'ı (`claimedBy: { $exists: false }, expiresAt: { $gt: now }`)
   birebir aynı şekil. TTL ~2 dakika.
3. **Mobilin kendi oturum çerezi QR'a asla girmez.** QR yalnızca sunucunun
   ürettiği rastgele cihaz kodunu taşır.
4. **Kendi hız sınırı.** Global sınır 300/dk ve **bellek içi** (instance başına).
   Yoklama bu bütçeyi hızla tüketir; `routes/login.ts:25`'teki
   `config: { rateLimit: { max, timeWindow } }` kalıbıyla uç noktaya kendi
   sınırı verilir.

### İki gerçek maliyet

**1. Kamera = yeni yerel derleme.** `expo-camera` kurulu değil ve uygulamanın
bugün **hiç kamera izni yok** — `expo-image-picker` yalnızca `photosPermission`
ile yapılandırılmış, `launchCameraAsync` hiç çağrılmıyor. Yani: yeni native
modül, `app.config.ts`'e yeni izin metni, mağaza gizlilik formunda değişiklik,
ve yeni bir binary. **OTA ile gönderilemez.**

**2. Çapraz-site çerez, denenmemiş alan.** Web `app.langx.io`'da, API
`api2.langx.io`'da. Oturum çerezinin oraya ulaşması için
`SameSite=None; Secure` gerekiyor; `auth.ts`'te bugün **hiç `advanced`
bloğu yok** (`defaultCookieAttributes`, `crossSubDomainCookies` yapılandırılmamış)
ve `session` bloğu da yok — hepsi Better Auth varsayılanı. Bu, QR girişinden
bağımsız olarak **web oturumunun genel önkoşulu**; bugün çalışıp çalışmadığı
doğrulanmamış.

### Sıra

Bu iş ikiye bölünür: **(a)** çapraz-site çerezi yapılandır ve web'de normal
e-posta/şifre girişinin çalıştığını doğrula, **(b)** ondan sonra QR akışı.
(a) çalışmadan (b)'nin test edilmesi mümkün değil.

Yeni koleksiyon ve indeksler `db/collections.ts` ve `db/indexes.ts`'e — Better
Auth'un Mongo adaptörü neredeyse hiç indeks oluşturmuyor, dosyanın kendi yorumu
bunu söylüyor.

---

## İş 12 — `/kullaniciadi` profil linkleri, rezerve rotalar, min 4 karakter

10. iş profili paylaşılabilir yapıyor; bu iş linki kısa ve kök seviyeye
taşıyor: `https://app.langx.io/sofia`.

### 12a. Kök seviye rota her rota adını rezerve eder

`app/[username].tsx` kökte her yolu yakalar. Expo Router statik rotayı dinamik
olanın önünde tutuyor, yani `/discover` yine keşfet ekranına gider — ama bu
şu demek: **uygulamanın her rota adı örtük olarak rezerve bir kullanıcı adı.**
Bugün `discover` handle'ını alan biri yarın o ekrana erişilemez hale gelmez;
kendi profil linkine erişemez hale gelir.

Bu yüzden rezerve liste isteğe bağlı değil, yapısal. Ve elle tutulan bir liste
zamanla geride kalır — yeni bir ekran eklendiğinde kimse listeyi güncellemez.

**Öneri: liste dosya sisteminden türetilsin.** `routeLiterals.test.ts` zaten
`app/` ağacını gezip geçerli rota kümesini üreten bir `routePatterns()`
taşıyor. Aynı yürüyüş rezerve kelimelerin ilk kaynağı olur, ve bir test
"her rota adı `RESERVED_HANDLES` içinde" der — yeni ekran ekleyip listeyi
unutan kişiyi CI yakalar.

Üstüne elle eklenenler (rota olmayan ama bizim olması gerekenler):
`about`, `admin`, `api`, `app`, `blog`, `contact`, `docs`, `help`, `legal`,
`login`, `logout`, `press`, `privacy`, `root`, `security`, `signin`, `signup`,
`status`, `support`, `terms`, `token`, `www`, ve `.well-known`.

`.well-known` özellikle önemli: evrensel link dosyaları oradan servis ediliyor,
ve `apple-app-site-association` dosyası zaten `/.well-known/*`'ı dışlıyor.

### 12b. Uzunluk 3'te kalıyor — karar ve gerekçesi

Min 4 yapılmıyor. `HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/` olduğu gibi
kalıyor.

Gerekçe: dosyanın docblock'undaki sebep hâlâ canlı —

> *permissive enough to fit v1's existing handles (so legacy claims don't get
> rejected by a format check the old system never enforced this strictly)*

`handleSchema` **hem oluşturmada hem çözümlemede** kullanılıyor
(`GET /handles/:handle/availability` parametrelerini onunla doğruluyor). Min 4
yapmak üç şey getiriyordu: iki ayrı şema, üretimde 3 harfli handle var mı diye
bir sorgu, ve varsa o kullanıcılar hakkında bir karar. Karşılığında aldığı
fayda küçük.

Asıl korunmak istenen şey — kısa ve değerli kök yolların kapılması — zaten
**rezerve listenin işi**, uzunluğun değil. `api`, `www`, `app` üçü de 3
karakter ve rezerve listede; uzunluk kuralı bunların hiçbirini durdurmuyordu.
Efor oraya gidiyor.

Böylece bu işte handle şeması tek kalıyor, göç riski ve legacy kırılması yok.
Tek eklenen: oluşturma yolunda rezerve listeye karşı bir kontrol.

### 12c. Link hostu: şimdilik `app2.langx.io`

Repodaki tek sabit bugün `APP_LINK_HOST = 'app.langx.io'` ve `app2.langx.io`
repoda hiç geçmiyor — ama canlı web dağıtımı app2'de (Cloudflare Pages projesi
`langx-web`).

Karar: **linkler şimdilik `app2.langx.io` üretir.** Proje geliştirme
aşamasında; iş bitince gerçek adres `app.langx.io` olacak ve o zaman
güncellenecek.

Bunun tek bir uygulama koşulu var: **iki host da tek bir yerden okunmalı.**
`packages/shared/src/appIdentity.ts`'e ayrı bir sabit —
`WEB_HOST = 'app2.langx.io'` — ve paylaşım URL'i üreticisi onu okur.
`APP_LINK_HOST` **değiştirilmez**: o evrensel link beyanının hostu
(`associatedDomains`, `assetlinks.json`, `apple-app-site-association`,
`appLinks.test.ts`) ve v1'den taşınıyor. İkisini tek sabite indirmek, geçiş
günü universal link beyanını da kazara oynatmak demek.

Yani geçiş günü tek satır: `WEB_HOST` → `app.langx.io`. Ve o gün
`docs/release-runbook.md:152-190`'daki açık madde (`.well-known` dosyalarının
servis edilmesi) da kapanmış olmalı — o zamana kadar profil linkleri
tarayıcıda açılır, uygulamada değil.

### Dokunulanlar

`packages/shared/src/handle.ts` (yalnızca rezerve kontrolü; desen değişmiyor),
yeni `packages/shared/src/reservedHandles.ts`, `appIdentity.ts` (`WEB_HOST` +
URL üreticisi), `apps/api/src/modules/profiles/profiles.ts` (oluşturmada
rezerve kontrolü), `apps/mobile/app/[username].tsx`,
`src/lib/routeLiterals.test.ts` (rezerve türetimi), onboarding handle adımı,
8 katalog (rezerve handle hata metni).

---

## Bitmiş sayılma koşulu

Tek tek her iş için değil, **tüm iş bittiğinde**:

1. Her PR `origin/main`'e merge edilmiş (`langx/` rebase ile birleşiyor).
2. CI yeşil — typecheck, lint, format:check, testler.
3. **API `api2.langx.io`'ya dağıtılmış** — `flyctl deploy`, uygulama
   `langx-api`. Token `langx/.env` içindeki `FLY_API_TOKEN`, `flyctl`
   `/root/.fly/bin`'de.
4. **Web `app2.langx.io`'ya dağıtılmış** — `pnpm build:web` sonra
   `wrangler pages deploy dist --project-name langx-web`. **Push otomatik
   yayınlamıyor**, bu elle bir adım. Token `CLOUDFLARE_API_TOKEN`, aynı `.env`.
5. Yeni indeksler açılışta uygulanmış (`ensureIndexes`), ve varsa göç
   betikleri önce kuru çalıştırılıp sonra `--apply` ile koşulmuş.
6. Temizlik: birleşen dallar hem yerelde hem uzakta silinmiş, geçici
   worktree'ler `git worktree remove` ile kaldırılmış, `REPO_MAP.md`'nin
   listelediği elle senkron kopyalar (`docs/`, `website/`, `token-website/`)
   güncellenmiş.
7. Dağıtım sonrası tek canlı geçiş: app2 üzerinden giriş, cüzdan → token,
   bir satın alma, keşfet araması, sohbet sekmeleri.

> Not: app2 **üretim veritabanını** okuyor. Orada test etmek `langx`
> veritabanına yazmak demek; `dev` orada görünmez.

---

## Sıra ve doğrulama

Yedi ayrı dal, yedi ayrı PR, hepsi `origin/main`'den (yerel `main` peer'lerin
push'lanmamış commit'lerini taşıyor). `langx/` rebase ile birleşiyor. Peer'in
`tokens/pool-pays-at-0400` dalı indi (#988), yani hiçbiri artık engelli değil.

**Bu on bir iş tek oturumluk değil.** Aşağıdaki gruplar bağımsız; hangisinden
başlanacağı senin kararın.

**Küçük ve tek başına duran:**

| # | İş | Not |
| --- | --- | --- |
| 7 | Profilimi önizle | En küçük. Sunucu değişmiyor; iki mevcut hatayı kapatıyor (bugün kendini engelleyebiliyorsun) |
| 2 | Pro hoşgeldin paketi | Dosyaları tamamen ayrı (`billing/`) |
| 3 | Tek bildirim anahtarı | Ölü email sütununu kaldırıyor |

**Orta:**

| # | İş | Not |
| --- | --- | --- |
| 5 | Filtrelerin Pro çizgisi | `city`'yi işler kılmak bu PR'ın parçası, yoksa boş filtre satılır |
| 6 | Rozetler | Önce üç tür-tuzağı kapatılır, sonra genişleme |
| 8 | Keşfet: online-first + arama | Mevcut `sort=active` imleç hatasını da kapatıyor |

**Sıralı ikili:**

| # | İş | Neden bekliyor |
| --- | --- | --- |
| 1 | Cüzdan / token ayrımı | — |
| 4 | Kozmetikler | Takma seçicisi 1. işin ekranına oturuyor. Ayrıca **fiyat yükseltmeden önce üretimde eski fiyattan alım var mı sorgusu** |

**Büyük, kendi başına birer proje:**

| # | İş | Neden |
| --- | --- | --- |
| 9 | Sohbet: sabitle / arşivle / sıra bende | Önce `toConversationView` yazılmalı — bugün konuşmalar ham gidiyor ve karşı tarafın verisi sızıyor |
| 10 | Profili paylaş | Asıl iş QR değil: **herkese açık profil sayfası ve uç noktası bugün yok** |
| 12 | `/kullaniciadi` linkleri | 10'un üstüne gelir. Rezerve liste `routePatterns()`'ten türetilir; handle uzunluğu 3'te kalıyor |
| 11 | Web'de QR girişi | `expo-camera` = yeni yerel derleme, yeni kamera izni, mağaza gizlilik formu. Önce çapraz-site çerezin çalıştığı doğrulanmalı |

Tüm i18n katalogları 3, 4, 5, 6, 7, 8, 9, 10 ve 11'de birden değişiyor — aynı
anda iki dal açılırsa sekiz dosyada üç yönlü çakışma çıkar. Sırayla gidilir.

```bash
pnpm -r typecheck
pnpm lint && pnpm format:check
pnpm test                     # api + shared + mobile
```

Sonra tek canlı geçiş (`pnpm dev` → API :4000, Expo :8081, Playwright ile):

**Cüzdan:** profildeki üçüncü tile "Cüzdan ›" okur → `/(app)/wallet` → bakiye,
kazanılan·harcanan, iki tile, "Mağaza" başlığı, teklifler hâlâ satın alınıyor
(bir tane al: bakiye ve satır güncelleniyor mu). Bakiyeye dokun →
`/(app)/tokens` → toplamlar, havuz kartı (`lastPayout` ya da "ilk payın …"),
geçmiş listesi, 30 günden sonra `fetchNextPage`. Geri oku tokens → wallet → me
gitmeli, **Chats'e değil** (`backHref.ts`'in anlattığı `router.back()` hatası).
İki ekranda da tab bar görünmemeli. `ar` ve `tr`'ye geçip ham anahtar var mı
bak. `refId`'si `day`'inden bir gün geride bir `dailyPool` satırı ekle ve
ödüllendirdiği günün altında çıktığını doğrula (`earnedDayOf` — yanlış
görünmeye en yatkın şey).

**Pro paketi:** `fakeRevenueCat` ile free→pro geç, kozmetik ve freeze geldi mi;
`POST /billing/refresh`'i iki kez çağır, ikinci kez vermemeli; pro→pro_plus'ta
sadece fark gelmeli.

**Bildirimler:** ayarlarda tür başına tek anahtar, kapatınca `fanOut` push
göndermiyor; matris şeklindeki eski bir profil dokümanı ile açıp `.push`
değerinin okunduğunu doğrula.

**Kozmetikler:** bir çerçeve al → Cüzdan'da tak → kendi profilinde, başkasının
gözünden profilinde ve liderlik tablosunda halkayı gör. Avatar 36px'te halka
çevrimiçi noktasını kaydırmamalı. Kilitli `frame.aurora` satırı ilerlemeyi
yazmalı ve bakiye 50.000'i geçse bile alınamamalı; API'yi doğrudan çağırıp
`403` aldığını doğrula.

**Filtreler:** free hesapla seviye/yaş/ülke filtrele → 200 dönmeli; cinsiyet
ve şehirde paywall. Şehri "İstanbul" yazan bir profili "istanbul" ile bul.

**Rozetler:** yeni türlerin hepsi doğru etiketle çiziliyor mu (ham
`badges.foo` yok), ve `next` kartının ödül satırı doğru mu.

**Önizleme:** kendi profiline gir — mesaj kutusu ve şikâyet/engelle bloğu
görünmemeli, geri oku profile dönmeli, ziyaretçi listene kendin eklenmemeli.

## Kritik dosyalar

- `apps/mobile/app/(app)/store.tsx` → `wallet.tsx`, yeni `tokens.tsx`
- `apps/mobile/app/(app)/_layout.tsx`, `me.tsx`, `filters.tsx`,
  `profile/[handle].tsx`, `leaderboard.tsx`
- `apps/mobile/src/i18n/messages/en.ts` (+ 7 kardeş) — beş işte birden değişiyor
- `apps/mobile/src/components/ui/Avatar.tsx`, `components/BadgeGrid.tsx`
- `packages/shared/src/cosmetics.ts`, `badges.ts`, `discovery.ts`,
  `notifications.ts`, `token.ts`, `limits.ts`
- `apps/api/src/modules/tokens/{wallet,badges}.ts`,
  `modules/discovery/discovery.ts`, `modules/billing/refresh.ts`,
  `modules/profiles/profiles.ts`
- `docs/token-messaging-brief.md`, `docs/decisions.md`,
  `docs/architecture.md`, `docs/legal/promise-change.md`

## Kardeş repo'lara taşan iddialar (ayrı iş, elle senkron)

`REPO_MAP.md`'nin uyardığı bağlar — hiçbiri otomatik kontrol edilmiyor:

| Değişen | Kopyası |
| --- | --- |
| Kozmetik fiyatları | `docs/token/utility.md`, `website/src/lib/data/token.ts` |
| Pro filtre listesi | `website/src/lib/data/plans.ts` + `features.ts`, `docs/architecture.md:276` |
| "no wallet" iddiası | `docs/` 12 dosya, `token-website/index.html` + `tools/og-source.html` |
| Rozet listesi | `docs/library/badges.md` |
