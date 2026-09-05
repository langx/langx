# Misafir oturumu yeniden açılışta donduruyor — düzeltme planı

## Context

Behic app2.langx.io'da uygulamayı açtı, **Look around**'a bastı (anonim /
misafir oturum açıldı), hiçbir dil seçmeden sekmeyi kapattı. Tekrar açtığında
uygulama **sonsuz bir spinner**'da kaldı — ileri gidecek hiçbir yol yok.

Kök sebep, misafir oturumunun yeniden açılışta hayatta kalması. `app/_layout.tsx`
içinde iki `Stack.Protected` dalı var ve **yalnızca misafirde ikisi de aynı anda
açık**:

```tsx
<Stack.Protected guard={!!session}>      // index, (onboarding), (app)
<Stack.Protected guard={!session || isGuest}>  // (auth)
```

Bu durumda `/` iki ekrana birden çözülüyor — `app/index.tsx` ve
`app/(auth)/index.tsx` — ve ikisi de kendi `<Redirect>`'ini veriyor
(`/(onboarding)/languages` vs `/(auth)/welcome`). Üstüne
`useGuestBrowse`'ın efekti, oturum zaten misafirse **her mount'ta** yeniden
`router.replace('/(onboarding)/languages')` çağırıyor. `app/(auth)/intro.tsx`'in
başındaki yorum ("`Stack.Protected` never has both groups mounted at once")
misafir özelliğinden beri yanlış.

Sunucu tarafında da bir boşluk var: `purgeStaleGuests` yalnızca
`profiles.guest === true` satırlarını topluyor. Dil seçmeden bırakan bir misafirin
**hiç profil satırı yok**, dolayısıyla Better Auth `user`/`session`/`account`
satırları kalıcı olarak DB'de kalıyor.

**Hedef:** misafir oturumu bir yeniden açılışı atlatmasın. Soğuk açılışta misafir
oturumu bulunursa sunucuda silinsin, istemcide çıkış yapılsın, kullanıcı temiz bir
karşılama ekranında başlasın. Bu, hem donmanın yaşandığı durumu ortadan kaldırıyor
hem de terk edilmiş misafir kayıtlarının birikmesini durduruyor.

## Kararlar (Behic)

- Silme kapsamı: **çıkış + misafir kaydını sil** (session/account/user, varsa
  guest profile).
- Eşik: **onboarding'i bitirmemiş her misafir**. Bir misafir zaten hiçbir zaman
  gerçek onboarding'i bitiremez (`POST /profiles` `requireVerifiedEmail` arkasında),
  yani pratikte kural şu: **misafir oturumu soğuk açılışı atlatmaz.**
  Bedeli: dilleri seçip discover'da gezen bir misafir de sayfayı yenilediğinde
  karşılama ekranına düşer. Taslak (`onboardingDraft`) cihazda durduğu için
  diller/seviyeler kaybolmuyor — iki dokunuşla geri dönüyor.

## Yapılacaklar

### 1. Sunucu — misafiri silen tek bir yardımcı + uç nokta

`apps/api/src/modules/profiles/purgeGuests.ts`

- Tek bir misafiri silen `deleteGuest(db, userId)` fonksiyonunu çıkar: guest
  profil satırı (varsa) + `session` / `account` / `user` — üçü de `authId(userId)`
  üzerinden (iki id dünyası kuralı; `apps/api/src/lib/authId.ts`).
- `purgeStaleGuests` bunu kullansın, böylece silme listesi tek yerde kalır.
  `terms` alanı `user` dokümanının üstünde (`modules/account/terms.ts`), ayrıca
  temizlik gerekmiyor.

`apps/api/src/routes/profiles.ts` (misafir uçları zaten burada, `POST /profiles/guest`
yanına)

- `DELETE /profiles/guest` — `preHandler: requireAuth`. `request.isGuest` değilse
  `POST /profiles/guest`'in aynadaki davranışı gibi reddet
  (`ApiError(ERROR_CODES.VALIDATION_FAILED, 'Not a guest session')`). Aksi halde
  `deleteGuest` çağır, `204` dön.
- `requireMember`/`requireVerifiedEmail` **kullanma** — bu uç tam olarak misafir
  içindir.

### 1b. Var olan süpürgenin göremediği misafirler

Yeni bir zamanlanmış iş **değil** — çalışan `purgeStaleGuests`'in sorgusundaki
boşluk. Sorgu `profiles.guest === true` üzerinden yürüyor; dil seçmeden bırakan
misafirin hiç profil satırı yok, yani Better Auth `user`/`session`/`account`
satırları hiçbir zaman toplanmıyor. Bugün DB'de duran terk edilmiş kayıtlar da
bunlar.

- `purgeStaleGuests`'e ikinci bir geçiş ekle: `user` koleksiyonunda
  `isAnonymous: true` ve `createdAt <= cutoff` olan, `profiles`'ta karşılığı
  bulunmayan satırlar için `deleteGuest`.
- Aynı `GUEST_TTL_MS` (`packages/shared/src/profile.ts:112`) ve aynı saatlik
  tetikleyici (`apps/api/src/modules/account/purgeScheduler.ts`).
- `user` koleksiyonu Better Auth'un — **asla indeks ekleme** (boot'ta
  `IndexOptionsConflict` API'yi crash-loop'a sokar). Saatte bir çalışan bir
  tarama için indekssiz sorgu kabul edilebilir.

### 2. İstemci — soğuk açılışta misafir oturumunu bitir

Yeni: `apps/mobile/src/hooks/useGuestSessionReset.ts`

