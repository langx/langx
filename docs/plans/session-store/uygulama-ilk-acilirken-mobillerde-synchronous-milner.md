# Açılış logosu, kamera, Chats başlığı, yükleme balonu, foto görüntüleyici

Beş bağımsız iş, beş ayrı branch/PR.

| # | İş | Boyut | Not |
| --- | --- | --- | --- |
| 3 | Chats başlığı + swipe katmanı | Küçük | Gerçek kullanıcı bug'ı, iki satırlık düzeltme — **önce bu** |
| 5 | Tam ekran + zoom foto görüntüleyici | Orta | Zoom matematiği yeni, gerisi mevcut modal'ın taşınması |
| 4 | Yüklenirken bekleyen balon + yüzde | Orta-büyük | XHR primitive'i + pending store |
| 2 | Galeri/kamera seçimi | Küçük-orta | Native build gerektirmiyor |
| 1 | Animasyonlu açılış logosu | Orta | Yeni asset üretimi + native build gerektiriyor |
| 8 | "Say it for them" → "Record" | Minik | Tek anahtarın değeri, sekiz katalog |
| 9 | Tip çeşitliliği ve rotasyon | Orta | Altyapı zaten var, kullanılmıyor |
| 7 | Chats satır aksiyonları (çekmece + Delete) | Büyük | Jest modeli tersine döner + sıfırdan sohbet silme API'si |
| 6 | Şehri sorma, türet + profilde göster | Büyük | shared + API + mobil + veri betiği + mağaza beyanı |

Çakışma uyarıları:

- **İş 4, 5 ve 9 üçü de `chat/[id].tsx`'e dokunuyor** (4 ve 5 ayrıca
  `MessageBubble.tsx`'e). Sırayla git, her birini rebase'le.
- **İş 7, İş 3'ün üstüne kuruluyor** — İş 3 `SwipeableRow`'un zemin bug'ını tek
  satırda kapatıyor, İş 7 aynı dosyayı baştan yazıyor. İş 3 önce merge edilmeli;
  görünür bir bug'ı büyük bir rework'ün arkasında bekletme.
- **İş 1 ve İş 2** ikisi de `app.config.ts`'in `plugins` dizisini değiştiriyor.
- İş 6 tek başına duruyor ama en geniş yüzey o.

**İş 6 başlamadan çözülmesi gereken tek şey:** kanonik şehir listesinin lisansı
ve atfı (aşağıda). Gerisi kod.

## Context

**1. Açılış ekranı.** `apps/mobile/app.config.ts` hiç `splash` tanımlamıyor ve
`expo-splash-screen` (`~57.0.8`) bağımlılık olarak duruyor ama kodda hiç
kullanılmıyor — native splash Expo'nun stok beyazı ve JS mount olur olmaz
kayboluyor. Arkasından üç ayrı, birbirinin kopyası `<ActivityIndicator>` tam
ekranı geliyor: `app/_layout.tsx:146-156` (oturum + font), `app/index.tsx:38-50`
(`/profiles/me` + onboarding draft), `app/(auth)/index.tsx:32-45` (`introSeen`).
Yani soğuk açılış = boş ekran → spinner → spinner → asıl ekran. `docs/release-runbook.md:296`
bu eksiği zaten kayda geçirmiş. Hedef: açılışta markalı, animasyonlu logo; uygulama
gerçekten hazır olunca tek seferde çıksın.

**2. Fotoğraf seçimi.** Beş giriş noktasının beşi de sadece galeriyi açıyor
(`launchImageLibraryAsync`); `launchCameraAsync` repoda hiç kullanılmıyor —
sohbet ve feed composer'ındaki `Feather name="camera"` ikonu bile galeri açıyor.
Hedef: her fotoğraf seçiminde "Kamera / Galeri" tercihi.

**3. Chats başlığı.** Behic gerçek bir iPhone'da açtı: Chats sekmesinde arama
büyüteci başlığın ortasında asılı kalmış. Aynı ekran görüntüsünde ikinci bir bug
daha var — her sohbet satırında swipe'ın "Archive" ikonu kalıcı olarak görünüyor
ve zaman damgası ("11h", "2d") üstüne biniyor. İkisi de masaüstü tarayıcıda
görünmüyor, yani droplet'teki web dev döngüsü bunları yapısal olarak kaçırıyor.

**4. Medya gönderirken sessizlik.** `sendMedia` (`chat/[id].tsx:207-235`) yükleme
bitene kadar thread'de hiçbir şey göstermiyor — `sendingMedia` sadece iki butonu
kilitliyor. Hata olursa bir alert çıkıyor ve seçilen dosya kayboluyor. Metin
mesajlarında var olan "gönderilemedi, dokun ve tekrar dene" hattının medyada
karşılığı yok.

**6. Elle yazılan şehir.** Kullanıcıya iki yerde "şehir (opsiyonel)" soruluyor,
ama uygulama zaten izinle GPS konumu, izinsizken IP'den ülke çekiyor — elle
yazılan bir şehir buna hiçbir şey eklemiyor. Üstelik saklanıyor, filtreleniyor,
**hiçbir ekranda gösterilmiyor**. Karar: sorma, koordinattan türet, profilde
göster ama kapatılabilsin.

**7. Chats satır jesti yarım.** Çekince aksiyon doğrudan çalışıyor; kullanıcı
WhatsApp'taki gibi butonların açılıp seçilmesini istiyor. Ayrıca sohbet silme
uygulamada **hiç yok** — ne endpoint, ne şema, ne menü maddesi.

**8. "Say it for them"** kayıt butonunun etiketi olarak dolaylı kalıyor;
"Record" isteniyor. Aynı butonun diğer hâli zaten "Record again".

**9. Tek tip.** Sohbet her açıldığında aynı sarı ipucu çıkıyor. Sebebi:
tip altyapısı tam ama uygulamada **tek bir `<Tip/>`** mount edilmiş; üç tip id'si
tanımlı ve sekiz dile çevrili olduğu hâlde hiçbir yerde çizilmiyor.

**5. Fotoğraflar tepkisiz.** Uygulamadaki tek çalışan görsel açma yolu profil
foto şeridi; onda da zoom yok. Sohbet, feed ve post detayındaki görsellere
dokunmak hiçbir şey yapmıyor.

**Kamera için iyi haber:** yeni build gerekmiyor. Android'de `CAMERA` izni
expo-image-picker'ın kendi `AndroidManifest.xml`'inden merge ediliyor, iOS'ta
`NSCameraUsageDescription` plugin'in varsayılan metniyle ("Allow LangX to access
your camera") zaten yazılmış durumda (`@expo/config-plugins/build/ios/Permissions.js`
→ `applyPermissions`, prop tanımsızsa default'u yazıyor). Yeni build yalnızca izin
metnini markalaştırmak için gerekli. Splash ise native değişiklik, o build ister.

---

# İş 1 — Animasyonlu açılış logosu

Branch: `splash-animation` (origin/main'den).

## Karar özeti

| Konu | Karar |
| --- | --- |
| Animasyon | Mevcut PNG + RN `Animated` (`useNativeDriver`). Yeni bağımlılık yok. |
| Ev usulü | `src/components/ui/Skeleton.tsx:7-15` yorumu bağlayıcı: Reanimated'a gidilmeyecek (web bundle'a worklets girmesin). |
| Ne zaman kaybolur | İlk **gerçek** ekran hazır olduğunda — üç spinner'ın üçü de kalkıyor. |
| Platform | Native + web, aynı kod. `expo-splash-screen`'in web build'i zaten no-op, `Platform.OS` dallanması gerekmiyor. |
| Native splash | Evet, `app.config.ts`'e plugin bloğu + `preventAutoHideAsync`/`hideAsync`. |

## Mimari

`AppSplash`, `RootShell` içinde `QueryClientProvider`'ın **son çocuğu** olarak,
`showSpinner` üçlüsünün **dışında** render edilir. Böylece:

- İlk render'da mount olur (font/oturum beklemeden) → native splash'tan devralacak
  bir katman zaten ekranda.
- `<Stack>`'in üstünde durduğu için stage-2 yönlendirme zinciri (`index` →
  `(onboarding)` / `(app)/discover`, ya da `(auth)/index` → landing) altında akar,
  animasyon yeniden başlamaz.
- `ThemeProvider`'ın altında olduğu için `useTheme()` çağırabilir — `RootShell`'in
  var oluş sebebi bu (`app/_layout.tsx:59-63`).

**Hazır sinyali tek yönlü bir latch:** `src/lib/appReady.ts` içinde
`let ready = false`, `markAppReady()` idempotent. Context değil modül-store,
çünkü (a) `toast.ts` / `useOnboardingDraft.ts` aynı deseni kullanıyor, (b) vitest
sadece `src/lib/**` ve `src/i18n/**`'e erişebiliyor, (c) timeout ve `AppGate`
hook istemiyor.