- Oturum ilk kez çözüldüğü anı yakalayan bir latch. `authClient.useSession()`
  ilk kez `isPending === false` olduğunda, `shouldGateGuest(session?.user)`
  doğruysa: `api.delete('/profiles/guest')` → `authClient.signOut()`.
- **Sadece açılışta.** Latch, bu launch içinde "Look around" ile *yeni açılan*
  misafir oturumunu silmemeli — ayırt edici olan, oturumun boot'taki ilk
  çözümde zaten var olması.
- Sıra önemli: **önce sil, sonra çıkış yap.** Ters sırada çıkıştan sonra oturum
  çerezi geçersiz olur ve silme ucu `401` alır. Silme sonrası `signOut()` sunucuda
  hata verebilir (oturum satırı çoktan gitti) — hatası yutulur, çünkü tek işi
  cihazdaki çerezi düşürmek; düşmese bile silinmiş bir kullanıcıya ait çerezle
  `getSession` `null` döner, yani sonuç aynı.
- Sunucu çağrısı başarısız olursa yine de `signOut()` yap: amaç kullanıcıyı
  kilitli durumdan çıkarmak; artakalan satırı (1b) toplar.
- `resetting` bayrağı döndür.

`apps/mobile/app/_layout.tsx`

- `RootShell` içinde çağır ve `showSpinner`'a `|| resetting` ekle — böylece
  silme sürerken onboarding ekranı bir an görünüp kaybolmaz.
- `signOut()` sonrası `session` null olur, sadece `(auth)` dalı kalır, `/` tek
  bir ekrana (`(auth)/index`) çözülür ve karşılama ekranı açılır. Belirsiz `/`
  ve `/intro` eşleşmesi böylece açılışta hiç oluşmaz.

### 3. `useGuestBrowse`'ın mandalsız efektini düzelt

`apps/mobile/src/hooks/useGuestBrowse.ts:68-70`

- Efekt şu an "oturum misafirse yönlendir" diyor; olması gereken "bu hook'un
  *başlattığı* oturum geldiyse yönlendir". Bir ref ile `start()` çağrılmadan
  yönlendirme yapılmasın.
- Bu, canlı bir misafirin `(auth)/sign-in`'e girememesini düzeltir:
  `app/(auth)/sign-in.tsx:19` hook'u mount ediyor ve ekran açılır açılmaz
  `/(onboarding)/languages`'e fırlatıyor — misafir kendi hesabına giriş yapamıyor.

### 4. Açılış spinner'ına kaçış kapısı (savunma)

`apps/mobile/app/_layout.tsx:140-156`

- `showSpinner` dalının hiçbir zaman aşımı ve hiçbir çıkışı yok; `get-session`
  fetch'i asılı kalırsa (timeout yok: `src/api/apiFetch.ts`, `src/api/client.ts`)
  ekran sonsuza kadar spinner'da kalır.
- Birkaç saniye sonra "Tekrar dene" gösteren bir dal ekle. Metin
  `src/i18n/messages/en.ts` içine anahtar olarak girer ve sekiz dile çevrilir
  (`common.tryAgain` zaten var — yeniden kullan).

### 5. `(auth)/intro.tsx` yorumunu düzelt

`apps/mobile/app/(auth)/intro.tsx:9-10` "iki grup asla birlikte mount olmaz"
diyor; misafirde oluyordu. Yorumu bu planın getirdiği yeni değişmezle güncelle:
*misafir oturumu açılışı atlatmaz, dolayısıyla açılışta iki dal birlikte mount
olmaz.*

## Testler

- `apps/api/src/routes/guest.test.ts` — `DELETE /profiles/guest`: (a) misafir
  oturumu siler ve aynı çerezle sonraki istek `401` verir; (b) profili olan
  misafirde `profiles` satırı da gider; (c) gerçek üye çağırınca reddedilir.
- `apps/api/src/modules/profiles/purgeGuests` testleri `deleteGuest`'e geçtikten
  sonra da yeşil kalmalı.
- `apps/mobile/src/hooks/useGuestSessionReset.test.ts` — saf latch mantığını
  `guestGate.ts` / `sessionSwitch.ts` kalıbında ayrı bir saf fonksiyona çıkar
  (`shouldEndGuestSession(firstResolvedIsGuest, …)`) ve onu test et; `vitest`
  `src/lib/**` altında `expo-router` import eden dosyaları parse edemiyor
  (bkz. `guestGate.ts` başlığı).
- `useGuestBrowse` mandalı için aynı yaklaşım: kararı saf bir fonksiyona ayır.

## Doğrulama

1. `pnpm -r typecheck && pnpm lint && pnpm test`
2. Yerel yığın: `pnpm dev` (API :4000, Expo :8081). MongoDB **replica set**
   olmalı.
3. Playwright ile Expo web (:8081) üzerinde asıl senaryo:
   - `/` → intro → welcome → **Look around** → dil ekranı geldi mi?
   - Sayfayı yenile (soğuk açılış): karşılama ekranı gelmeli, spinner'da
     kalmamalı.
   - DB'de misafirin `user`/`session`/`account` satırlarının gittiğini
     `mongosh` ile doğrula.
   - Dilleri seçip misafir olarak discover'a geç, yenile: yine karşılama
     ekranı, taslak korunmuş olarak `Look around` → diller önceden seçili.
   - Misafirken `Sign in` ekranına git: artık dil ekranına fırlatmamalı.
4. Son olarak tek bir canlı geçiş: api2 + app2 elle deploy edildikten sonra
   app2.langx.io'da aynı akışı bir kez yürüt.

> Not: app2 **production** DB'ye bakıyor. Canlı doğrulama gerçek `langx`
> veritabanında misafir satırı oluşturur ve siler.