Tek yönlü olması kritik: `useSession()` her sign-in/sign-out'ta yeniden `isPending`
oluyor (`app/_layout.tsx:123-129`'daki uzun yorum bunu anlatıyor). Latch tek yönlü
olduğu için splash bir daha asla üste gelmez. `app/_layout.tsx:130-140` arası
**hiç değişmiyor**.

Sinyal üç katman:

1. **Açık sinyal** — `useSignalAppReady(when)` hook'u, üç yerde, her biri zaten
   doğru koşulu tutuyor:
   - `app/index.tsx` → `!isPending && draftReady`
   - `app/(auth)/index.tsx` → `seen !== null`
   - `src/components/AppGate.tsx` → `Boolean(data?.maintenance.enabled || data?.updateRequired)`
     (bakım/zorunlu güncelleme ekranı hiçbir route mount etmez; bu olmadan splash
     timeout'a kadar durur)
2. **Route fallback** — `usePathname() !== '/'` ise hazır say. Expo Router grup
   segmentlerini kırptığı için iki gate de `/`; başka her şey (deep link, bildirim
   yönlendirmesi, restore edilen route) zaten gerçek ekran demek.
3. **Sert timeout** — 5000 ms. Hiçbir sinyal gelmezse splash yine de çıkar.

Sinyaller **effect içinden** verilir, render sırasında değil — `markAppReady()`
abonelere haber veriyor, render sırasında çağrılırsa "another component's render"
uyarısı alınır.

## Yeni dosyalar

```
apps/mobile/src/lib/appReady.ts          # latch + subscribe (saf, react-native yok)
apps/mobile/src/lib/appReady.test.ts
apps/mobile/src/lib/splashTiming.ts      # saf zamanlama matematiği + sabitler
apps/mobile/src/lib/splashTiming.test.ts
apps/mobile/src/hooks/useAppReady.ts     # useAppReady() + useSignalAppReady(when)
apps/mobile/src/hooks/useReduceMotion.ts # AccessibilityInfo — repoda ilk kullanım
apps/mobile/src/components/AppSplash.tsx # overlay + SplashFill
apps/mobile/assets/splash/badge.png      # yeni türetilmiş asset
apps/mobile/assets/splash/badge-dark.png
```

`useAppReady()` `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`
kullanır — üçüncü argüman şart, çünkü web build'i `output: 'static'` ve prerender
sırasında çalışıyor.

## Animasyon

Native splash zaten logoyu gösteriyor, dolayısıyla JS katmanı **opacity 1 ile
başlar** — fade-in olsaydı logo bir kez sönüp geri gelirdi. Giriş sadece ölçek
oturması.

- **Giriş:** `Animated.spring` scale `0.96 → 1` (`speed: 14, bounciness: 4`).
- **Bekleme:** `Animated.loop(Animated.sequence([...]))`, `Skeleton.tsx:31-39` ile
  aynı şekil ama daha yavaş — 900 ms yarım periyot, scale `1 ↔ 1.045` ve opacity
  `1 ↔ 0.9`, `Easing.inOut(Easing.quad)`. "Nefes alan" logo.
- **Çıkış:** loop durur, `pulse` 180 ms'de 0'a **oturtulur** (`setValue` görünür
  sıçrama yapar), eşzamanlı olarak tile 320 ms'de `scale 1.1` + `opacity 0`, zemin
  60 ms gecikmeyle 320 ms'de solar. Bittiğinde `setVisible(false)` → unmount.
- **Minimum görünürlük 700 ms:** sıcak açılışta logonun 80 ms yanıp sönmesini
  engeller. `msUntilExitAllowed(mountedAt, now)` bu bekleyişi hesaplar (saf
  fonksiyon, test edilebilir; negatif dönmez, saat sıçramasında 0).
- **Reduce motion:** `useReduceMotion()` true ise giriş ve loop atlanır, çıkış
  sadece fade olur. react-native-web bunu `prefers-reduced-motion`'a bağlıyor;
  `matchMedia` yoksa `true` çözülüyor — güvenli yön.

Transform, `Animated.Image` yerine sarmalayıcı `Animated.View`'da (`Button.tsx`
ile aynı idiom). Görsel `react-native`'in `Image`'ı, `expo-image` değil —
`expo-image` disk cache için kullanılıyor (`MediaBubble.tsx:127`), bundle'lanmış
asset'in cache'lenecek bir şeyi yok ve boot yolunda bir parça daha az.

## `SplashFill` — üç spinner'ın yerine

Aynı dosyadan export edilir: tema zeminli boş bir `View`, ve **sadece splash
gerçekten gittiyse** `<ActivityIndicator/>` gösterir (`useAppReady()` okur). Yani
normalde altında hiçbir şey yok; spinner yalnızca timeout devreye girip splash
kalktığında — yani gerçekten bir şey yavaşken — görünür. O tek durumda bugünkü
davranış aynen korunur.

## `app.config.ts`

`plugins` dizisine, `expo-router`'dan sonra:

```ts
[
  'expo-splash-screen',
  {
    image: './assets/splash/badge.png',
    imageWidth: 160,          // AppSplash.tsx'teki TILE_SIZE ile aynı sayı
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
    dark: { image: './assets/splash/badge-dark.png', backgroundColor: '#1c1f24' },
  },
],
```

Renkler `src/lib/theme/tokens.ts`'teki `colors.bg` değerleri elle yazılmış —
`app.config.ts` Node altında değerlendiriliyor ve paleti import edemiyor. Bunu
ve `imageWidth`/`TILE_SIZE` ikizliğini yorum olarak yaz; ikisi de sessizce
bozulabilecek türden.

## Asset

Elde sadece 1024×1024 uygulama ikonu var (`assets/icons/default.png` — `branding/app-resources/icon-only.png`
ile byte-identical; `dark.png`'in branding'de karşılığı yok). Doğrudan kullanılamaz,
iki somut kusuru var:

1. Android 12+ splash API ikonu **daireye maskeler** → tam kare sarı ikon sarı bir
   diske dönüşür (marka işareti merkezdeki ~%55'te, kırpılmaz ama şekil değişir).
2. iOS storyboard maskesiz çizer → iOS'ta keskin kare, Android'de daire, JS
   katmanında yuvarlak kare. Devir teslim anında şekil değişiyor.

**Yapılacak:** her şema için 512×512 RGBA, ~%86 oranında **daire** içine oturtulmuş
bir rozet üret (`badge.png`, `badge-dark.png`), `AppSplash` de `borderRadius: TILE_SIZE / 2`
kullansın. Android'in zorunlu daire maskesi no-op olur, üç yüzey de aynı şekli
gösterir. 1024 yerine 512: bu PNG'ler ilk kez JS bundle'ına girecek (bugün sadece
native binary'de), 1024 çifti web bundle'ına ~75 KB ekler, 512 çifti ~15-20 KB.

Bu makinede ImageMagick/PIL/sharp yok, **ffmpeg 6.1.1 var** ve alfa destekli PNG
yazıyor. Bir kerelik türetme (çıktı commit'lenir):

```bash
ffmpeg -i apps/mobile/assets/icons/default.png -vf "format=rgba,\
geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((512-hypot(X-511.5,Y-511.5))*255,0,255)',\
scale=440:440:flags=lanczos,pad=512:512:36:36:color=0x00000000" \
-frames:v 1 apps/mobile/assets/splash/badge.png
```

Çıktıyı gözle doğrula: alfa kenarı anti-aliased mı, `pad` gerçekten şeffaf mı
(siyah çıkarsa `scale`'den sonra ikinci bir `format=rgba` ekle). Direnirse
`@expo/image-utils` zaten `expo-splash-screen`'in transitive bağımlılığı olarak
diskte. `branding/app-resources/splash.png` (3601×3600) kullanılamaz: wordmark'lı,
tam kanama v1 tuvali.

## `preventAutoHideAsync` / `hideAsync`

- `preventAutoHideAsync()` → `app/_layout.tsx`'te **modül kapsamında**, import'ların
  hemen altında. Paketin kendi dokümantasyonu böyle diyor; effect'e bırakılırsa
  splash çoktan kendiliğinden kaybolmuş olabilir. `void ...catch(() => undefined)`
  şeklinde — `no-floating-promises` eslint'te error.
- `hideAsync()` → `AppSplash`'in `onLayout`'unda, tek `requestAnimationFrame`
  sarmalında. Sıra: native splash (zemin + 160pt rozet) → JS ilk paint (aynı zemin,
  aynı 160dp rozet, opacity 1) → `hideAsync()` → ancak o zaman scale yayı oturur.
  Beyaz flaş olmamasının tüm hikâyesi bu. Overlay `useSafeAreaInsets()` çağırmaz,
  kenardan kenara.

## Değişen mevcut dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `app/_layout.tsx` | Modül kapsamında `preventAutoHideAsync`; `showSpinner` dalı (146-156) → `<SplashFill />`; `<AppSplash />` `QueryClientProvider`'ın son çocuğu olarak, üçlünün **dışında**; `ActivityIndicator` import'u düşer. **123-140 arası dokunulmaz.** |
| `app/index.tsx` | `useSignalAppReady(!isPending && draftReady)`; 38-50 → `<SplashFill />` |
| `app/(auth)/index.tsx` | `useSignalAppReady(seen !== null)`; 32-45 → `<SplashFill />` |
| `src/components/AppGate.tsx` | `useSignalAppReady(Boolean(data?.maintenance.enabled || data?.updateRequired))` |
| `app.config.ts` | Yukarıdaki plugin bloğu |

Sıra: `appReady.ts` + `splashTiming.ts` + testleri → hook'lar → `AppSplash.tsx` →
üç sinyal noktası → `_layout.tsx` → en son asset + `app.config.ts`.

## Bilinen sınırlar (yorum olarak yazılacak, "düzeltilmeyecek")

- **Tema tercihi flaşı.** `ThemeProvider` kayıtlı tercihi async hidrate ediyor ve
  bilerek bloklamıyor (`ThemeProvider.tsx:64-76`). Native splash sistem görünümüne
  bakar; tercihi sistemle çelişen kullanıcı ~50 ms içinde zemini+rozeti bir kez
  değiştirir. Bunu hidrasyona bağlayarak "düzeltmek" o kararı bozar.
- **OTA.** Plugin eklemek native değişiklik ama `runtimeVersion: { policy: 'sdkVersion' }`
  değişmiyor; JS'i taşıyan bir OTA, hâlâ stok beyaz splash'lı binary'lere iner.
  JS ile native değişikliği aynı store build'inde gönder.
- **Web'de native splash yok.** Tarayıcı JS bundle boot edene kadar kendi beyazını
  boyar. İsteğe bağlı ve bu iş kapsamı dışı: `app/+html.tsx` ile inline
  `@media (prefers-color-scheme: dark){body{background:#1c1f24}}`.
- **`AlertHost` `Modal` kullanıyor**, native'de overlay'imizin üstünde çizer. Boot
  sırasında patlayan bir API hatası splash'ın üzerine alert koyabilir. Nadir, kabul.
- **`usePathname()` root layout'ta.** `app/_layout.tsx` `ExpoRoot` içinde render
  olduğu için çalışması gerekir; uygulama sırasında doğrula. Bozulursa 2. katmanı
  düşür, 1 ve 3 zaten kapsıyor.

---

# İş 2 — Galeri / kamera seçimi

Branch: `photo-camera-option` (origin/main'den).

## Karar özeti

Beş giriş noktasının hepsi; seçim `chooseAlert` diyaloğuyla; web'de diyalog yok,
doğrudan galeri.

## `src/lib/pickImageAsset.ts` genişletilir

Bugünkü hâli (`:28-48`) sabit: izin iste → galeri aç. Yeni sözleşme, mevcut
`PickImageResult` ayrımını (`picked` / `cancelled` / `denied`) koruyarak:

```ts
export interface PickImageOptions {
  /** Kare kırpma: avatar ve onboarding true, sohbet/feed false. */
  allowsEditing?: boolean
  aspect?: [number, number]
  /** İzin reddedildiğinde hangi metinlerin gösterileceğini çağıran bilir. */
}
export async function pickImageAsset(options?: PickImageOptions): Promise<PickImageResult>
```

Akış:

1. **Web** (`Platform.OS === 'web'`): diyalog yok, doğrudan `launchImageLibraryAsync`.
   Uygulamanın mevcut idiom'u (`src/lib/appIcon.ts:21`, `notifications.ts:13`,
   `purchases.ts:38`). Sebebi: web'de `capture` özniteliği masaüstünde yok sayılıyor,
   "Kamera" deyip dosya seçici açmak yalan olur.
2. **Native:** `chooseAlert(t('media.sourceTitle'), undefined, [{camera}, {library}])`.
   `chooseAlert` (`src/lib/alert.ts:119-128`) İptal'i kendi ekliyor, dismiss'i de
   `null`'a çözüyor, butonları alt alta çiziyor (`AlertHost.tsx:80-81`) — üç satırlık
   liste zaten doğru görünüyor. `null` → `{ status: 'cancelled' }`.
3. Seçime göre `requestCameraPermissionsAsync()` + `launchCameraAsync(opts)` ya da
   `requestMediaLibraryPermissionsAsync()` + `launchImageLibraryAsync(opts)`. İzin
   yoksa `{ status: 'denied', source: 'camera' | 'library' }` — çağıranın doğru
   metni gösterebilmesi için `denied`'a `source` eklenir (mevcut `status: 'denied'`
   okuyan çağıranlar bozulmaz).
4. `quality: 0.8` ve `mediaTypes: ['images']` helper'da kalır — maliyet kararı,
   yorumu zaten orada.

Kamera yakalamaları `image/jpeg` üretiyor; hem `IMAGE_CONTENT_TYPES`
(`packages/shared/src/media.ts:13`) hem `AVATAR_CONTENT_TYPES`
(`packages/shared/src/profile.ts:306`) bunu kabul ediyor — sunucu tarafında
değişiklik yok.

## Çağıranlar

| Dosya | Bugün | Sonra |
| --- | --- | --- |
| `app/(onboarding)/photo.tsx:38-50` | Inline picker, `allowsEditing + aspect [1,1]` | `pickImageAsset({ allowsEditing: true, aspect: [1, 1] })` |
| `app/(app)/edit-profile.tsx:107-121` | Inline `pick()` helper, `allowsEditing` | Aynı `pick()` imzası korunur, içi `pickImageAsset({ allowsEditing: true })` olur — iki çağıranı (avatar `:190`, ızgara `:434`) değişmez |
| `app/(app)/chat/[id].tsx:237` | `pickImageAsset()` | Değişiklik yok (helper içeriden diyaloğu açar) |
| `src/components/AttachmentBar.tsx:45` | `pickImageAsset()` | Değişiklik yok |

Yani inline iki kopya helper'a taşınıyor; `denied` mesajlarını çağıranlar
göstermeye devam ediyor (`edit-profile.tsx` bugün sohbetin anahtarlarını ödünç
alıyor — bu düzeltilecek, aşağıya bak).

## i18n

Sekiz katalog da güncellenmeli (`src/i18n/messages/*.ts`), İngilizce'ye eklenip
diğerlerine eklenmeyen anahtar derlenmiyor (`catalogs.ts:11-15`) ve
`catalogs.test.ts:29` paritesi test ediyor.

Yeni ortak namespace, `common`'ın yanına — beş giriş noktası aynı diyaloğu
gösterdiği için tek yerde:

```
media: {
  sourceTitle: 'Add a photo',
  sourceCamera: 'Take a photo',
  sourceLibrary: 'Choose from library',
  cameraTitle: 'Camera',
  cameraPermission: 'LangX needs permission to use your camera.',
}
```

Mevcut galeri-izin anahtarları (`chat.photosPermission`, `feed.photosPermission`,
`onboarding.photoPermission`) bilerek farklı sözlerle yazılmış, onlara
dokunulmuyor. `edit-profile.tsx:110`'un `chat.*` anahtarlarını ödünç alması ayrı
bir küçük düzeltme: `editProfile.photosTitle` / `editProfile.photosPermission`
eklenip oraya bağlanır.

## `app.config.ts` (isteğe bağlı, build gerektirir)

```ts
['expo-image-picker', {
  photosPermission: 'LangX uses your photo library so you can share photos in chat.',
  cameraPermission: 'LangX uses your camera so you can take a photo to share.',
}],
```

Sadece iOS izin metnini markalaştırır. Bunsuz da özellik çalışır (yukarıdaki
Context'e bak) — OTA ile gönderilecekse bu satırı bir sonraki store build'ine
bırak, ama `plugins` değişikliğini splash PR'ıyla çakışmayacak şekilde yaz.

---

# İş 3 — Chats başlığındaki kayık arama butonu (+ altından çıkan ikinci bug)

Branch: `chats-header-layout` (origin/main'den). Küçük, tek başına gidebilir.

## Bug A — arama ikonu ortada asılı kalıyor

`app/(app)/chats.tsx:86-106` başlık satırında **üç** çocuk var (başlık,
`PeopleSearch`, yıldız) ve `titleRow` hâlâ `justifyContent: 'space-between'`
(`:291-296`). Çocukların hiçbirinde `flex` yok — `title` sadece "Chats"
genişliğinde. `space-between` artan genişliği iki boşluğa **eşit** dağıtıyor:
başlık solda, yıldız sağda, büyüteç tam ortada. Ekran görüntüsündeki tablo bu.

Git geçmişi bunu bir regresyon olarak gösteriyor: `821cbcb5` `PeopleSearch`'ü
başlıkla yıldızın arasına koyup satırı üç çocuklu yaptı, `0a2c3efd` Discover'ın
aynı satırını yeni idioma (`gap` + `marginStart: 'auto'`) taşıdı ama Chats'i iki
çocukken doğru olan eski düzende bıraktı.

Ev usulü "esnek orta" (bkz. `src/components/ui/ScreenHeader.tsx` → `title: { flex: 1 }`,
ve `app/(app)/me.tsx:268-274` → `heroText: { flex: 1, minWidth: 0 }`). Discover'ın
`marginStart: 'auto'` kümesi ikinci bir varyant ve kendi latent bug'ı var (`pair`
yoksa auto margin kalmıyor), onu örnek alma.

**Düzeltme:** `titleRow`'dan `justifyContent: 'space-between'` çıkar, `gap: spacing.md`
ekle, `title`'a `flex: 1` ver. Yıldız ve büyüteç sağda birbirine yaslanır.

İki ayrıntı:

- **Arama açıkken** başlık ve yıldız `null` oluyor ve `PeopleSearch` satırın
  tamamını istiyor (`:87-88` yorumu). `flex: 1` başlıkta olduğu için başlık
  gidince otomatik olarak alan `PeopleSearch`'e kalıyor — ama `PeopleSearch`'ün
  açık hâlinin kendi `flex`'i var mı, uygulama sırasında
  `src/components/PeopleSearch.tsx:158` civarında doğrula; yoksa açık alana
  `flex: 1` ekle.
- `title`'daki `paddingTop: spacing.md` (`:298`) `alignItems: 'center'` altında
  ikonları metin kutusuna göre ortalıyor, "Chats" ~6px aşağı kayıyor. Discover ve
  Feed bu padding'i satırı saran `header`'a koyuyor; aynısını yap.

## Bug B — zaman damgası "Archive" ikonunun üstüne biniyor

Aynı ekran görüntüsünde görünüyor ve aynı ekranın bug'ı, o yüzden burada:
**swipe aksiyon katmanı her satırda kalıcı olarak görünür durumda.**

`src/components/SwipeableRow.tsx` yapısı:

```
<View style={styles.wrap}>        // backgroundColor: colors.bg  ← opak, ama EN ALTTA
  <View style={styles.behind}>    // position: absolute, inset 0 — pin / archive
  <Animated.View translateX>      // ← backgroundColor YOK
    {children}                    // chats.tsx styles.row — onun da yok
```

Tek opak yüzey `wrap`, o da `behind`'ın **altında** boyanıyor. Yani aksiyonlar
üstte, satır içeriği onların üzerinde şeffaf cam. Archive ikonu + etiketi hareket
olmadan da hep görünüyor. Soldaki pin aksiyonunu 52px opak `Avatar` örttüğü için
sadece sağdaki fark ediliyor. `behind` `paddingHorizontal: spacing.lg` ile sağdan
16px içeride; zaman damgası da (`chats.tsx:258-260`, `time` `:316`) aynı kenara
yaslı — aynı 16px'lik sütunu paylaşıyorlar. Okunmamış rozeti de bir satır altta
"Archive" yazısına biniyor, aynı sebep.

**Düzeltme:** hareket eden `Animated.View`'a `backgroundColor: colors.bg` ver
(`wrap`'takini bırakabilirsin, taşma sırasında altta kalan zemin o). Neden orada
olduğunu yorumla — "aksiyonlar altta durmalı, üstteki katman opak olmalı"
bilgisi yoksa bir dahaki refactor'da yine kaybolur.

`SwipeableRow` tek yerde kullanılıyor (`app/(app)/chats.tsx`), etkisi kapalı.

**Bu bug neden gözden kaçtı:** `SwipeableRow.tsx:16-17` + `src/lib/swipeAction.ts:65-67`
→ web'de dokunma yoksa (`navigator.maxTouchPoints === 0`) aksiyon katmanı hiç
render edilmiyor. Masaüstü tarayıcıda görünmez, iPhone'da koşulsuz görünür. Droplet
üzerindeki web dev döngüsü bunu yapısal olarak göremiyor.

## Bulundu ama bu plana dahil edilmedi — söylersen eklerim

**Çift üst safe-area boşluğu.** `app/(app)/_layout.tsx:66` sekmeleri
`<SafeAreaView edges={['top']}>` ile sarıyor, `src/components/ui/Screen.tsx:93-97`
ise ayrıca `paddingTop: insets.top` ekliyor. Web'de ikisi de 0, no-op; iPhone'da
~47-59px fazla üst boşluk demek — ekran görüntüsündeki "Chats" başlığının
üstündeki geniş boşluk bu. Düzeltmesi tek satır ama `Screen`'i kullanan **her**
ekranı etkiliyor, yani ayrı bir PR ve cihazda tam bir geçiş turu istiyor.
Bildirdiğin bug değil, o yüzden karar senin.

---

# İş 4 — Yüklenirken bekleyen mesaj balonu + yüzde

Branch: `chat-pending-media` (origin/main'den).

## Bugün ne oluyor

`app/(app)/chat/[id].tsx:207-235` `sendMedia`: `setSendingMedia(true)` → upload →
socket emit → `finally setSendingMedia(false)`. `sendingMedia`'nın **tek yaptığı**
iki butonu devre dışı bırakmak. Thread'de hiçbir şey görünmüyor. Yavaş bağlantıda
3-5 MB'lık bir foto = saniyelerce hiçbir geri bildirim. Hata olursa `showAlert` ve
dosya çöpe — tekrar deneme yok (metin mesajlarında var, aşağıya bak).

## Yüzde neden XHR gerektiriyor

`queries.ts:1161-1162` (`uploadMessageMedia`) düz `fetch(uri).blob()` + `PUT`.
`fetch` upload progress event'i vermiyor ve RN'de request body'si için
`ReadableStream` yok. Tek yol `XMLHttpRequest` + `xhr.upload.onprogress` — hem
RN'de hem web'de gerçek. Repoda **hiç XHR kullanımı yok** (`grep` sıfır sonuç),
yani bu yeni bir primitive; ama presigned `PUT` zaten `apiFetch`/`client`'ı
atlayıp doğrudan bucket'a gittiği için auth katmanına dokunmuyor.

## Yeni dosyalar

```
apps/mobile/src/lib/putWithProgress.ts    # ince XHR sarmalayıcı
apps/mobile/src/lib/pendingMedia.ts       # bekleyen öğe store'u (saf)
apps/mobile/src/lib/pendingMedia.test.ts
apps/mobile/src/lib/uploadProgress.ts     # saf matematik: byte → oran, aşamalar
apps/mobile/src/lib/uploadProgress.test.ts
apps/mobile/src/components/PendingMediaBubble.tsx
```

`putWithProgress` ince tutulacak: vitest node ortamında `XMLHttpRequest` yok, o
yüzden test edilebilir her şey (oran hesabı, aşama geçişleri, kuyruk yönetimi)
`uploadProgress.ts` / `pendingMedia.ts` içinde ayrı durmalı. `src/lib` vitest'in
görebildiği tek ağaç — `unsentMessages.ts:10-12` bu kısıtı zaten kayda geçirmiş.

```ts
export async function putWithProgress(options: {
  url: string
  body: Blob
  contentType: string
  onProgress: (fraction: number) => void
  signal?: AbortSignal
}): Promise<void>
```

`queries.ts`'teki **üç birebir kopya** (`uploadMessageMedia:1139`,
`uploadPostMedia:1189`, private `uploadImage:1065`) bunu kullanır; `onProgress`
opsiyonel, yalnızca sohbet bugün gerçekten çiziyor. Feed'in `feed.sending`
butonu ve avatar yüklemesi ileride bedavaya alır.

**Dürüst ol:** `fetch(uri).blob()` dosyanın tamamını PUT başlamadan önce belleğe
okuyor. Yani %0 bir süre öylece durur. Bunu iki aşama olarak modelle
(`reading` → belirsiz spinner, `uploading` → yüzde, `sending` → socket ack
bekleniyor) ve `uploadProgress.ts`'te test et; tek bir yalancı yüzde gösterme.

## Bekleyen balon nereye render edilecek

**Cache'e yazma.** Var olan `unsent` (gönderilemeyen metin) desenini izle:
`chat/[id].tsx:707-724`, yerel state, `ListHeaderComponent` içinde — liste ters
çevrili olduğu için görsel olarak en yeni balonun altında, composer'ın üstünde
çıkıyor. Stilleri `:1043-1062`.

`keys.messages` cache'ine `setQueryData` ile sahte mesaj sokmak üç yerden
patlıyor: `appendIncomingMessage` `_id` ile dedupe ediyor
(`src/lib/messageCache.ts:27-52`), sahte `_id` `applyMessageUpdate`/
`applyDeliveredAt` ile çakışıyor, ve jump-window koruması (`first.prevCursor`)
eklemeyi moda bağımlı yapıyor.

`pendingMedia.ts` öğe şekli (`unsentMessages.ts` ile aynı ruh):

```ts
export interface PendingMedia {
  clientId: string
  kind: 'image' | 'audio'
  uri: string            // yerel file:// — ImageBubble bunu zaten çizebiliyor
  contentType: string
  width?: number; height?: number; durationSeconds?: number
  phase: 'reading' | 'uploading' | 'sending' | 'failed'
  fraction: number       // 0..1, yalnız 'uploading' aşamasında anlamlı
}
```

**Retire etme:** `sendMediaMessageSchema` (`packages/shared/src/chat.ts:371-377`)
metindekinin aksine **`clientId` taşımıyor**, dolayısıyla sunucu echo'sundan
eşleştiremezsin. `emitWithAck(socket, 'message:media', …)` çözüldüğünde ack
gerçek mesajı taşıyor (`apps/api/src/ws/index.ts:177-199`) — bugün bu dönüş
değeri atılıyor; onu kullanıp öğeyi kaldır. Ack kaybolursa `message:new` zaten
gerçek balonu getirir; öğe orada asılı kalmasın diye bir üst zaman sınırı koy.

> İsteğe bağlı takip işi (bu plana dahil değil): `sendMediaMessageSchema`'ya
> `clientId` ekleyip medyayı metinle aynı çökme-güvenli retry hattına almak.
> API + shared + index değişikliği demek.

## Görsel

- **Foto:** `MediaBubble.tsx` `ImageBubble`'ın ölçüleri (genişlik 220, mesajdan
  gelen `aspectRatio`, ölçülemezse 220 yükseklik). `source={{ uri }}` yerel
  `file://`'i kabul ediyor, yani thumbnail anında görünür. Üstüne hafif karartma
  + ortada yüzde.
- **Ses:** `AudioBubble`'ın 3px `track`/`trackFill` çifti (`MediaBubble.tsx:82-84`,
  `:165-166`) doğrudan progress dolgusu olarak kullanılır; `minWidth: 180` korunur.
- **Yüzde/spinner:** `src/components/ui/ProgressBar.tsx` zaten var (0-1'e
  clamp'li, `accessibilityRole="progressbar"` + `accessibilityValue`). `reading`
  aşamasında `Skeleton`'ın nabzı ya da belirsiz bir `ActivityIndicator`.
- **Meta satırı:** `MessageMeta` gerçek bir `MessageDto` istiyor ve
  `DELIVERY_STATES`'in tam olarak `['sent','delivered','read']` olduğu
  `packages/shared/src/chat.test.ts:36-38`'de assert ediliyor. **Dördüncü bir
  durum ekleme.** Bekleyen balon kendi küçük meta satırını çizsin (saat glyph'i,
  WhatsApp konvansiyonu).

## Hata durumu

Bugünkü `showAlert` + dosyayı çöpe atma yerine: öğe `phase: 'failed'` olarak
kalsın, `unsent` bloğunun görsel dilini kullansın (`colors.danger` çerçeve) ve
dokununca yeniden denesin — `chat.notSentRetry` metni medya için de okunuyor.
`QUOTA_EXCEEDED` istisna: o hâlâ alert + paywall yolundan gitmeli ve öğe
kaldırılmalı, çünkü tekrar denemenin anlamı yok.

## i18n

Sekiz katalog. Yeni: `chat.uploadingPercent: 'Uploading… {percent}%'`,
`chat.preparingUpload: 'Preparing…'`. Mevcut `chat.notSentRetry`,
`chat.couldNotSend`, `chat.attachmentFailed`, `chat.mediaQuota` aynen kullanılır.

---

# İş 5 — Fotoğrafa dokununca tam ekran + zoom

Branch: `photo-viewer-zoom` (origin/main'den).

## Bugünkü durum

Uygulamada **tek** bir görsel bir şey açıyor: profil foto şeridi
(`src/components/PhotoGallery.tsx`). Sohbet balonundaki görsel
(`MessageBubble.tsx:310-333` — sarmalayıcı `Pressable`'da yalnızca
`onLongPress`), feed post görselleri (`feed.tsx:431-434`, `:539-542`) ve post
detayı (`post/[id].tsx:327`, `:411`) tamamen tepkisiz.

`PhotoGallery` modal'ı var (`animationType="fade"`, Android geri tuşu bağlı) ama:
zoom yok, pan yok, çift dokunuş yok, arka plana dokunup kapatma yok, kaydırarak
geçiş yok (sadece `‹ n/m ›` okları), ve üç kontrolün hiçbirinde
`accessibilityLabel` yok (`:48`, `:56`, `:65`). Props'u yalnızca
`{ photos: { url: string }[] }` — küçük resim şeridini de kendi çizdiği için tek
bir sohbet görseli için olduğu gibi kullanılamaz.

## Yapı

`PhotoGallery`'nin modal yarısı `src/components/PhotoViewer.tsx` olarak çıkarılır:

```ts
export function PhotoViewer(props: {
  photos: { url: string }[]
  index: number | null      // null = kapalı
  onClose: () => void
  onIndexChange?: (index: number) => void
}): JSX.Element | null
```

`PhotoGallery` şeridi + `openAt` state'ini tutmaya devam eder, modal yerine
`PhotoViewer` render eder — mevcut iki çağıranı (`profile/[handle].tsx:296`,
`me.tsx:253`) değişmez ve zoom'u bedavaya alır.

Bağlanacak yeni yerler:

| Yer | Değişiklik |
| --- | --- |
| `MessageBubble.tsx:310-333` | Medya dalındaki `Pressable`'a `onPress` — yeni bir `onOpenImage(media)` prop'u üzerinden. Swipe-to-reply `PanResponder`'ı `onStartShouldSetPanResponder: () => false` kullandığı için (`:117-130`) tap zaten hayatta kalıyor; `onLongPress` menüsü de bozulmamalı. |
| `app/(app)/chat/[id].tsx` | Viewer state'i burada, listenin üstünde tek bir `PhotoViewer`. Thread'deki tüm görselleri toplayıp diziyi verirsen oklar sohbetin foto geçmişinde gezer — basit hâli tek görselle de olur, tercih uygulama anında. |
| `feed.tsx:431-434`, `:539-542`, `post/[id].tsx:327`, `:411` | Görseli `Pressable` ile sar, aynı `PhotoViewer`. |

## Zoom — elle, PanResponder ile

Saf matematik `src/lib/pinch.ts`'e (test edilebilir):

```ts
export function distanceBetween(touches: { pageX: number; pageY: number }[]): number
export function clampScale(next: number): number                    // [1, 4]
export function clampOffset(offset: {x,y}, scale, container, content): {x,y}
```

`PhotoViewer` içinde `Animated.Value` scale + translate, `useNativeDriver: true`.
Davranış:

- İki parmak → mesafe oranıyla ölçek; `onPanResponderRelease`'te 1'in altına
  düşerse 1'e yaylanarak dönsün.
- Tek parmak: `scale > 1` iken pan (sınırlara clamp'li); `scale === 1` iken
  aşağı sürükle-kapat.
- Çift dokunuş 1x ↔ 2x, dokunulan noktayı merkeze alarak.
- Foto değişince ve kapanınca ölçek/offset sıfırlanır.
- Web'de zoom'luyken `touchAction: 'none'`; `MessageBubble.tsx:399`'daki
  `WEB_PAN_Y = { touchAction: 'pan-y' }` aynı idiomun örneği.

Bu, repo'nun üç ayrı yerde yazılı kararına (gesture-handler yok, Reanimated yok)
uyuyor ve ev usulü zaten PanResponder: `RangeSlider.tsx:18` "slider bağımlılığı
yerine elle PanResponder" diyor.

Bu arada eksikleri de kapat: arka plana dokunup kapatma, ✕/‹/› için
`accessibilityLabel`, ve sayaç metni.

## i18n

Sekiz katalog. Tamamı yeni — bugün `PhotoGallery` `✕ ‹ ›` karakterlerini
etiketsiz basıyor: `photo.close`, `photo.previous`, `photo.next`,
`photo.counter: '{index} / {total}'`, `photo.zoomHint`.

---

# İş 6 — Şehri sorma, türet; profilde göster (anahtarla)

Branch: `derived-city` (origin/main'den). En büyük iş — shared + API + mobil +
veri betiği.

## Bugünkü durum

`city` düz, opsiyonel, elle yazılan bir metin alanı. İki yerde soruluyor
(`app/(onboarding)/about-you.tsx:90-104` ve `app/(app)/edit-profile.tsx:229-242`),
`profiles.city` olarak saklanıyor, yanında `cityKey` türetiliyor
(`packages/shared/src/city.ts` — Türkçe İ/ı katlama, diakritik soyma) ve
`cityKey` üzerinde `sparse` bir index var (`apps/api/src/db/indexes.ts:93-103`).

**Ve hiçbir ekranda çizilmiyor.** `profile/[handle].tsx:102` ve `me.tsx:82` meta
satırını yalnızca `country`'den kuruyor. Yani alan yazılıyor, filtreleniyor,
asla gösterilmiyor. `docs/store/privacy-data-safety.md:18` bugün "Shown on
profile" diyor — bu satır **şu an yanlış**.

Tek gerçek tüketicisi Pro keşif filtresi: kullanıcı serbest metin yazıyor,
`cityKey` katlamasıyla eşleşiyor (`apps/api/src/modules/discovery/discovery.ts:192-198`).
`cityKey()` zaten "İstanbul" / "Istanbul" / "ISTANBUL" sorununu yamamak için var.

## Hedef

- Kullanıcıya şehir **sorulmaz** — iki metin girişi de kalkar.
- Şehir sunucuda, zaten saklanan koordinattan **türetilir**.
- Profilde gösterilir, ama `privacy.hideCity` anahtarıyla kapatılabilir.
- Keşif filtresi kalır, ama serbest metin değil: birkaç harf yazılır, aşağıdaki
  listeden kanonik şehir seçilir.

## Neden cihaz üstü reverse geocode değil, sunucu tarafı

`CountryFromLocation.tsx` ülkeyi cihazda reverse geocode edip iki harfli kodu
gönderiyor. Şehir için aynısını yapmak cazip ama yanlış: cihazın döndürdüğü ad
**cihazın diline bağlı** ("İstanbul" / "Istanbul" / "Estambul"), yani kanonik
değil — `cityKey()` katlamasının var olma sebebi tam olarak bu. Dropdown zaten
kanonik kimlikler istiyor, o yüzden:

**Koordinat sunucuda zaten var** (`profiles.location`, 2dsphere index'li,
2 ondalığa yuvarlanmış ≈ 1.1 km). En yakın kanonik şehri `$geoNear` ile bulmak
hem dilden bağımsız, hem yeni bir izin yüzeyi açmıyor, hem de filtreyle aynı
veri kümesini kullanıyor.

**Kısıt, açıkça söylenmeli:** konum izni vermeyen kullanıcının koordinatı yok,
dolayısıyla şehri de yok. Cloudflare'in ücretsiz katmanı sadece `CF-IPCountry`
veriyor (`apps/api/src/lib/requestCountry.ts`), şehir vermiyor. İzinsiz
kullanıcı ülkeyle görünür, şehirsiz kalır ve şehir filtresinin sonuçlarına
girmez.

Bu bir hata değil ama sessiz kalırsa hata gibi görünür, o yüzden iki yerde
yazılı olacak:

- **Filtre ekranında**, şehir seçicinin altında, `filters.practiseBody` /
  `filters.theirLevelBody` ile aynı `styles.hint` deseninde yeni bir
  `filters.cityNeedsLocation` satırı: sadece konumunu paylaşanların bu filtreye
  girdiğini söyler. Mevcut `filters.cityBody` ("Spelling, accents and case do
  not have to match") artık yanlış — kanonik listeden seçiliyor — o da yeniden
  yazılır.
- **Kendi profilinde**, şehir satırı boşken: `editProfile.countryHint` zaten
  "Taken from your connection. Share your location to correct it." diyor;
  şehrin neden boş olduğunu söyleyen kardeş bir satır aynı yere girer.

Discover'ın `discover.locationOffTitle` / `locationOffBody` boş durumu bu
konuşmayı zaten yapıyor; sözcük seçimi ona uydurulacak, yeni bir dil
uydurulmayacak.

## Kanonik şehir kümesi

Mongo'da yeni bir `cities` koleksiyonu:

```ts
{ _id: string            // 'geonames:745044'
  name: string           // 'Istanbul'
  asciiName: string      // arama için
  countryCode: string    // 'TR'
  admin1?: string        // il/eyalet, aynı adlı şehirleri ayırmak için
  population: number     // sıralama
  location: GeoJSON Point }
```

İki index: `location_2dsphere` (en yakını bulmak için) ve `asciiName` üzerinde
prefix aramaya uygun bir index. `apps/api/src/db/indexes.ts`'e eklenir — o dosya
invariant'ların yeri, buradakiler optimizasyon; yorumda ayrımı belirt.

**İstemciye gömülmez.** ~24 bin kayıtlık bir liste web bundle'ına giremez;
arama sunucudan yapılır (`GET /cities?q=`), tıpkı `PeopleSearch` gibi.

**Veri kaynağı:** GeoNames `cities15000` (nüfus > 15.000, ~24 bin şehir),
lisans **CC BY 4.0 — atıf zorunlu**. Repo public ve BSD-3, atıf da öyle
görünür olmalı. Dört yere girer:

- `langx/docs/data-sources.md` (yeni) — kaynak, sürüm, indirme tarihi, lisans
  metnine bağlantı. Şehir listesi yenilendiğinde güncellenecek tek yer burası.
- `apps/mobile/app/(app)/kitchen.tsx` ("Our Kitchen") — kullanıcının gördüğü
  atıf. Ekran zaten kullanılan araçları anlatıyor, veri kaynağı oraya ait.
- `apps/api/scripts/seed-cities.ts` başlık yorumu — betiği çalıştıran kişi
  lisansı görsün.
- `langx/README.md` üçüncü taraf veri satırı.

Atıf metni GeoNames'in istediği biçimde ("this work is based on data from
GeoNames, licensed under CC BY 4.0", kaynağa bağlantıyla) yazılacak; kendi
sözlerimizle özetlenmeyecek.

Seed betiği `apps/api/scripts/seed-cities.ts`, ev usulünde: varsayılan dry-run,
yazmak için `--apply` (`backfill-city-key.ts:16-17` bu deseni belgeliyor).

## Türetme

`profiles.ts:724`'te konum yazılırken (`POST /profiles/me/location`) en yakın
şehir `$geoNear` ile çözülür ve profile yazılır:

```
$set: { location, locationUpdatedAt, cityId, cityName, cityCountryCode }
```

`DELETE /profiles/me/location` (`profiles.ts:741`) `location` ile birlikte bu üçünü
de `$unset` eder — konumunu silen biri şehrini de silmiş olmalı.

`cityName`/`cityCountryCode` denormalize saklanır ki profil çizerken ikinci bir
sorgu gerekmesin; `cityId` filtrenin eşleştiği alan.

Makul bir üst mesafe sınırı koy (örn. 100 km) — okyanus ortasındaki bir
koordinat en yakın şehri "bulmasın", şehirsiz kalsın.

## Silinenler

| Ne | Nerede |
| --- | --- |
| `city` alanı, iki form girişi | `about-you.tsx:90-104`, `handle.tsx:106`, `edit-profile.tsx:94/169/229-242` |
| `OnboardingDraft.city` | `useOnboardingDraft.ts:19,47` (+ `onboardingStep.test.ts:13`) |
| Şemalardan `city` | `profile.ts:166` (onboarding), `:241` (update) — istemci artık şehir **yazamaz** |
| `CITY_MAX_LENGTH` | `profile.ts:45` ve dört import eden dosya |
| `cityKey()` + testi | `packages/shared/src/city.ts`, `city.test.ts`, `index.ts:13` export |
| `cityKey` yazımları | `profiles.ts:5,62-66,313-316,599-606` |
| `city_key` index'i | `indexes.ts:93-103` — **ve elle `db.profiles.dropIndex('city_key')`**, çünkü `ensureIndexes` (`:503+`) yalnızca `createIndexes` çağırıyor, hiçbir index'i düşürmüyor |
| `backfill-city-key.ts` | Tüm dosya |
| i18n `onboarding.city*`, `editProfile.city*` | Sekiz katalog |

Seed betiklerindeki (`seed-test-users.ts`, `seed-test-chat.ts`) elle `city`
değerleri de kalkar; o kullanıcılar zaten koordinat alıyorsa şehir türetilir.

## Eklenenler

| Ne | Nerede |
| --- | --- |
| `privacy.hideCity: boolean` | `packages/shared/src/profile.ts:268-272` (mevcut `privacy` nesnesi; kısmi güncelleme dotted-path ile yazılıyor, `:256-266` yorumu bunu anlatıyor), `profiles.ts:98-99` ve iki varsayılan (`:295-296`, `:515-516`) |
| Ayarlar satırı | `settings.tsx` — `hideOnlineStatus` satırının (`:351-352`) birebir ikizi. Ücretli değil, herkese açık. |
| `toPublicProfile` kapısı | `profiles.ts:867` — `city` yerine `if (!profile.privacy?.hideCity && profile.cityName) result.city = …` |
| Profilde gösterim | `profile/[handle].tsx:102` ve `me.tsx:82` meta satırına, `countryLabel()`'ın önüne |
| `GET /cities?q=` | Yeni `apps/api/src/routes/cities.ts` + `modules/cities/` — prefix arama, nüfusa göre sıralı, ülke kodu ve admin1 ile ayrıştırılmış etiket |
| Filtrede tipeahead | `filters.tsx:318-347` — metin kutusu yerine debounce'lu arama + sonuç listesi; seçim `cityId` yazar |
| `discoveryQuerySchema.city` → `cityId` | `packages/shared/src/discovery.ts:144-149`; `discovery.ts:192-198` artık `match.cityId` |
| `DiscoveryFilters.city` → `cityId` + etiket | `src/lib/discoveryFilters.ts:34-35,80-81,97,116,130` |

`sharedProfile.ts` (paylaşılan link görünümü) şehri **göstermemeye devam eder** —
`:17`'deki yorum güncellenir ama izin listesi aynı kalır. Paylaşılan link
oturumsuz açılıyor; oraya şehir koymak bambaşka bir ifşa.

## Mevcut veri

Karar: **temizle, sıfırdan türet.** Betik `apps/api/scripts/unset-city.ts`, ev
usulünde dry-run + `--apply`:

```ts
{ $unset: { city: '', cityKey: '' } }   // migrate-birthdate.ts:73 aynı deseni kullanıyor
```

Ardından `db.profiles.dropIndex('city_key')`. Sonra `seed-cities.ts --apply`.
Şehir, kullanıcılar bir sonraki konum yenilemesinde
(`src/hooks/useLocationRefresh.ts`, ön planda) doğal olarak dolar; geri dolum
betiği yazmak istersen mevcut `location`'ı olan profilleri tek geçişte
çözebilirsin — o daha hızlı ama şart değil.

## Gizlilik ve mağaza beyanı

Bu, kullanıcı için görünür bir gizlilik değişikliği: bugüne kadar kimse şehrini
görmüyordu, artık — kapatmazsa — görecek. Üç yeri lockstep güncelle:

- `docs/store/privacy-data-safety.md:18` — satır bugün zaten yanlış; hem düzelt
  hem yeni durumu yaz (artık **türetilmiş**, kullanıcı tarafından girilmemiş).
- `langx/docs/legal/promise-change.md` — ürün vaadi kısıtları buradan geçiyor.
- `docs/architecture.md` — `:88`, `:131`, `:282`, `:329`, `:334`, `:579`, `:671`,
  `:708`; `docs/decisions.md:952` (`:16` ve `:66` tarihsel kayıt, dokunma).
- Kararın kendisi `docs/decisions.md`'ye yeni bir madde olarak girmeli — "şehri
  sormak yerine türetmek" ve "gösterimi anahtara bağlamak" sonradan keyfi
  görünecek türden kararlar.

Mağaza etiketlerinde açık iki iş zaten var (bkz. gizlilik-etiketi görseli işi);
bu değişiklik onlarla aynı gönderimde gitmeli.

Bir de konum izninin **gerekçesi genişliyor**: bugün konum yalnızca mesafe ve
ülke için isteniyor, bu işten sonra şehir de ondan türüyor. Yani mağaza
formundaki konum satırları da (sadece şehir satırı değil) yeniden okunmalı —
aynı izin artık bir veri daha üretiyor.

## Testler

- `packages/shared/src/discovery.test.ts:41-42,55,64-70` — `city` → `cityId`,
  serbest metin testleri kalkar
- `apps/api/src/routes/discovery.test.ts:641,652-681` — "şehri iki taraf nasıl
  yazarsa yazsın eşleşir" testi anlamsızlaşır (kanonik id artık); yerine
  "`cityId` ile eşleşir" ve "koordinatsız profil şehir filtresine girmez"
  - `:905,997,1071`'deki `ANOTHER_CITY` GPS fixture'ı — **dokunma**, ilgisiz
- `apps/api/src/routes/profiles.test.ts:590` — allow-list dizisinden `'city'`
  çıkar (artık `cityName` üzerinden ve anahtara bağlı); yerine `hideCity: true`
  iken şehrin `toPublicProfile`'da olmadığını doğrulayan yeni test
- `apps/mobile/src/lib/discoveryFilters.test.ts` — `cityId`'ye göre yeniden
- Yeni: en yakın şehir çözümü (mesafe sınırı dahil) ve `GET /cities?q=`
  sıralaması için API testleri

---

# İş 7 — Chats satır aksiyonları: WhatsApp usulü çekmece + Delete

Branch: `chats-row-actions` (origin/main'den, **İş 3 merge edildikten sonra**).

## İstenen

Sola çek → **Archive** ve **Delete** kareleri görünsün, hangisine dokunulursa o
çalışsın. Sağa çek → **Pin** görünsün. Yani çekme aksiyonu *tetiklemez*,
aksiyonu *açar*.

## Bu, mevcut modelin tersine çevrilmesi

`SwipeableRow.tsx:37-41` bugünkü kararı açıkça yazıyor:

> **Swipe and release, not a drawer that stays open.** Açık kalan bir satır,
> liste boyunca "hangi satır açık" durumunu paylaşmayı gerektirir ve burada
> bunun bir örneği yok.

İstenen tam olarak o örneği kurmak. Değişecek noktalar, hepsi tespit edildi:

| Ne | Nerede | Neden |
| --- | --- | --- |
| Bırakınca aksiyonu çalıştırma | `SwipeableRow.tsx:73-83` | Artık `rowReleased` "hangi aksiyonu ateşle" değil "hangi yöne açıl" demek. Eşiği geçmezse 0'a, geçerse açık konuma yaylanır. |
| `pointerEvents="none"` | `:100` | Arkadaki katman dokunuş almıyor. Kalkacak, aksiyonlar gerçek `Pressable` olacak. |
| Arka katmanın düzeni | `:100-103`, stiller `:132-142` | Tek satır `space-between` yerine iki yana yaslı, tam yükseklikte **buton grupları**. Solda tek (Pin), sağda iki (Archive, Delete). |
| `gesture.dx` birikimi | `:69-72` | `dx` jestin başından ölçülüyor. Satır açık dururken ikinci çekişte `offset.current = restingX + gesture.dx` olmalı, yoksa satır sıfıra sıçrar. |
| Hareket eden katmanda zemin yok | `:104` + `chats.tsx:300-307` | İş 3'te zaten ekleniyor; açık duran satırda **zorunlu** hâle geliyor. |
| PanResponder `useRef` ile bir kez kuruluyor | `:60` | İlk render'ın prop'larına kapanıyor. Durum içeri girince bu kırılır; `useRef` içindeki callback'ler güncel değerleri ref üzerinden okumalı. |
| `onStartShouldSetPanResponder: () => false` | `:64` | Tap ve long-press hayatta kalsın diye böyle. Açık satırda "dışarı dokununca kapan" bunun tersini istiyor — kapatmayı satır içi bir overlay `Pressable` ile çöz, start responder'ı bozma. |
| `ACTION_MAX_PX = 96` | `swipeAction.ts:16` | Artık açılan buton grubunun genişliği olmalı; solda iki buton, sağda bir buton → iki farklı açılma mesafesi. |
| `rowReleased` anlamı ve testleri | `swipeAction.ts:50-54`, `swipeAction.test.ts:48-60` | Testler bugünkü anlamı kilitliyor; yeniden yazılacak. |

Liste düzeyinde **"başka satır açılınca bunu kapat"** koordinatörü gerekiyor.
En basiti `chats.tsx`'te tek bir `openRowId` state'i ve `SwipeableRow`'a
`isOpen` + `onOpenChange` prop'ları. Yeni bir global store'a gerek yok.

## Erişilebilirlik — bu işin bedavaya geleni

`SwipeableRow.tsx`'te bugün **tek bir `accessibility*` yok**. Arkadaki
etiketler `pointerEvents="none"` ile dekoratif ama ekran okuyucu yine de
bağlamsız okuyabiliyor. Rework bunu düzeltmek için doğru an:

- Açılan butonlar gerçek `Pressable` + `accessibilityRole="button"` + etiket.
- Sarmalayıcıya `accessibilityActions` (`pin`, `archive`, `delete`) +
  `onAccessibilityAction` — jest olmadan da erişilebilir.
- `chats.tsx:201`'deki satır `Pressable`'ının da etiketi yok; adı çocuklarının
  birleşimi olarak okunuyor. Düzelt.

Masaüstü web'de jest kapalı (`rowSwipeEnabled('web', false) === false`), yani
**uzun basma menüsü tek yol**. Delete oraya da eklenmezse masaüstünde ve ekran
okuyucuda ulaşılamaz olur — `chats.tsx:214-229`'daki `chooseAlert` üç seçeneğe
çıkar.

## Delete — sıfırdan yapılacak API işi

Uygulamada sohbet silme **hiç yok**: ne route, ne şema, ne mutation, ne menü.

**Semantik (kararlaştırıldı):** sadece bende silinir. Karşı tarafta hiçbir şey
değişmez. O yazarsa bendeki thread **boş başlar** — sildiğim mesajlar yalnızca
bana gizli kalır.

Bu, mesaj düzeyinde zaten var olan mekanizmanın thread'e taşınması:
`Message.hiddenFor?: string[]` — "satır durur, çünkü başkasının thread'inin de
yarısı; sadece bu kullanıcılar için projeksiyondan düşer"
(`apps/api/src/modules/chat/conversations.ts:89-93`).

| Katman | Değişiklik |
| --- | --- |
| `conversations.ts:15-54` | `deletedBy?: Record<string, true>` — **dizi değil map**. Sebebi dosyanın kendi yorumunda (`:21-31`): `participants` zaten multikey, MongoDB iki dizi alanı tek index'te birleştirmiyor; `deletedBy.<uid>` skaler olduğu için indexlenebiliyor. `archivedBy`/`pinnedBy` aynı sebeple map. |
| Yeni modül fonksiyonu | Thread'i `deletedBy.<uid> = true` yapar **ve** o thread'in tüm mesajlarına `$addToSet: { hiddenFor: uid }` uygular. Toplu yazma — sınırını ve zaman aşımını düşün; çok uzun thread'lerde parçalı ilerlemeli. |
| `messages.ts:559-569` | Liste sorgusuna `deletedBy.<uid>: { $ne: true }` — arşiv predikatıyla aynı `$ne: true` gerekçesi geçerli (silinip geri gelen thread'de anahtar unset kalıyor). |
| Yeni mesaj geldiğinde | `recordMessage` thread'e yazarken `$unset: { deletedBy.<uid>: '' }` — thread geri gelir, ama eski mesajlar `hiddenFor`'da kaldığı için **boş görünür**. İstenen davranış tam olarak bu. |
| `conversationView.ts:52-71` | Ham map asla dışarı çıkmaz; dosyanın başlığındaki kural bu. Silinen thread zaten listelenmiyor, ayrı bir alan gerekmeyebilir — projeksiyonu sade tut. |
| `packages/shared/src/chat.ts` | Route şeması; `conversationFlagsSchema`'ya **eklenmez** — silme bir bayrak değil, kendi endpoint'i olmalı (`DELETE /conversations/:id`). |
| `apps/api/src/routes/messages.ts` | Yeni `app.delete`. `assertConversationAccess` ile korunur. |
| `apps/mobile/src/api/queries.ts` | `useDeleteConversation()` — `useConversationFlags` (`:617-632`) deseninde, ama o **optimistic update yapmıyor ve hatayı sessizce yutuyor**; silme için bu kabul edilemez, hata bir alert'e bağlanmalı. |

**Onay:** `confirmAlert({ destructive: true })`. Repo'nun kuralı net —
geri alınabilir aksiyon onay istemez (`profile/[handle].tsx:277-278`: "unfollow
için onay yok, `confirmAlert` bloklamanın işi"), geri alınamaz olan ister.
Archive geri alınabilir → onaysız. Delete geri alınamaz → onaylı ve kırmızı.

Metin için hazır emsal: `chat.deleteOwnSide` = "It stays on their device."
Sohbet için aynısının thread hâli yazılır.

## i18n

Sekiz katalog. Yeni: `chats.delete`, `chats.deleteTitle`, `chats.deleteBody`
(karşı tarafta kalacağını söyleyen), `chats.deleted` (toast).
`common.delete` ve mevcut `chats.archive`/`unarchive`/`pin`/`unpin` aynen
kullanılır.

**Not:** `tips.chatSwipeReply` var ama chats listesindeki çekme jestini öğreten
bir tip yok. İş 9'daki havuza bir tane eklenmeli — çekmece modeli keşfedilmesi
gereken bir jest.

## Arapça

`ar.ts` RTL demek ve bu iş tamamen sol/sağ üzerine kurulu. Mevcut kod RTL'i
hiçbir yerde ele almıyor; `I18nProvider` `I18nManager.forceRTL` çağırıyor
(`src/i18n/I18nProvider.tsx:74`), yani düzen aynalanıyor ama `translateX`
işaretleri aynalanmıyor. Arapça'da çekme yönlerinin ters düşüp düşmediğini
uygulama sırasında kontrol et — bu bugün de var olan bir sorun, rework onu
görünür kılıyor.

---

# İş 8 — "Say it for them" → "Record"

Branch: `record-label` (origin/main'den). Tek anahtarın değeri, sekiz dosya.

`feed.answerThis` (`en.ts:673`) üç yerde çiziliyor:

| Yer | Ne yapıyor |
| --- | --- |
| `post/[id].tsx:535` | **Gerçekten kaydediyor** — `toggleRecording('fast')` |
| `post/[id].tsx:618` | Composer'ı açıyor (kaydın yapılacağı yer) |
| `feed.tsx:576` | Post ekranına **gidiyor**, kaydetmiyor |

Anahtar adı değişmez (`answerThis` anlamlı ve yeniden adlandırmak sekiz dosyada
tip hatası demek), sadece **değer** değişir. Sekiz katalog: en 673, tr 644,
es 635, ru 733, ar 772, fr 636, de 653, pt-BR 628.

Bunun bir yan faydası var: aynı butonun diğer hâli zaten
`feed.recordAgain: 'Record again'` (`:678`). Bugün "Say it for them" →
"Record again" çifti tutarsız; "Record" → "Record again" doğru çift.

**Yanında kalan tutarsızlık, bilerek dokunmadım:** `feed` bloğunun tamamı
"say it out loud / for them" sesiyle yazılmış — `slowTake: 'Said slowly'`,
`pronounceEmptyTitle: 'Nothing to say out loud'`, `answersEmptyBody: 'Be the
first to say it out loud.'` Bir tanesini "Record" yapmak diğerlerini biraz
yalnız bırakıyor. Tüm kümeyi kayıt diline çevirmemi istersen ayrı bir geçiş —
söyle, sekiz katalogda yaparım.

---

# İş 9 — Tip çeşitliliği ve rotasyon

Branch: `tip-rotation` (origin/main'den).

## Neden hep aynı tip çıkıyor

Altyapı eksik değil — **kullanılmıyor**. `src/lib/tips.ts` dört tip tanımlıyor:

```ts
export const TIP_IDS = ['chatCorrect', 'chatSwipeReply', 'discoverFilters', 'feedAsk'] as const
```

Dördü de sekiz dile çevrilmiş. Ama tüm uygulamada **tek bir `<Tip/>` var**
(`chat/[id].tsx:707`, `id="chatCorrect"`). `chatSwipeReply`, `discoverFilters`
ve `feedAsk` hiçbir yerde render edilmiyor. Gördüğün "hep aynı tip" bunun
doğrudan sonucu.

Ayrıca `TipProps` `{ id, body }` alıyor — id hem dismiss kimliği hem içerik
seçici, yani **bir id = bir sabit cümle**. Rotasyonu engelleyen bağ bu.

## Yapılacak

**1. Havuz kavramı.** `TipProps` yerine ekran başına bir *slot*:

```ts
export const TIP_SLOTS = {
  chat: ['chatCorrect', 'chatSwipeReply', 'chatStar', 'chatVoice', 'chatTranslate'],
  chats: ['chatsSwipeActions', 'chatsPin', 'chatsArchive'],
  discover: ['discoverFilters', 'discoverRadius', 'discoverLanguagePair'],
  feed: ['feedAsk', 'feedPronounce', 'feedCorrect'],
} as const
```

`<Tip slot="chat" />` havuzdan **dismiss edilmemiş** olanlardan birini seçer.
Seçim mount başına ve deterministik olmayan değil — bir sıra tutulup sırayla
ilerlenmesi ("her açılışta bir sonraki") rastgeleden iyi: kullanıcı aynı ipucunu
üst üste görmez ve havuzu tüketmesi öngörülebilir olur.

**2. `TipState`'e sıra alanı.** Bugün `{ enabled, dismissed }`. Slot başına bir
imleç eklenir. `parseTipState` bilinmeyen anahtarları zaten eleyor, aynı
titizlik korunacak.

**Dikkat:** `setTipsEnabled(true)` tüm dismiss'leri **siliyor**
(`tips.ts:70-71`) ve `tips.test.ts:42-51` bunu kilitliyor. İmleç eklenirken bu
davranış bozulmamalı — mevcut altı test aynen geçmeli.

**3. Tip'leri gerçekten mount et.** Bugün yazılıp render edilmeyen üç id dahil,
her slot ilgili ekrana bağlanır: `chats.tsx`, `discover.tsx`, `feed.tsx`.
Liste ekranlarında `chat/[id].tsx`'in çözdüğü sorun yok (o ters çevrilmiş
liste), o yüzden yerleşim her ekranda ayrı düşünülecek — kaydırılıp geçilen bir
yere koyma.

**4. Composer'ın altındaki sabit satır da dönsün.** `chat/[id].tsx:1000-1010`,
sol yarı `chat.holdToCorrect`. Bugün koşulsuz, kapatılamaz, ayarlardaki tip
anahtarına tabi değil ve üstündeki sarı tiple **aynı şeyi söylüyor**. Sol yarı
kısa ipuçları havuzuna bağlanır (`chat.holdToCorrect`, "yıldızla", "kaydırıp
yanıtla", "sesli not gönder"…), `tips.enabled` false ise hiç çizilmez. Sağ
yarıdaki `chat.tokensPerMessage` bilgi, ipucu değil — aynen kalır.

**5. Yeni tip metinleri.** Havuz ancak içi doluysa çeşitli. Yukarıdaki slot
listesindeki her yeni id için sekiz dilde metin gerekiyor. `tips` bloğunun
mevcut sesi kısa ve iddiasız ("Swipe a message to the right to reply to it.") —
ona uyulacak.

**6. Üçüz tekrarı çöz.** Aynı ders üç yerde yazılı:
`tips.chatCorrect`, `chat.holdToCorrect`, ve `corrections.emptyBody`
("Hold a message in a chat and choose Correct — it is the most useful thing you
can do here."). Havuz kurulduktan sonra en az biri yeniden yazılmalı.

## Testler

`src/lib/tips.test.ts` genişletilir (saf modül, vitest görüyor): imleç ilerliyor
mu, dismiss edilmiş id atlanıyor mu, havuzun tamamı dismiss edilince ne oluyor
(hiçbir şey çizilmemeli), `setTipsEnabled(true)` imleci ve dismiss'leri doğru
sıfırlıyor mu.

---

# Doğrulama

## Otomatik

- `apps/mobile/src/lib/appReady.test.ts` — latch tek yönlü; `markAppReady()` iki
  kez çağrılınca bir kez haber verir; birden çok abone; unsubscribe gerçekten
  ayırır; `resetAppReadyForTest()` hem bayrağı hem listener'ları temizler.
  `src/lib/toast.test.ts` idiomunu izle.
- `apps/mobile/src/lib/splashTiming.test.ts` — `msUntilExitAllowed` hızlı boot'ta
  kalanı, yavaş boot'ta 0 döner, asla negatif değil.
- i18n paritesi: `src/i18n/catalogs.test.ts` yeni `media.*`, `chat.*`, `photo.*`
  anahtarlarını sekiz dilde arar, eksikse kırılır.
- `src/lib/pendingMedia.test.ts` — ekleme/kaldırma, ack ile retire, üst zaman
  sınırı, `MAX` davranışı (`unsentMessages.ts` idiomu).
- `src/lib/uploadProgress.test.ts` — aşama geçişleri (`reading` → `uploading` →
  `sending`), oran [0,1]'e clamp'li, geriye gitmiyor, sıfır byte'lık dosyada
  bölme hatası yok.
- `src/lib/pinch.test.ts` — iki dokunuş mesafesi, `clampScale` [1,4],
  `clampOffset` her ölçekte görüntüyü çerçeve içinde tutuyor, `scale === 1`'de
  offset daima sıfır.
- `putWithProgress.ts` ve `PhotoViewer.tsx` birim testlenemez (node'da
  `XMLHttpRequest` yok, vitest `react-native` yükleyemiyor) — mantığı yukarıdaki
  saf modüllerde tut.
- `AppSplash.tsx` ve `pickImageAsset.ts` **birim testlenemez**: vitest
  `react-native` yükleyemiyor (`vitest.config.ts` sadece `src/lib/**` + `src/i18n/**`,
  ve `pickImageAsset` `expo-image-picker` import ediyor). Denemeyin.
- Config doğrulaması (hiçbir şey yazmaz):
  `cd apps/mobile && npx expo config --type introspect --platform android`
  → plugin çözülüyor mu, asset yolları var mı, `splashscreen_background` ne çıktı.
  Aynısını `--platform ios` ile.
- CI dörtlüsü: `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`.

## Elle / Playwright (droplet)

İzole doğrulama yığını (`:4100` API + `:8082` Expo, paylaşılan `:4000`'e
dokunmadan; Metro için inotify limitleri yükseltilmiş olmalı):

- **Splash, mutlu yol:** `page.goto('/')`, t≈0'da `[data-testid="app-splash"]`
  var; 300 ms ve 1200 ms'de ekran görüntüsü; ~2 s'de DOM'dan düşmüş.
- **Splash, timeout:** yığının Expo'sunu **ölü** bir API'ye bağla → `useMe()`
  asılı kalır → ~5.3 s'de splash gitmiş ve altında `ActivityIndicator` görünür.
- **Splash, deep link:** `page.goto('/somehandle')` → 5 s beklemeden çıkıyor
  (pathname fallback'i çalışıyor).
- **Splash, reduce motion:** `page.emulateMedia({ reducedMotion: 'reduce' })`.
- **Splash, bakım modu:** sahte API `maintenance.enabled` dönsün → splash hemen
  bakım ekranına açılıyor.
- **Kamera, web:** foto butonuna bas → diyalog **çıkmamalı**, doğrudan dosya
  seçici.
- **Chats başlığı:** 390px genişlikte viewport'ta `/chats` → büyüteç ve yıldız
  sağda bitişik, "Chats" solda. Arama açıkken alan tamamen `PeopleSearch`'ün.
  Önce/sonra ekran görüntüsü.
- **Bekleyen balon:** izole yığında bir sohbete foto gönder; balon **anında**
  çıkıyor, yerel thumbnail görünüyor, yüzde ilerliyor, ack gelince gerçek balona
  dönüşüyor ve iki balon birden görünmüyor (dedupe). Ağı throttle'layarak
  (`page.route` ile gecikme, ya da CDP `Network.emulateNetworkConditions`)
  yüzdenin gerçekten aktığını gör. Bucket PUT'unu 500 döndürterek `failed`
  aşamasını ve tekrar-dene dokunuşunu doğrula.
- **Ses balonu:** kayıt yapıp gönder; `trackFill` dolgusu ilerliyor.
- **Tam ekran + zoom:** Playwright context'i **`hasTouch: true`** ile; sohbetteki
  görsele dokun → viewer açılıyor; `page.touchscreen` ile iki parmak pinch
  simüle et (ya da en azından çift dokunuş 1x↔2x'i doğrula), sınırlara clamp,
  arka plana dokunup kapatma, foto değişince zoom sıfırlanıyor. Feed, post
  detayı ve profil şeridinden de aynı viewer açılıyor.
- **Türetilen şehir:** izole yığında `seed-cities.ts --apply`, sonra bir profile
  bilinen bir koordinat yaz (`POST /profiles/me/location`) → `cityName` doğru
  çözülüyor mu; okyanus koordinatı → şehirsiz; `DELETE /profiles/me/location` →
  şehir de siliniyor. `privacy.hideCity` açıkken başka bir kullanıcının gördüğü
  profilde şehir yok, kendi `GET /profiles/me`'sinde var.
- **Şehir dropdown'u:** filtrede üç harf yaz → aday listesi geliyor, seçince
  `cityId` yazılıyor, sonuçlar filtreleniyor; koordinatı olmayan kullanıcı
  listede çıkmıyor.
- **Çekmece:** `hasTouch: true` context'te sola çek → Archive ve Delete kareleri
  açık kalıyor, dokununca çalışıyor; sağa çek → Pin. Başka satır açılınca önceki
  kapanıyor. Açık satırda ikinci kez çekmek sıçratmıyor (birikimli offset).
  Arapça'ya geçip yönlerin aynalandığını da kontrol et.
  Klavye/ekran okuyucu yolu: `accessibilityActions` ile üç aksiyon da jestsiz
  ulaşılabiliyor. Masaüstü web'de uzun basma menüsünde Delete var.
- **Sohbet silme:** izole yığında sil → listeden kalkıyor; karşı taraftaki
  hesapta thread ve mesajlar duruyor; karşı taraf yazınca bende thread **boş**
  geri geliyor. Onay diyaloğu kırmızı ve iptal edilebiliyor.
- **Tipler:** sohbeti üst üste aç — her seferinde farklı ipucu; hepsini dismiss
  et → hiç tip çıkmıyor; ayarlardan tipleri kapat → hem sarı tip hem composer
  satırının sol yarısı kayboluyor; tekrar aç → havuz sıfırlanıyor.
- **Swipe katmanı:** Playwright context'ini **`hasTouch: true`** ile aç —
  `rowSwipeEnabled` web'de dokunma olmadan katmanı hiç render etmiyor, bu bayrak
  olmadan bug'ı ne görebilir ne de düzeltildiğini doğrulayabilirsin. Beklenen:
  satır dururken Archive ikonu/etiketi **görünmüyor**, sola kaydırınca çıkıyor,
  zaman damgası hiçbir anda üstüne binmiyor.
- **Kamera, native:** bu makinede yapılamaz. Android APK / dev build gerekir
  (iPhone Expo Go bu projeyi açamıyor). Beş giriş noktasının beşinde de diyalog,
  kamera izni akışı, iptal, ve avatar/onboarding'de kare kırpmanın kamera
  çekiminde de çalıştığı elle kontrol edilecek.
- **Splash, native:** `npx expo prebuild` + dev build; açık/koyu soğuk açılış,
  sistemle çelişen tema tercihi, Android 12+ daire maskesi ile JS rozetinin
  örtüşmesi, devir teslim karesi (60 fps kayıt alıp kare kare bakmak tek yol).

---

# Notlar

- Beş iş beş ayrı branch/PR; sıra ve çakışmalar için baştaki tabloya bak.
  `langx/` paylaşılan checkout — başlamadan
  `git status` ve `ListAgents` ile eşzamanlı oturum var mı bak, ve `origin/main`'den
  dallan (yereldeki `main` başkalarının push'lanmamış commit'lerini taşıyabiliyor).
  Paralel gidilecekse `/root/wt-*` altında worktree aç ve her worktree'de ayrı
  `pnpm install`.
- `langx/` için merge yöntemi rebase.
- Kodda ve yorumlarda dil İngilizce.
