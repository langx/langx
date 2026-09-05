# Ürün yol haritası — yedi fikrin teknik değerlendirmesi

Bu dosya iki bölüm: **(A)** son turda gelen altı fikrin kodun içinde
doğrulanmış değerlendirmesi ve önerilen sıra, **(B)** daha önce tam olarak
planlanmış referral programı (aşağıda korunuyor, kararı bekliyor).

## Durum — 1 Eylül 2026

**Referral dahil beş madde bitti, merge edildi ve canlıda.** `origin/main` =
`0b8478ec`.

| PR | Madde | Durum |
| --- | --- | --- |
| #1033 | #0 + #0b — `onlyMyGender` ücretsiz, `gender` tek yönlü kilit | merge, canlı |
| #1034 | #7 — kozmetik merdiveni | merge, canlı |
| #1035 | #6 — sesli mesajda yavaş çalma | merge, canlı |
| #1036 | #1a — ilk 5 mesajda medya yok | merge, canlı |
| **#1039** | **Referral programı (planın EK bölümü)** | **merge, canlı** |
| #1040 | Davet kutucuklarının etiket düzeltmesi | merge, canlı |

Referral, plandan iki yerde ayrıldı ve ikisi de #1038'in araya girmesinden:
`pronunciation` üçüncü bir kazanç yolu olarak aktivasyonu tetikliyor, ve
`isEmailVerified` yaprak modüle taşındı (planın öngördüğü import döngüsü).

Kalan maddeler hâlâ cevap bekliyor: #1b istekler kutusu, #2 spam sinyali,
#3 haftalık özet, #4 günün cümlesi, #5 paylaşım kartı.

## Durum — 31 Ağustos 2026

**Dört madde bitti, merge edildi ve canlıda.** `origin/main` = `a0f2ac9b`.

| PR | Madde | Durum |
| --- | --- | --- |
| #1033 | #0 + #0b — `onlyMyGender` ücretsiz, `gender` tek yönlü kilit | merge, canlı |
| #1034 | #7 — kozmetik merdiveni | merge, canlı |
| #1035 | #6 — sesli mesajda yavaş çalma | merge, canlı |
| #1036 | #1a — ilk 5 mesajda medya yok | merge, canlı |

Deploy: `flyctl deploy -a langx-api` (api2, üretim DB `langx`) ve
`wrangler pages deploy dist --project-name langx-web` (app2). İkisi de elle;
repoda deploy workflow'u yok, yalnızca `ci.yml`.

Ekran görüntüleri: `/root/shots/out/`.

**Kalan maddeler cevap bekliyor** — #1b, #2, #3, #4, #5 ve referral. Açık uçlar
en altta.

## Verilmiş kararlar

- **Medya kuralı: düz 5 mesaj.** İstisnasız — kabul, plan, tanışıklık fark
  etmez. Slogan ("Hiç kimse tarafından") ancak Pro'nun da muaf olmadığı bir
  kuralda doğru. Kabul kapısına bağlanmıyor, yani #1a ile #1b birbirinden
  bağımsız kalıyor.
- **Spam sinyalinde cinsiyet girdisi yok.** Yalnızca davranış: cevap oranı ve
  tekrar eden açılış cümlesi.
- **`gender` tek yönlü kapı.** `undisclosed` → gerçek bir değer bir kez
  yazılabilir; sonrası kilitli.
- **Kozmetik merdiveni "bir önceki" kuralı**, ve welcome pack merdivenin ilk
  basamaklarını verir.
- **Hiçbiri henüz başlamıyor** — plan bitmeden kod yazılmayacak.

## Özet tablo

| # | Fikir | Gerçek maliyet | Not |
| --- | --- | --- | --- |
| 0 | "Sadece kendi cinsiyetim" ücretsiz | **En küçük** | API'de kod değişikliği yok; asıl iş `decisions.md`'deki gerekçenin değiştirilmesi. |
| 0b | `gender` düzenlenemez olsun | Küçük | `birthDate` zaten böyle; eksik kalan yarısı. Tek yönlü kapı kararlaştırıldı. |
| 7 | Kozmetikler sırayla alınsın | Küçük kod, **ürün kararı** | Merdiven zaten fiyat sırasında var. Asıl mesele: welcome pack merdivenin 2., 4., 7. basamağını hediye ediyor. |
| 6 | Sesli mesajda yavaş tekrar | **~1 saat** | `expo-audio` `playbackRate`'i zaten destekliyor. Backend yok, şema yok. |
| 1a | "İlk 5 mesajda fotoğraf yok" | **Küçük** | Slogan bu; mekanizma istekler kutusundan bağımsız ve daha basit. |
| 1b | İstekler kutusu | Orta | `bothSpoke` zaten var ve istemcide hiç okunmuyor. |
| 4 | Günün cümlesi | Orta | Feed zaten tam olarak bu şekil. Gizli maliyet: promptun 8 dile çevrilmesi. |
| 3 | Haftalık özet kartı | Orta-büyük | Örnek cümlenin üç parçasından **biri** bedava, biri hesaplanmalı, biri hiç yok. |
| 2 | Spam sinyali | Orta kod, **yüksek yargı riski** | Repo public — bu, bilinmesi işe yaramayan ilk kural değil, bilinince atlatılabilen ilk kural. |
| 5 | Before/after paylaşım kartı | **En büyük** | Ne sunucuda ne istemcide raster üretme yolu var. Üç seçenek de yazılı bir kısıtı çiğniyor. |

---

## 0. "Sadece kendi cinsiyetim" filtresi ücretsiz olsun

Listenin en ucuzu ve tek başına bağımsız. Sunucuda **kod değişikliği yok**:
`discovery.ts:128` `DISCOVERY_PRO_FILTER_KEYS` dizisini döngüyle okuyor, yani
anahtarı listeden çıkarmak kapıyı da açıyor.

```ts
// packages/shared/src/discovery.ts:79
export const DISCOVERY_PRO_FILTER_KEYS = ['gender', 'city'] as const
```

### Yeni gerekçe ve neden eskisinin *silinmesi* gerekiyor

`docs/decisions.md:933-938` şu an şunu yazıyor:

> **It is paid, deliberately.** It was raised as a question — it is the one
> filter people use for safety rather than preference, and safety behind a
> paywall reads differently from convenience behind one — and the answer was to
> keep it paid.

Bu paragraf **değiştirilmeli, üstüne eklenmemeli.** Güvenlik çerçevesini
koruyup filtreyi ücretsiz yapmak, reponun kendi geçmişini "bir süre güvenliği
paraya bağlamıştık" diye okutur. Senin gerekçen o çerçeveyi tamamen emekliye
ayırıyor, ki doğrusu da bu: filtre bir güvenlik aracı değil, bir konfor
ayarı — ve zaten küçük olan bir havuzu daha da daraltan bir ayarı satmak,
ücretsiz kullanıcıya "burada kimse yok" duygusunu satmak demek.

### Ödeme duvarının yeni kuralı — eski itiraza cevap

Eski karar bölmeyi şu gerekçeyle reddetmişti: *"It is a gender filter, the
server gates those together, and splitting one of them out would make the
paywall's rule harder to explain than it is worth."* Yeni kural bu itirazı
karşılıyor ve aslında eskisinden daha net:

> **Ücretli filtreler başkasının bir özelliğini adlandırır; ücretsiz olan
> yalnızca seninkini.**

Kodun kendisi bunu zaten söylüyor: `gender` ve `city` bir *değer* alıyor
(`gender=female`, `city=Istanbul`) — hedefleme yeteneği. `onlyMyGender` değer
almıyor; sunucuda kendi profilinden çözülüyor (`discovery.ts:189`) ve
cinsiyetini belirtmemişsen **etkisiz**. Onunla kimseyi hedefleyemezsin,
yapabildiği tek şey kendi gördüğünü daraltmak. Bu ayrım zaten belgelenmiş olan
"sunucuda çözülür" kararının (`decisions.md:924-931`) doğal devamı.

`DISCOVERY_PRO_FILTER_KEYS`'in üstündeki doküman yorumu da bu yüzden yeniden
yazılmalı: bugünkü *"what stays paid is the pair that narrows **who**, not how
well they fit"* çerçevesi artık tutmuyor, çünkü `onlyMyGender` de *kimi*
daraltıyor. Yeni çerçeve yukarıdaki cümle.

### Dokunulacak yerler

| Dosya | Değişiklik |
| --- | --- |
| `packages/shared/src/discovery.ts:79` | Anahtarı listeden çıkar |
| `packages/shared/src/discovery.ts:63-78` | Doküman yorumunu yeni kuralla yeniden yaz |
| `packages/shared/src/discovery.ts:125` | `onlyMyGender`'ı "Free filters" grubuna taşı |
| `packages/shared/src/discovery.ts:145-147` | **Değişmiyor** — `onlyMyGender` + `gender` birlikte hâlâ reddediliyor; artık `UPGRADE_REQUIRED` yerine `VALIDATION_FAILED` dönüyor, ki doğru hata bu |
| `apps/api/src/modules/discovery/discovery.ts` | **Kod değişikliği yok** (`:128` diziyi okuyor) |
| `apps/mobile/app/(app)/filters.tsx:278-296` | Toggle'ı `isPro` bloğundan (`:73`, kilit `:320`) çıkar; cinsiyet çipleri (`:258-276`) kilitli kalır |
| `apps/mobile/src/lib/discoveryFilters.ts:24-28` | "Pro from here down" yorumu yanlış hale geliyor; `onlyMyGender` çizginin üstüne taşınır |
| 8 katalog: `paywall.advancedFiltersBody` | "Search by gender and city." teknik olarak doğru kalıyor ama artık yanıltıcı — "belirli bir cinsiyete ve şehre göre ara" gibi netleştir |
| `docs/decisions.md:933-938` | Paragrafı **değiştir** (yukarıdaki gerekçe) |
| `apps/api/src/routes/discovery.test.ts` | Ücretsiz hesabın `onlyMyGender`'da `UPGRADE_REQUIRED` aldığını iddia eden vaka ters çevrilir; cinsiyeti `undisclosed` olan kullanıcıda etkisizliğin ücretsiz tarafta da sürdüğü eklenir |

**Repo dışı:** `website/src/lib/data/features.ts` (PLAN_LIMITS aynası) ve
`langx/docs/legal/promise-change.md` — o belge filtreleri, v2'nin "sonsuza
kadar ücretsiz"den geri aldığı üç şeyden biri olarak sayıyor; bu değişiklik
geri verilenin bir kısmını daha büyütüyor, yayınlanmadan önce güncellenmeli.

`PLAN_LIMITS.advancedFilters` ve `PRO_FEATURES` **kalıyor** — bayrak `gender`
ve `city` için hâlâ gerekli.

---

## 0b. `gender` profil güncellemesinden kaldırılsın

Bugün iki yerde: `packages/shared/src/profile.ts:183`
(`updateProfileSchema` içinde `gender: genderSchema`) ve
`apps/mobile/app/(app)/edit-profile.tsx:90,143,246-252` (durum, payload ve
seçici).

**Emsal zaten var ve bu kararı kolaylaştırıyor:** `birthDate`
`onboardingProfileSchema`'da var ama `updateProfileSchema`'da **yok** — yani
doğum tarihi bugün bile bir kez yazılıp bir daha değiştirilemeyen bir alan.
Gerekçe de aynı: ikisi de başkalarının filtrelediği, keşifte `$match`'e giren
alanlar (`discovery.ts:183-189`, yaş için `:birthDate` bandı). Değiştirilebilir
bir filtre girdisi, istediğin zaman başkalarının sonuç listesinde yer
değiştirebilmek demek. `gender`'ın `birthDate`'in yanına geçmesi yeni bir kural
değil, mevcut kuralın eksik kalmış yarısı.

### Ama bir tuzak var ve karar gerektiriyor

`onlyMyGender`, görüntüleyenin cinsiyeti `undisclosed` ise **etkisiz**
(`discovery.ts:189`, bilerek). Onboarding'de "belirtmek istemiyorum" diyen biri
`gender` tamamen kilitlenirse o filtreyi **hiçbir zaman** kullanamaz — ve #0
ile filtreyi ücretsiz yaptığımız için bu artık daha çok kişiyi ilgilendiriyor.

Dahası `filters.onlyMyGenderMissing` sekiz katalogda şunu diyor:
*"Bunu kullanmak için profiline kendi cinsiyetini ekle."* Tam kilit altında bu
cümle **yalan** olur; ekleyebileceği bir yer kalmaz.

**Karar: tek yönlü kapı.** `undisclosed` → gerçek bir değer bir kez
yazılabilir; gerçek bir değer yazıldıktan sonra hiç değişmez. Kötüye kullanım
gerekçesi korunuyor — geri dönüş olmadığı için ileri geri gidip farklı
insanların sonuç listelerinde belirmek imkânsız — ve tuzak kapanıyor.
`filters.onlyMyGenderMissing` metni olduğu gibi doğru kalıyor, sekiz katalogda
değişiklik gerekmiyor.

Uygulaması bir kontrol değil bir **filtre** olmalı, `attachReferral`'ın
E11000'i ve `wallet.ts`'in `$expr` bakiye kontrolü ile aynı gerekçeyle: iki
eşzamanlı istek "önce oku, sonra yaz"da ikisi birden geçer.

```ts
// { _id, gender: 'undisclosed' } filtresi kapının kendisi. Eşleşme yoksa
// cinsiyet zaten belirtilmiş demektir ve istek sessizce hiçbir şey yapmaz.
await profiles.updateOne(
  { _id: userId, gender: 'undisclosed' },
  { $set: { gender: input.gender, updatedAt: now } },
)
```

Bu, `updateProfileSchema`'nın parçası **değil** — ayrı bir uç nokta
(`POST /profiles/me/gender`) ve ayrı bir şema (`female | male | other`,
`undisclosed` yok, çünkü geri dönüş yok). Genel güncelleme gövdesine
opsiyonel bir alan olarak koymak, "bir kez yazılır" kuralını şemadan
okunamaz hale getirir.

### Dokunulacak yerler

| Dosya | Değişiklik |
| --- | --- |
| `packages/shared/src/profile.ts:183` | `gender`'ı `updateProfileSchema`'dan çıkar; yokluğunu `birthDate` emsaliyle birlikte yorumda gerekçelendir |
| `packages/shared/src/profile.ts` | Tek yönlü kapı seçilirse ayrı bir `discloseGenderSchema` (yalnızca `female\|male\|other`, `undisclosed` yok) |
| `apps/api/src/modules/profiles/profiles.ts` | `updateProfile` girdiyi yayıyor; şemadan çıkması yeterli. Tek yönlü kapı için `{ _id, gender: 'undisclosed' }` filtreli tek bir `updateOne` — kontrol değil, filtre |
| `apps/mobile/app/(app)/edit-profile.tsx:90,143,246-252` | Seçiciyi, durumu ve payload alanını kaldır |
| 8 katalog | `editProfile.gender` kullanımdan düşer. `genderLabel` **kalıyor** — onboarding ve filtreler hâlâ kullanıyor |
| 8 katalog | `filters.onlyMyGenderMissing` — tam kilit seçilirse yeniden yazılmalı |
| `apps/api/src/routes/profiles.test.ts` | `PATCH /profiles/me` ile `gender` göndermenin artık yok sayıldığını (zod `strip`) iddia eden vaka |
| `docs/architecture.md` | Profil şeması bölümünde `gender`'ı `birthDate` ile aynı "set-once" grubuna al |
| `docs/decisions.md` | Yeni giriş: *"gender is set once, like birthDate"* — gerekçe: keşif filtresi girdisi |

**Üretim verisi uyarısı:** doğum tarihleri prod'da elle `1990-01-01` yapılmıştı;
`gender` verisinin ne kadarının gerçek olduğu bilinmiyor. Alan kilitlenmeden
önce prod'da `gender` dağılımına bakmak gerekiyor — kilitledikten sonra yanlış
bir değeri düzeltmenin uygulama içinde hiçbir yolu kalmıyor.

---

## 7. Frame ve title'lar sırayla satın alınsın

**Merdiven zaten var, eksik olan kapı.** `packages/shared/src/cosmetics.ts`
içindeki `COSMETICS` dizisi her iki tür için de fiyat sırasına dizili:
frame'ler 1.000 → 50.000 (slate, bronze, sky, silver, mint, ember, gold,
violet, midnight, aurora), title'lar 1.500 → 100.000 (beginner … legend).
Yani kural `previousOf(cosmetic)` — aynı `kind` içinde bir önceki eleman.

### Kapı nereye gidiyor

`purchase` (`apps/api/src/modules/tokens/wallet.ts:73`) zaten tam olarak bu
şekle sahip: atan bir ön kontrol, ve atomik filtre içinde mümkün olanın
yeniden kontrolü. Sıra kapısı bu fonksiyondaki **en temiz kapı** olacak,
çünkü mevcut `requires` kapısının yapamadığı şeyi yapabiliyor:

```ts
// Ön kontrol — iyi bir hata mesajı için (satır ~104'teki requires bloğunun yanı)
const previous = previousCosmetic(cosmetic)
if (previous && !(profile.cosmetics ?? []).includes(previous.id)) {
  throw new ApiError(ERROR_CODES.VALIDATION_FAILED, `${previous.id} comes first`)
}

// Atomik filtre — satır ~136'daki `cosmetics: { $ne: sku }` ile aynı alanda
...(previous ? { cosmetics: { $all: [previous.id] } } : {}),
```

`corrections` kapısı atomik olarak kontrol edilemiyor (ledger'dan sayılıyor,
`wallet.ts:99-102` bunu açıkça kabul ediyor). Sahiplik ise **bu dokümanın
üzerinde bir alan**, yani filtre içinde tam olarak doğrulanabiliyor — ekstra
sorgu yok, `$expr` yok, sadece bir dizi içerme kontrolü.

Ayrıca `CosmeticRequirement`'ın doküman yorumundaki invaryantı sağlıyor:
*"Both fields are **monotonic** … a gate that could go down would let an item
be owned and then un-ownable."* Sahiplik de monotonik — kozmetik hiç geri
alınmıyor — yani sıra kapısı aynı sınıfa ait.

`frame.aurora`'nın mevcut `requires` kapısı (365 gün streak + 5.000 düzeltme)
bununla **birleşiyor**: hem midnight'a sahip olmak hem de kapıyı geçmek
gerekiyor.

### Ekonomiye etkisi — toplam sink değişmiyor, *sıra* değişiyor

Katalog toplamı ~395.000 ve bu rakam değişmiyor. Değişen şey prestij
ürününü erken satın alamamak. Bugün 100.000 biriktiren biri doğrudan
`title.legend` alıp diğer dokuzunu görmezden gelebiliyor; merdivenle
Legend'a ulaşmak kümülatif **231.500** demek. `cosmetics.ts`'in kendi
gerekçesi (*"aspirational without being decorative"*) tam olarak bunu
istiyor — bugünkü hâli o niyeti fiyatla ifade ediyor ama uygulamıyor.

### İki kural şekli, ve neden ayrıştıkları

- **(a) Bir önceki:** aynı türde hemen alttakine sahip ol.
- **(b) Tüm alttakiler:** aynı türde daha ucuz olan her şeye sahip ol.

Hiçbir şey sırayı atlayarak vermeseydi bunlar tümevarımla aynı şey olurdu.
**Ama `PRO_WELCOME_PACKS` tam olarak bunu yapıyor** ve asıl mesele bu.

### Asıl karar: welcome pack merdivenle tutarsız hale geliyor

```ts
pro:      { cosmetics: ['frame.bronze'] }                                    // 2. basamak
pro_plus: { cosmetics: ['frame.bronze','frame.silver','frame.gold',          // 2., 4., 7. basamak
                        'title.learner'] }                                   // 2. basamak
```

Bir merdivenin 2., 4. ve 7. basamağını hediye etmek tutarsız: kullanıcı
sahip olmadığı basamakların üstünde duruyor. (a) kuralında delikleri
umursamadan yukarı devam edebiliyor; (b) kuralında ilerlemeden önce
delikleri doldurmak zorunda.

**Karar: pack ilk basamakları versin, kural (a) "bir önceki" olsun.**

```ts
pro:      { cosmetics: ['frame.slate', 'frame.bronze'], streakFreezes: 2 }
pro_plus: { cosmetics: ['frame.slate', 'frame.bronze', 'frame.sky', 'frame.silver',
                        'title.beginner', 'title.learner'], streakFreezes: 2 }
```

İkisi birlikte seçildi çünkü **delik kalmayınca (a) ile (b) aynı şeye
düşüyor** — tümevarımla, bitişik basamaklarla başlayan biri her zaman bir
alttakine sahiptir. Yani kullanıcıya açıklanacak tek bir kural kalıyor:
*"bir sonrakini almak için bir öncekine sahip olman gerekiyor."*

Kural yine de (a) olarak yazılmalı, (b) olarak değil — çünkü **mevcut
aboneler**: `welcomePackAt` tier başına mandallı, yani bugün bronze/silver/gold
almış bir pro_plus kullanıcısı onları koruyor ve deliklerle kalıyor. (a) o
kişiyi bloklamaz; (b) onu, abonelik hediyesinden *önceki* basamakları geri
dönüp satın almaya zorlardı.

`welcomePackDelta` bu değişikliği zaten doğru karşılıyor: *"grant what this
tier includes and you do not already own"* — mevcut bir pro kullanıcısı
pro_plus'a yükseldiğinde farkı alıyor, iki kez bir şey almıyor.

Not: `title.beginner` de pack'e ekleniyor, çünkü pro_plus bugün
`title.learner`'ı (2. basamak) 1. basamak olmadan veriyor — frame'lerdeki
aynı tutarsızlığın title tarafındaki hâli.

### Diziyi yük taşıyan hale getirmenin bedeli

Bugün `COSMETICS` sırası **sunumsal** — kimse ona dayanmıyor. Bu değişiklikten
sonra sıra **kuralın kendisi** oluyor. Yani:

- `packages/shared/src/rules.test.ts`'e bir iddia: her `kind` içinde fiyatlar
  **kesin artan**. Aksi halde merdiven ile fiyatlar sessizce çelişir (birinin
  araya daha pahalı bir şey eklemesi yeterli).
- Araya sonradan bir basamak eklemek yeni bir zorunlu rung yaratır; üstündekine
  zaten sahip olanlar etkilenmez, henüz oraya gelmemişler için sıra uzar.
  Kabul edilebilir, ama yazılmalı.

### Dokunulacak yerler

| Dosya | Değişiklik |
| --- | --- |
| `packages/shared/src/cosmetics.ts` | `previousCosmetic(cosmetic)`; `COSMETICS` yorumuna sıranın artık kural olduğu notu |
| `apps/api/src/modules/tokens/wallet.ts:104-115` | Ön kontrol bloğu |
| `apps/api/src/modules/tokens/wallet.ts:127-143` | Atomik filtreye `cosmetics: { $all: [previous.id] }` |
| `packages/shared/src/cosmetics.ts` `PRO_WELCOME_PACKS` | Yukarıdaki karara göre |
| `apps/mobile/src/lib/storeOffers.ts` | Kilitli satır durumu — `frame.aurora` için zaten var, gerekçesi "önce şunu al" olarak genişler |
| `apps/mobile/app/(app)/wallet.tsx` | On kilitli satır göstermek kötü UX; "sıradaki basamak + önizleme" düşünülmeli |
| 8 katalog | Yeni kilit gerekçesi metni |
| `packages/shared/src/rules.test.ts` | Tür içi kesin artan fiyat iddiası |
| `apps/api/src/routes/leaderboard.test.ts` | Sıra atlayan satın almanın reddedildiği, sıralı olanın geçtiği, ve iki eşzamanlı isteğin filtreyle durduğu vakalar |
| `docs/decisions.md` | Yeni giriş: sıra artık kural, ve welcome pack kararının gerekçesi |

**Repo dışı:** `website/src/lib/data/token.ts` kozmetikleri aynalıyor
(REPO_MAP'teki `cosmetics.ts` → `token.ts` bağı) — merdiven kuralı orada da
anlatılmalı.

`defaultEquipped` etkilenmiyor: "sahip olunan en pahalı" merdivende zaten
"en son alınan" demek.

---

## 6. Sesli mesajda yavaş tekrar — listedeki en yüksek getiri

**Bulgu bu fikrin cevabını değiştiriyor.** `expo-audio@57.0.4` zaten kurulu ve
`AudioPlayer` üzerinde şunları açıyor:

```ts
playbackRate: number          // Android 0.1–2.0, iOS 0.0–2.0
shouldCorrectPitch: boolean
setPlaybackRate(rate: number, pitchCorrectionQuality?: 'low'|'medium'|'high'): void
```

Uygulamada tek `useAudioPlayer` çağrısı var: `src/components/MediaBubble.tsx:32`.
Yani **0.5× / 1× geçiş düğmesi, `AudioBubble` içinde birkaç satır.** Sunucu
değişikliği yok, şema yok, ikinci upload yok, kota kararı yok, OTA ile çıkar.

Gerçek ikinci kayıt (konuşanın cümleyi yeniden, tane tane söylemesi) farklı bir
şey ve maliyeti gerçek: `Media` her yerde **tek bir nesne** (`Message.media`,
`Post.media`, `PostCorrectionDoc.media` hepsi `?: Media`), dizi yapmak
`messageView.ts`, `previewFor`, `AudioBubble`, `ImageBubble` ve `feed.ts`'teki
dört `...(doc.media ? … )` yayılımını kırar — ucuz olan ikinci bir opsiyonel
alan (`mediaSlow?`). Ayrıca ikinci dosya için `assertMediaAllowed` **ikinci kez
çağrılmalı**; çağrılmazsa bucket-öneki kontrolü atlanır, ki
`assertMedia.ts:53-58`'in tek işi bir gönderinin rastgele bir host'u
gömmesini engellemek. Ve kota: chat'te ücret olay başına
(`ws/index.ts:185`), feed'de `input.media` varlığı başına
(`feed.ts:343,386`) — iki dosya bir olayda bedava geçer, ki bu
`limits.ts`'in "sonsuza kadar sakladığımız baytlar" gerekçesiyle çelişir.

**Öneri: önce hız düğmesini çıkar.** Değerin çoğunu bir saatte verir; gerçek
ikinci kaydı isteyen çıkarsa o zaman ölç.

---

## 1. Sessiz ilk mesaj filtresi — aslında iki ayrı özellik

Tarifinde iki farklı mekanizma var ve bunları ayırmak işi kolaylaştırıyor:

### 1a. "İlk 5 mesajda fotoğraf gönderilemez. Hiç kimse tarafından."

Düz bir kural: kabul, yabancılık, plan farkı yok. **Pazarlanabilir olan bu**,
çünkü istisnası yok — "hiç kimse tarafından" ancak Pro'nun da muaf olmadığı bir
kuralda doğru.

**Kritik bulgu — kapı gönderimde olamaz.** İstemcide fotoğraf seçmek
göndermektir: `chat/[id].tsx:204` `pickImage()` → doğrudan `sendMedia()` →
`uploadMessageMedia()` → presigned URL'e PUT → sonra socket. Yani `sendMediaMessage`
çalıştığında baytlar **zaten bucket'ta.** Gerçek kapı `POST /messages/upload-url`
(`routes/media.ts:89`), ki orada zaten `assertConversationAccess` var — imza
atılmadan önce erişim kontrol ediliyor, tam da doğru yer.

Sayaç için: `Conversation`'da `messageCount` yok. Ama `recordMessage`
(`messages.ts:87-104`) zaten `$inc: { 'unread.<id>': 1 }` içeren bir
`findOneAndUpdate` yapıyor — aynı yazmaya `$inc: { messageCount: 1 }` eklemek
**sıfır ek round-trip.** Eski konuşmalarda alan yok, `$ifNull` ile 0 sayılır ya
da geriye dönük bir script; ikisi de küçük.

Üç kat: `upload-url` reddi (baytlar hiç inmez), `sendMediaMessage` yedek kemeri,
ve istemcide kamera düğmesinin `disabled` + sebebi söyleyen bir ipucu.

### 1b. İstekler kutusu

**Durum zaten yarı yarıya modellenmiş.** `Conversation.bothSpoke`
(`conversations.ts:38`) tam olarak "karşı taraf cevap verdi mi" demek, her
mesajda güncelleniyor (`messages.ts:85`), `ConversationDto`'da istemciye
gönderiliyor (`queries.ts:264`) ve **uygulamada hiçbir yerde okunmuyor.**
Yani "pending" = `!bothSpoke && firstMessageBy !== me`.

Yeni bir sekme mekanik olarak ucuz: `CONVERSATION_FILTERS`
(`packages/shared/src/chat.ts:272`) tek kelime; `chats.tsx:34` `EMPTY_COPY` bir
`Record` olduğu için boş-durum metni yazmadan **derlemiyor** (bilerek konmuş
kapı); `SegmentedControl` zaten orada.

Dikkat edilecek dört şey:
- **Kota ikinci kez alınmamalı.** `consumeQuota(…,'initiations')` tam olarak bir
  yerde, `conversations.ts:192`. Ne pending yaratmada ne kabulde ikinci bir
  tüketim açılmalı.
- **`bothSpoke` asla sıfırlanmayan bir mandal** (`messages.ts:110-112`) ve v1
  içe aktarımı onu kirletiyor (`legacyConversations.ts:228,324-327`
  `firstMessageBy`'ı geriye taşıyabiliyor). Pending sorgusu v2 doğum tarihiyle
  ya da `legacyId` yokluğuyla sınırlanmalı.
- **Push ayrımı.** `fanOutMessage` (`ws/fanOut.ts:50-52`) şu an her iki tarafa
  da `message:new` yolluyor. Bir isteğin farklı bildirim vermesi isteniyorsa
  değişiklik orada + `PUSH_KINDS`.
- **`participants` multikey**, yani ikinci bir dizi alanıyla compound
  edilemiyor (`indexes.ts:146-173`'teki kural). Pending durumu skaler ya da
  `unread`/`archivedBy` gibi map olmalı.

---

## 4. Günün cümlesi — feed zaten bu şekil

Feed'in kendi doküman yorumu (`packages/shared/src/feed.ts:6-15`) neredeyse bu
fikrin tarifi: *"gece yarısı bir cümlesi olan ve uyanık partneri olmayan
öğrenci, on dakikası olan ve harcayacak kimsesi olmayan öğretmen."* Öğrenme
tarafı zaten var: öğrendiğin dilde yazıyorsun (`feed.ts:337-341`), başkası
düzeltiyor, düzeltme 10 token, `needsCorrection` düzeltilmemişi öne alıyor.

Eklenecek olan ince: `Post`'a `promptDay?: string`, `FEED_FILTERS`'a
`'prompt'` (tek kelime; şemaya, `useFeed`'e ve `SegmentedControl`'e otomatik
akıyor), yeni bir index. **Cursor hiç değişmiyor** — `feedCursor.ts:18-42`
şekle göre ayırıyor, filtreye göre değil; bu kısım gerçekten bedava.

İki tuzak:
- `needsFirst = query.filter === 'needsCorrection'` (`feed.ts:238`) — yeni
  filtre sessizce recency sıralamasına düşer. Prompt sekmesinin de kuyruğu
  boşaltması isteniyorsa o satır ve `feed.ts:249-251` birlikte değişmeli.
- Index **yeni bir isimle** eklenmeli, `needs_correction` genişletilerek değil
  (`indexes.ts:378-385`: canlı bir indeksin anahtarını değiştirmek rebuild
  değil `IndexOptionsConflict`).
- Kişi başına günde tek cevap isteniyorsa `{ promptDay: 1, authorId: 1 }`
  unique — kontrolle değil fiziksel olarak.

**Gizli asıl maliyet: promptun kendisi.** "Herkese aynı kısa cümle" ama insanlar
farklı diller öğreniyor, yani prompt kişinin *anadilinde* gösterilip *hedef
dilinde* yazılıyor (Lang-8 modeli). Günlük dönen bir metin uygulama
kataloğunda gönderilemez — sunucudan, sekiz dile çevrilmiş olarak gelmeli.
`appConfig` mekanik olarak uyar (tek doküman, 10sn cache, açılış yolunda) ama
**uygulamada yazıcı yolu yok**: `updateAppConfig` yalnızca testlerden
çağrılıyor. Yani ya bir `prompts` koleksiyonu + `poolScheduler`/`jobRuns`
deseni, ya elle Atlas düzenlemesi. Bunu peşinen kabul etmek gerekiyor: özellik
kod değil, **içerik operasyonu**.

---

## 3. Haftalık özet kartı — örnek cümlenin üçte biri bedava

Verdiğin cümleyi parça parça kontrol ettim:

| Parça | Durum |
| --- | --- |
| "12 düzeltme yazdın" | **Bedava.** `summary.week` (`dailyActivity.ts:119-141`) yedi UTC günü × `{messages, corrections}` döndürüyor, `tokens.tsx` zaten çekiyor ve **render etmiyor**. Toplamak istemcide bir satır. |
| "3 kişiye" | **Yok.** `dailyActivity.partners` günlük ve yalnızca mesajlar için — `recordActivity` düzeltmelerde `partnerId` geçirmiyor. Haftalık partner kümesi için `messages` üzerinde `{senderId, type:'correction', createdAt aralığı}` + `$addToSet: '$conversationId'` gerekiyor. |
| "2 kişi teşekkür etti" | **Hiç yok.** Teşekkür özelliği yok. Reaksiyonlar (`🙏` dahil) **zaman damgası taşımıyor** — sadece `Record<emoji, userId[]>` — yani "bu hafta" hesaplanamaz. `likes` zaman damgalı ama yalnızca *feed* düzeltmelerini kapsıyor, chat düzeltmelerini değil, ve yazara göre indekslenmemiş. |

Yani bu özellik, göründüğünden bir adım daha derin: **önce chat düzeltmelerine
zaman damgalı bir "teşekkür" gerekiyor.** İyi haber, o küçük bir özellik ve
tek başına değerli — ayrıca #5'in ihtiyaç duyduğu "karşı tarafın onayı"nın
doğal biçimi tam olarak bu.

Dağıtım tarafında iki gerçek engel:
- **Bildirim tercihi yok.** `NOTIFICATION_TYPES` dört tane:
  `messages, streak, profileVisits, promotions`. Haftalık özet bunlardan hiçbiri
  değil; `promotions`'a koymak GDPR gerekçesiyle varsayılan **kapalı** olduğu
  için pratikte kimseye ulaşmaz demek. Beşinci bir tip gerekiyor.
  (Bu arada: hatırladığım "üç ölü anahtar" iki imiş — `profileVisits` ve
  `promotions`; arkalarında hiçbir gönderici yok.)
- **Fan-out ölçeklenmiyor.** `reminderScheduler.ts` kullanıcı başına seri bir
  döngü, her biri 2-3 DB round-trip, ve kullanıcı-locale grubu başına bir Expo
  HTTP çağrısı. İstemci tarafında retry, backoff ya da eşzamanlılık sınırı yok;
  `MessageRateExceeded` bilerek yere bırakılıyor (`devices.ts:149-152`). Tüm
  kullanıcıya haftalık gönderim bu yoldan geçerse gerçek bir toplu-gönderim
  çalışması gerekir.

---

## 2. Spam sinyali — kod orta, yargı riski yüksek

Veri tarafı beklediğinden iyi:

- **Cevap oranı bugün hesaplanabilir, yeni alan gerekmeden.**
  `{ $match: { firstMessageBy: X } }` + `bothSpoke` üzerinden `$group`. Üstelik
  `first_message_by` indeksi (`indexes.ts:170-171`) zaten var, bakımı yapılıyor
  ve **hiçbir sorgu tarafından kullanılmıyor** — yorumu bayat, kota gerçekte
  `profiles.quota.initiations` dizisinde. Tam olarak bu özellik için boşta.
- **Aynı ilk mesaj tespiti de ucuz.** `conversations.lastMessage.body`
  denormalize; `bothSpoke: false` olan bir konuşmada ilk mesaj *odur*. Yani
  `{ firstMessageBy: X, bothSpoke: false }` indeksli sorgusu, `messages`'a hiç
  join yapmadan cevapsız açılış metinlerini veriyor.
- **Depolanan bir skor, mevcut sıralamadan ucuz.** `onlineBucket` hesaplanmış
  olduğu için indekslenemiyor ve `discovery.ts:260-285` bunun "bloke edici bir
  bellek-içi sıralama" olduğunu açıkça kabul ediyor. Gecelik hesaplanıp
  profile yazılan bir skor **indekslenebilir**, yani mevcut maliyetten daha
  ucuz.
- İş deseni hazır: `pool.ts` + `poolScheduler.ts` + `jobRuns`. Ayrıca
  `purgeScheduler.ts:11-17` kilidin ne zaman *gerekmediğini* söylüyor —
  idempotent bir yeniden hesap iki instance'ta da aynı cevabı üretir, kilit
  gerekmez.

Reponun kendi tutumu da bu özelliği destekliyor —
`packages/shared/src/moderation.ts:40-49`:

> *"Freezing token is reversible and invisible to everyone else, which is what
> makes an automatic threshold acceptable at all — nothing here bans anyone,
> that stays a human decision."*

Keşifte sıralama düşürmek her iki şartı da sağlıyor: geri döndürülebilir
(bir sonraki gecelik hesap) ve görünmez (kimseye, düşürülen dahil).

**Ama üç şeyi söylemem gerekiyor:**

1. **Repo public ve bu kural, bilinince atlatılabilen ilk kural.**
   `architecture.md:157-159` ve `token.ts:198-201` "savunma gizlilik değil,
   sunucu tarafı uygulama" diyor — ve bu doğru, çünkü bir kotayı ya da
   idempotency indeksini *bilmek* onu atlatmaya yaramaz. Bir spam sezgiseli
   farklı: açılış cümlesini çeşitlendirmeyi öğrenen biri sinyalden kaçar.
   Hiçbir doküman bu asimetriye değinmiyor. Karar: ya ağırlıkları
   `packages/shared`'ın dışında (env/`appConfig`) tutmayı kabul et — ki bu
   "limitler config'tir" kuralını deler — ya da gameability'yi bilerek kabul
   edip bunu `decisions.md`'ye yaz.
2. **Cinsiyet sinyalini çıkarmanı öneriyorum.** "Sadece karşı cinse yazıyor"
   bir dil değişim uygulamasında yüksek yanlış-pozitifli: eşcinsel bir
   kullanıcı ayna kuralla cezalanır, `gender: 'undisclosed'` seçenler ölçülemez
   ve sinyal, cevap oranının zaten yakaladığı zararın üstüne bilgi eklemiyor —
   yalnızca bir ayrımcılık yüzeyi ekliyor. Zarar "kimse ona cevap vermiyor"sa,
   ölçülmesi gereken şey zaten o. Ayrıca `decisions.md:928-938` cinsiyet
   filtresinin neden Pro olduğunu tartışırken *"güvenlik için kullanılan tek
   filtre"* diyor — aynı alanı ceza girdisine çevirmek o tartışmayı yeniden
   açar.
3. **`sort=nearby`'de `$sort` aşaması hiç yok** (`discovery.ts:352-360`) —
   `$geoNear` kendi sıralıyor. Oraya bir düşürme uygulamak ya bir `$match`
   olur ya da açık bir istisna.

Formül `packages/shared`'da (public, emsale uygun), **kişi başına değer hiçbir
yanıt gövdesinde olmamalı** — `decisions.md:378-383`'ün "eşiği kanıtlanabilir
bir oyuna çevirme" gerekçesi burada da geçerli.

---

## 5. Before/after paylaşım kartı — en pahalısı, ve sebebi tek cümle

**Ne sunucuda ne istemcide raster üretecek hiçbir şey yok.** Aradım:

- Sunucu: `apps/api/package.json`'da tek görsel kütüphanesi `qrcode`. `sharp`,
  `satori`, `@resvg/resvg-js`, `canvas`, `jimp`, `puppeteer` — hiçbiri yok,
  `node_modules/.pnpm` dahil sıfır isabet. Yani **yalnızca SVG.**
- İstemci: `react-native-view-shot` yok, `expo-media-library` yok,
  `expo-sharing` yok, `react-native-svg` yok, Skia yok. Paylaşım yalnızca
  `Share.share({ message, url })` ve `Clipboard.setStringAsync`.

Instagram Stories ve TikTok raster dosya istiyor; bir SVG URL'i çalışmaz. Üç
seçenek var ve **üçü de yazılı bir kısıtı çiğniyor**:

1. **Sunucu raster'lar** (satori + resvg). İstemci OTA kalır, kart düz bir
   `<Image>` olur. Ama `decisions.md:1150-1180` imaj boyutunun zaten bir kavga
   olduğunu kaydediyor (1.15 GB → 608 MB) ve bu paketler platform-native
   binary getiriyor, ayrıca `pnpm-workspace.yaml`'ın `onlyBuiltDependencies`
   listesine girmeleri gerekiyor.
2. **İstemci raster'lar** — üç yeni native modül, yani yeni bir binary ve OTA
   yok. Bu tam olarak `share-profile.tsx:22-26` ve `qr.ts:14-18`'in QR için
   reddettiği şey: *"bir resim için native modül, yani yeni bir binary ve OTA
   güncellemesi yok."*
3. **Link paylaş** — sunucu SVG kartı + `app2.langx.io/card/:id` sayfası + OG
   etiketleri. Sıfır yeni bağımlılık, her yerde zengin önizleme olarak yayılır.
   Ama Instagram Story değil.

İki ek kısıt: `qr.ts:77-84` bir `?to=<anything>` üretecini *"kendi
hostname'imizi giymiş bir phishing primitifi"* diye reddediyor, yani uç nokta
`GET /public/card/correction/:id` olmalı (sunucu kaydı kendi bulup çizer,
çağıranın metnini değil). Ve chat düzeltmeleri **özel** — "karşı tarafın
onayı" dediğin şey bir mekanizma gerektiriyor ki o mekanizma #3'ün ihtiyaç
duyduğu "teşekkür" ile aynı şey.

**Önerim:** 3'ü şimdi çıkar (bedava, bugün çalışır), 1'i ancak paylaşım
gerçekten büyüme önceliğiyse yap.

---

## Önerilen sıra

**Şimdi (küçük, bağımsız, hepsi OTA):**
1. #0 + #0b birlikte — ikisi de cinsiyet alanına dokunuyor, aynı commit'te
   gitmeleri ve `decisions.md`'ye tek bir tutarlı hikâye yazmaları daha
   temiz: cinsiyet bir kez belirtilir, sonra kimse için bir ödeme duvarı
   değildir.
2. #6 ses hızı düğmesi — ~1 saat.
3. #1a "ilk 5 mesajda medya yok" — `messageCount` + `upload-url` kapısı +
   istemcide kapalı kamera. Slogan bunun karşılığı.

**Sonra (orta, birbirini besleyen):**
3. Chat düzeltmelerine zaman damgalı **teşekkür** — tek başına küçük, ama
   #3'ün üçüncü cümlesini ve #5'in onay mekanizmasını aynı anda açıyor.
4. #1b istekler kutusu — `bothSpoke` hazır.
5. #4 günün cümlesi — kod ince; asıl iş içerik hattı.

**Karar gerektiren:**
6. #2 spam sinyali — cinsiyet sinyalini çıkararak, gameability'yi bilerek
   kabul ederek.
7. #3 haftalık özet — teşekkür ve toplu push işi bittikten sonra.
8. #5 paylaşım kartı — önce link versiyonu; raster ayrı bir karar.
9. Referral programı (aşağıdaki plan) — hazır, onay bekliyor.

---

# EK: Referral programı — arkadaşını davet et, token kazan

> Bu plan bir önceki turda tamamlandı ve onaylanmadı; silinmesin diye burada
> duruyor. Yukarıdaki sırada 9. madde.

## Context

LangX v2'de token kazanmanın bugün iki yolu var: bir eylem karşılığı ödül
(`message`, `correction`, `streak`) ve günlük havuz payı. Yeni kullanıcı
getirmenin hiçbir karşılığı yok. İstenen: **davet ettiğin kişi gerçekten
kullanmaya başlarsa 1000 token, o kişi ücretli bir plana geçerse davet başına
toplam 5000 token.**

Bu özellik ekonominin bugüne kadarki en temel varsayımını bozuyor.
`apps/api/src/modules/tokens/signupBonus.ts` doküman yorumu şunu iddia ediyor:
*"tokenlar satın alınamaz, satılamaz, takas edilemez, aktarılamaz — bu yüzden
ikinci bir hesap sahibine ilk hesapta kullanabileceği hiçbir şey kazandırmaz."*
Referral ödülü **davet edeni** ödüllendirdiği an bu cümle yanlış hale geliyor:
sahte hesap açmak ilk kez kârlı oluyor. Planın en çok yer ayırdığı kısım bu
yüzden ödülün ne zaman ödendiği.

### Kullanıcının verdiği kararlar (tartışmaya kapalı)

1. **Referral kodu = mevcut `handle`.** Kod üretimi yok.
2. **1000 token, davetli "aktifleşince"** — e-posta doğrulanmış + onboarding
   bitmiş + davetlinin kendi `message`/`correction` ledger satırı oluşmuş.
3. **Grant kind** — sadece all-time kovaya yazar, hafta/ay/yıl liderlik
   tablolarına girmez.
4. **Abonelik: sadece `INITIAL_PURCHASE`, davet başına 1000 + 4000 = 5000
   tavan.** Yenilemede asla ödenmez.

---

## Okurken bulunan, planı değiştiren dört gerçek

1. **`invite` rezerve değil.** `packages/shared/src/reservedHandles.ts` içinde
   ne `ROUTE_RESERVED` ne `INFRASTRUCTURE_RESERVED` listesinde var, ve
   `HANDLE_PATTERN`'e uyuyor. `app/(app)/invite.tsx` dosyası oluştuğu anda
   `apps/mobile/src/lib/routeLiterals.test.ts` CI'da patlar. Rezervasyon sadece
   *claim* anında uygulanıyor, geriye dönük tahliye etmiyor → **merge öncesi
   canlı DB'de `invite` handle'ı var mı kontrol edilecek** (`profiles`,
   `legacyProfiles`, `handleReservations`).
2. **Import döngüsü var.** `profiles.ts` → `referrals.ts` → `settle.ts` →
   `isEmailVerified` (şu an `profiles.ts:658`). Referral modüllerinden önce
   `isEmailVerified` yaprak bir dosyaya taşınmalı.
3. **v1'den dönen kullanıcı hiçbir zaman atfedilemez.**
   `modules/handles/legacyRestore.ts:112` `createProfile`'ı tamamen atlayıp
   doğrudan `insertOne` yapıyor ve `afterEmailVerification`'dan tetikleniyor —
   kod taşıyacak bir request body yok. Kabul ediyoruz; aksini vaat eden hiçbir
   metin yazılmayacak. Alternatifi (onboarding sonrası `POST /me/referral`)
   "atıf hesap açılışında bir kez yazılır, bir daha değişmez" invaryantını
   yok eder — ki tüm anti-abuse buna dayanıyor.
4. **`refreshEntitlement` kör bir `updateOne` yapıyor** (`refresh.ts:33`).
   Geçiş kenarını (free → paid) yakalayabilmek için `findOneAndUpdate` +
   `returnDocument: 'before'` haline getirilmesi gerekiyor.

**Bilinçli kabul edilen maliyet:** grant kind'lar all-time kovaya yazıyor ve
all-time dört liderlik sekmesinden biri. 20 aktif daveti olan biri tek mesaj
atmadan all-time tabloda 20.000 token kazanır. Bu, `legacyTokenDivisor`'ın v1
balinasına zaten tanıdığı ~32 günlük avansla aynı mertebede — yani reponun
kendi koyduğu emsalin içinde. Ama sonradan keşfedilmesin diye `decisions.md`'ye
**kabul edilmiş bir maliyet olarak** yazılacak.

---

## 1. Veri modeli

### `referrals` koleksiyonu + Profile üzerinde tek bir işaretçi alan

Alt-doküman değil ayrı koleksiyon, çünkü özelliği taşıyan sorgu — *"kimleri
davet ettim, her biri bana ne kazandırdı?"* — **davet edeni** adlandırıyor;
oysa alt-doküman davet edilenin üzerinde olurdu. Bu, uygulamanın en sıcak
koleksiyonu olan `profiles` üzerinde iç içe bir alan üzerinden fan-out `find`
demek olurdu.

Ama `awardForSend` uygulamadaki **her mesajda** çalışıyor ve "bu kişi davetli
mi?" sorusuna bedavaya cevap vermesi gerekiyor. `awards.ts:51`'deki
`findOneAndUpdate(..., { returnDocument: 'before' })` zaten gönderenin profilini
elinde tutuyor. Bu yüzden:

**`Profile.referredBy?: string`** — davet edenin user id'si. `attachReferral`
tarafından bir kez yazılır, asla değişmez, `toPublicProfile`'a girmez. Sayaç
değil işaretçi olduğu için sapması mümkün değil (`restoredFromV1` ile aynı
şekil).

`apps/api/src/modules/referrals/referrals.ts`:

```ts
export interface Referral {
  /** Davet edilenin user id'si. `_id`, çünkü "bir kişinin ömür boyu tek bir
   *  davet edeni olur" bir optimizasyon değil, primary key. indexes.ts'te
   *  tanımlanması gerekmez, düşürülemez, ikinci bir attach E11000 olur. */
  _id: string
  referrerId: string
  /** Attach anındaki handle — bugün gereksiz (handle değişmiyor), ama altı ay
   *  sonra shell'de ikinci bir lookup olmadan okunabilir olmasını sağlayan şey. */
  referrerHandle: string
  source: 'link' | 'manual'
  createdAt: Date
  activatedAt?: Date
  /** Aktivasyonun gerçekte ne ödediği. Donmuş bir referrer'da 0. */
  activationAward?: number
  subscribedAt?: Date
  subscriptionAward?: number
  subscriptionTier?: PaidPlanTier
}
```

### Durum makinesi

`pending` → `activated` → `subscribed`, ama iki mandal **bağımsız zaman
damgası, sıralı bir dizi değil** — davetli hiç mesaj atmadan Pro alabilir.

Kural: **abonelik bonusu, aktivasyon bonusu ödenmeden ödenmez.** (a) "5000'de
tavan" ifadesi 1000'in düştüğünü varsayıyor. (b) Gerçek paranın token
ekonomisine dokunduğu tek yol bu; aksi halde çalıntı kartla açılmış bir hesap
sıfır insan emeğiyle 4000 token satın alır. Aktivasyon kapısı, bunun bedelini
gerçek bir insanla gerçek bir konuşma yapıyor.

Her iki tetik de **aynı** fonksiyonu çağırır ve o an ne ödenmesi gerekiyorsa
öder — `settleReferral(db, inviteeId, at)`:

```
referral satırı var mı?              yok → çık
iki mandal da yazılmış mı?           evet → çık
davetlinin profili var, silinmemiş mi?
davetlinin e-postası doğrulanmış mı? (authId() — iki id dünyası)
davetlinin ≥1 message|correction ledger satırı var mı?
      yok → çık (hâlâ pending)
aktivasyon mandalı yoksa:
      awardTokens({userId: referrerId, kind: 'referral',
                   amount: frozen(referrer) ? 0 : TOKEN_RULES.referral.activation,
                   refId: inviteeId, at})
      → sonra $set activatedAt + activationAward
subscribedAt yazılmış VE abonelik mandalı yoksa:
      awardTokens({..., kind: 'referralSubscription',
                   amount: frozen ? 0 : TOKEN_RULES.referral.subscription,
                   refId: inviteeId, at})
      → sonra $set subscriptionAward
```

**Önce ödeme, sonra mandal.** Aradaki bir çökme audit satırını eksik bırakır ve
bir sonraki çağrıda kendini onarır (`awardTokens` `duplicate` der, mandal
yeniden yazılır). Ters sıra ödenmemiş bir referral'ı ödenmiş işaretler — bu
geri döndürülemez. `ledger.ts`'in kendi sıralama argümanının bir üst katmana
uygulanmış hali.

`frozen ? 0` kalıbı zaten üç yerde var (`awards.ts:60`, `feed.ts:436`,
`pool.ts:102`). Sonucu: donmuş bir referrer hiçbir ledger satırı bırakmaz ama
mandal yine yazılır, yani ödülü kalıcı olarak kaybeder. `awards.ts`'in beyan
ettiği tutumla tutarlı; düzeltme aracı bir `adjustment` satırı.

### İndeksler — `apps/api/src/db/indexes.ts`

```ts
[COLLECTIONS.referrals]: [
  // Davet ekranının listesi. `_id` tiebreak baştan anahtarın içinde:
  // `post_created` ve `conversation_created` sonradan yeni isim altında
  // genişletilmek zorunda kaldı, çünkü canlı bir indeksin anahtarını
  // değiştirmek rebuild değil IndexOptionsConflict.
  //
  // Burada bilerek unique indeks YOK. Önemli olan teklik — kişi başına tek
  // referrer — `_id`'nin kendisi; çift ödemeyi durduran teklik ise
  // `tokenLedger.user_kind_ref_unique`.
  { key: { referrerId: 1, createdAt: -1, _id: -1 }, name: 'referrer_created' },
],
```

`COLLECTIONS.referrals: 'referrals'` → `apps/api/src/db/collections.ts`.

### Çift ödeme neden fiziksel olarak imkânsız

| Katman | Mekanizma | İmkânsız kıldığı |
| --- | --- | --- |
| 0 — atıf | `referrals._id = inviteeUserId`, ve `referrerId`'yi değiştirebilen hiçbir endpoint yok | Çift atıf (E11000) |
| 1 — aktivasyon | `user_kind_ref_unique` / `{referrerId, 'referral', inviteeId}` | Çift başına >1 `referral` satırı |
| 2 — abonelik | aynı indeks, `kind: 'referralSubscription'` | Çift başına >1 abonelik satırı |
| 3 — olay | `subscriptions.event_id_unique` | Tekrar teslim edilen webhook referral koduna hiç ulaşmaz |

`awardTokens` ledger satırını `tokenAggregates`'e dokunmadan **önce** yazdığı
için, kopya para hareket etmeden reddedilir. `activatedAt`/`subscribedAt`
koruma değil, **audit kaydı** — sıfır ödeme durumunu da içerdiği için, ki
ledger onu temsil edemez.

---

## 2. Shared config — `packages/shared/src/token.ts`

### İki kind, bir değil

`refId` `{userId, kind, refId}` üzerinde unique. Tek kind + `refId = inviteeId`
sadece bir kez ödeyebilir. İki çıkış yolu: iki kind, ya da tek kind + önekli
ikinci refId (`awards.ts:21`'deki `mutualRefId` numarası).

**İki kind alınacak.** Önekli refId numarası *aynı* ödül farklı şeyler için
kazanıldığında doğru araç. Bu o değil:

- `apps/mobile/src/lib/tokenHistory.ts:46` (`kindKey`) kind başına etiket
  üretiyor. Tek kind ile geçmiş ekranı aynı gün, ikisi de "Davet bonusu"
  yazan, biri 1000 diğeri 4000 iki satır gösterir. O ekranın **tek işi**
  tokenın nereden geldiğini söylemek.
- Emsal dosyanın içinde: `welcomeBack` ve `signupBonus` ikisi de "hesap açılışı
  civarında tek seferlik bonus" olmasına rağmen ayrı kind.
- Ayrı fiyatlandırılacaklar; kind başına toplam bir `kind` filtresi olur,
  refId string parse etmek değil.

### Düzenlemeler

**`TOKEN_KINDS`** — iki giriş eklenir, mevcut üslupta doküman yorumlarıyla:
`'referral'` (davet eden kişiye, davetli gerçek olduğunda) ve
`'referralSubscription'` (bir davetlinin ödeyebileceği ikinci ve son şey).

**`TOKEN_GRANT_KINDS`** — ikisi de eklenir; mevcut yorum genişletilir. Şu anki
gerekçe lansman haftasından ("2023'te kazanılmış v1 bakiyesi haftalık tabloyu
tepeler"); referral daha ağır, çünkü **tekrarlanabilir**:

> Bu kural için en güçlü örnek, ve ilk tekrarlanabilir olanı. Bir haftada
> aktifleşen yirmi davetli, tek mesaj atmamış birine 20.000 token demek — her
> hafta, sonsuza kadar. Bir v1 dönüşümü tek seferlik bir lansman
> distorsiyonuyken bu değil. All-time harcanabilir bakiyenin geldiği yer ve
> bunlar harcanabilir kalıyor; hafta, ay ve yıl tabloları pratik yapmayı
> sıralıyor, ve davet etmek pratik yapmak değil.

**`TokenRules` arayüzü + `TOKEN_RULES`** — `award`/`caps`/`pool`/`sinks` ile
aynı biçimde iç içe bir grup:

```ts
referral: {
  activation: 1000,   // davetli aktifleştiğinde
  subscription: 4000, // üstüne, sadece ilk satın almada
  maxPerInvitee: 5000 // her kamuya açık metnin alıntıladığı sayı
},
```

Doküman yorumlarında yazılacak gerekçeler:
- **Kod üretimi yok**, çünkü handle zaten kamuya açık bir adres (`/<handle>`),
  zaten unique, zaten sesli söylenebilecek kadar akılda kalıcı.
- **Kayıtta ödenmiyor**: hesap açmaya verilen ödül, hesap açmaya verilen
  ödüldür. `pool.accountAgeRampUpHours` ile aynı akıl yürütme, saat yerine
  insan cinsinden ifade edilmiş.
- **`subscription` "token satın alınabiliyor" kuralını bozmuyor**: abone olan
  kişi sıfır token alır; hareket eden tek hesap hiçbir şey harcamamış olandır.
  `welcomePack.ts` yorumu kelimesi kelimesine geçerli kalır.
- **`maxPerInvitee` türetilmiyor, saklanıyor** — vaadin yaşadığı tek yer olsun
  diye; `rules.test.ts` `activation + subscription === maxPerInvitee` iddiasını
  test eder.

**Bilerek eklenmiyor: referrer başına ömürlük tavan.** "Eşiği hard-code etme"
kuralı "uygulamayacağın eşikleri icat et" demek değil. Aktivasyon kapısı zaten
sahte hesap başına gerçek bir konuşma faturalıyor; bir tavan ise destek yüzeyi
yaratır ("51. davetim neden ödemedi?"). Gerekirse append-only ledger sayesinde
geriye dönük hesaplanabilir.

### Yeni dosya: `packages/shared/src/referral.ts`

```ts
export const INVITE_QUERY_PARAM = 'invite'
export function inviteUrl(handle: string): string          // profileUrl üstüne
export function inviteQrUrl(apiBaseUrl: string, handle: string): string
export function inviteHandleFromUrl(url?: string | null): string | null
export const REFERRAL_LIST_LIMIT = 50
export const referralInviteeSchema / referralStatusSchema   // §6
```

`inviteUrl`, host'u tekrar yazmak yerine `profileUrl` üstüne kurulur — böylece
`app.langx.io` nihayet deployment'a yöneldiğinde `WEB_HOST` tek satır kalır.
`packages/shared/src/index.ts`'e `export * from './referral'`.

---

## 3. Bağlanma yolu: link → draft → `POST /profiles`

### URL şekli: `https://app2.langx.io/<handle>?invite=1`

Ayrı bir rota değil, **mevcut profil rotasına eklemeli bir işaret**:

- Path segmenti zaten kodun kendisi. Ayrı bir `/i/<handle>` rotası,
  `app/[username].tsx`'in zaten yaptığı her şeyi (handle çöz, kartı render et,
  kayıt teklif et) tekrarlayan ikinci bir **oturum açmamış** ekran demek — ki
  o dosyanın `Stack.Protected`'ın iki dalının da dışında durması işin zor kısmı.
- Yeni bir üst düzey rota adı yok → `ROUTE_RESERVED` girişi yok,
  `routeLiterals.test.ts` değişikliği yok, bir kullanıcının o kelimeye zaten
  sahip olma riski yok.
- İşaret eklemeli olduğu için **bugüne kadar paylaşılmış her profil linki
  çalışmaya devam eder**; işaret düştüğünde davranış 404 değil, *bugünkü
  davranış*.
- AASA değişikliği yok: `apple-app-site-association` zaten `"/": "/*"`.

Dürüst maliyeti: query string, mesajlaşma uygulamalarının link önizlemesinde
düşme ve sesli okunduğunda kaybolma ihtimali en yüksek kısım. Onboarding'deki
manuel kod alanı (§7) tam bu yüzden süs değil — **her zaman çalışan yol o**,
link üstüne binen kolaylık katmanı.

İşaret neden gerekli (her profil ziyaretini referral saymak yerine): `me.tsx`
üzerindeki "Profilimi paylaş" satırı ve ekranı referral hakkında hiçbir şey
söylemiyor; onu sessizce bir atıf akışına çevirmek mevcut metni yanlış yapar.
`referrals.source` hangisi olduğunu kaydeder, böylece bu karar ileride tek
satırlık ve veriye dayalı olur.

### Şema alanı — `packages/shared/src/profile.ts`, `onboardingProfileSchema`

```ts
referredByHandle: handleSchema.optional().catch(undefined),
```

Bu **okuma** şeması: üç karakterlik handle'ı olan bir v1 hesabı da davet
edebilir; `newHandleSchema`'nın alt sınırı isim *yaratmakla* ilgili.

`.catch(undefined)` ürün kararının şemaya yazılmış hali: **parse edilmeyen bir
davet kodu yok sayılır, asla 400 olmaz.** Arkadaşının kullanıcı adını yanlış
yazan biri onboarding'i bitirebilmeli. Diğer tüm çözümleme hataları (böyle bir
hesap yok, o sensin, zaten bir referrer'ın var) aynı sebeple sessiz.

> `.catch()` bugün `packages/shared`'da hiç kullanılmıyor — review'da işaretle.
> Alternatifi `z.string().optional().transform(v => handleSchema.safeParse(v ?? '').data)`.

### `attachReferral(db, inviteeId, handle, source)` — tüm hatalar sessiz

`createProfile` içinde, başarılı `profiles.insertOne`'dan **sonra**,
`grantSignupBonus(db, userId, now)` satırının yanında (`profiles.ts:~282`).
Hiçbir şey yazmadan reddettiği durumlar:

1. handle hiçbir profile çözülmüyor, ya da `deletedAt` set;
2. `referrer._id === inviteeId` (onboarding'de olamaz — davetlinin henüz
   handle'ı yok — ama modül başka yerden çağrılabilir ve kural yazılmayı hak
   ediyor);
3. `insertOne` E11000 → zaten atfedilmiş; **ilk yazan kazanır**, çünkü kaydı
   fiilen tetikleyen link onunkiydi.

Aynı çağrıda davetlinin `profiles.referredBy = referrerId` alanını da `$set`
eder. **Sıra burada tersine önemli: önce `referrals` satırı, sonra işaretçi.**
Satırsız işaretçi `settleReferral`'a mesaj başına bir boşa lookup yaptırır;
işaretçisiz satır **hiç** yaptırmaz ve ödül asla tetiklenmez.

`attachReferral` içindeki hatalar onboarding'i düşürmemeli: `auth.ts`'in
`restoreLegacyProfile`'ı sardığı `tryRestore` kalıbı — `try/catch` +
`console.error` — aynı gerekçeyle (hesap gerçek ve profil zaten yazıldı; bir
atıfı kaybetmek telafi edilebilir, bir kaydı kaybetmek edilemez).

---

## 4. Aktivasyon tetiği

**Reddedilen — `awardTokens` içinde:** `dailyPool` (cron'dan gecede binlerce
yazma), `signupBonus`, `spend` ve `adjustment` da oradan geçiyor. Bağımlılığı
da ters çevirir — ledger primitifi, zaten ledger'ı import eden referrals
repository'sini import ederdi.

**Reddedilen — zamanlanmış süpürme:** `{ activatedAt: { $exists: false } }`
kısmi indeksi ve sonsuza kadar büyüyen bir tarama gerektirir (pending satırlar
hiç süresi dolmuyor). Daha kötüsü, referrer 1000'i saatler sonra, yaptığı
hiçbir şeyle bağlantısız görür — oysa referral programının bütün değeri ödülün
görünür olması.

**Seçilen — iki ödül çağrı noktası, bedava bir bellek-içi kapının arkasında:**
`modules/tokens/awards.ts` (`awardForSend` — message, correction ve mutual'ı,
REST ile socket'i birlikte kapsar) ve `modules/feed/feed.ts:~430`
(`awardForPostCorrection`). Bunlar `tokenFrozenAt`'in zaten okunduğu iki yer.

```ts
// Davetlinin ilk gerçek kazancı, davet edeninin ödülünü aktive eden şeydir.
// `sender.referredBy` üzerinden kapılı — bu fonksiyonun zaten okuduğu bir alan,
// yani kimsenin davet etmediği bir hesap (ki neredeyse hepsi öyle) bu satır
// için hiçbir şey ödemez. `settleReferral` her koşulu kendisi yeniden doğrular;
// çağrı noktası sadece "bir şey oldu, tekrar bak" der.
if (sender?.referredBy && tokens > 0) await settleReferral(db, senderId, at)
```

**Yazma amplifikasyonu, dürüstçe:** davetsiz kullanıcı için **sıfır** — zaten
bellekte olan bir dokümanda bir property erişimi. Davetli kullanıcı için:
`referrals` üzerinde bir `_id` point-read, artı (yalnızca hâlâ pending iken)
bir `user` projeksiyonu ve `user_kind_ref_unique`'in `{userId, kind}` önekinin
karşıladığı bir `countDocuments`. Karşılaştırma: o yolda mesaj başına zaten bir
`messages` insert, bir `dailyActivity` upsert, bir `tokenLedger` insert, bir
`tokenAggregates` bulkWrite, bir `profiles.findOneAndUpdate` ve bir
`streakDays` yazması var.

Kalan maliyet, **zaten aktifleşmiş** davetli kullanıcının o `_id` read'ini
sonsuza kadar ödemesi. Şimdilik optimize edilmeyecek. Profiling itiraz ederse
çözüm tek alan: `Profile.referredBy`'ı `{ referrerId, settledAt? }` yapıp kısa
devre etmek; bayat bir ipucunun maliyeti en fazla bir gereksiz idempotent çağrı.

`tokens > 0` kazanç sinyali ve `awardForSend`'in zaten hesapladığı değerden
bedava geliyor: capped ya da donmuş bir gönderim ledger satırı yazmaz, dolayısıyla
kimseyi aktive etmemeli. **Sonuç doküman yorumuna yazılacak: donmuş bir davetli
referrer'ını asla aktive etmez. Raporlanmış hesaplardan oluşan bir çiftlik
hiçbir şey ödemez — bu tasarımın çalışması, bug değil.**

---

## 5. Abonelik tetiği

### Birincil: `processRevenueCatWebhook`, `GRANT_SET` dalı, sadece `INITIAL_PURCHASE`

Olay *tipinin* bilindiği tek yer burası. O dal çalıştığında
`subscriptions.eventId` unique indeksi bu olayın ilk kez işlendiğini zaten
tespit etmiş oluyor (`webhook.ts` her şeyden önce insert ediyor).

```ts
if (GRANT_SET.has(event.type)) {
  …mevcut entitlement yazması…
  // Sadece INITIAL_PURCHASE. `ENTITLEMENT_GRANT_EVENTS` RENEWAL,
  // PRODUCT_CHANGE, UNCANCELLATION ve dört tane daha içeriyor; hepsi birer
  // grant ve hiçbiri "ilk kez ödemeye başlamak" değil. Bu ayrımın var olduğu
  // tek yer de burası: client'ın POST /billing/refresh fallback'i bir tier
  // görür, asla bir olay görmez.
  if (event.type === 'INITIAL_PURCHASE') {
    await markInviteeSubscribed(db, userId, tier ?? 'pro', now)
  }
}
```

### Yedek: `refreshEntitlement`, `free → paid` geçiş kenarında

Bu olmadan, hiç gelmeyen bir webhook (RevenueCat kesintisi, yanlış
yapılandırılmış dashboard secret'ı) 4000'in hiç ödenmemesi demek — ve
`refresh.ts`'in kendi yorumu client fallback'inin tam da bunun için var
olduğunu söylüyor.

Değişiklik: `refresh.ts:33`'teki kör `updateOne`, `awardForSend`'in `sender`
için kullandığı aynı pre-image numarasıyla `findOneAndUpdate(...,
{ returnDocument: 'before' })` yapılır ve sadece pre-image `free` iken tetiklenir:

```ts
// Durum değil, geçiş. Aşağıdaki grantWelcomePack tier'ın bir fonksiyonu ve
// her refresh'te güvenle tekrar çalıştırılabilir; referral ödülü ise bir
// *olayın* fonksiyonu, ve bu dosyadaki tek geçiş kenarı burası. Bir yenilemenin
// pre-image'ı zaten ödemeli, dolayısıyla burada tetiklenemez.
if (before?.entitlement.tier === 'free' && next.tier !== 'free') {
  try { await markInviteeSubscribed(db, userId, next.tier, now) } catch { /* welcomePack gibi */ }
}
```

Hata, welcome-pack bloğunun verdiği gerekçeyle yutulur: abonelik kullanıcının
ödediği şey ve zaten aktif; geçici bir yazma hatası yüzünden RevenueCat'in
beklediği refresh'i düşürmeye değmez.

### Yenileme neden ödeyemez — üç bağımsız cevap

1. `event.type === 'INITIAL_PURCHASE'` açıkça kontrol ediliyor; bir test taze
   `event.id`'li bir `RENEWAL`'ın sıfır ödediğini iddia ediyor.
2. Fallback yalnızca `free → paid` pre-image kenarında tetikleniyor.
3. İkisi de sızsa bile `refId = inviteeId` çift başına en fazla bir kez öder.
   **Tek başına yeterli — ama tasarım değil, emniyet ağı.** Sadece buna
   dayanmak, lansmandan sonraki *ilk* yenilemenin ödemesi demek olurdu; bugün
   zararsız olmasının tek sebebi `referrals`'ın boş başlaması, yani şans.

`markInviteeSubscribed(db, inviteeId, tier, at)`,
`{ subscribedAt: { $exists: false } }` filtresi altında `subscribedAt` yazar ve
`settleReferral`'ı çağırır; o da 4000'i **yalnızca aktivasyon mandalı zaten
yazılmışsa** öder. Yazılmamışsa satır sadece `subscribedAt` taşır ve bir
sonraki gerçek mesaj her iki ödülü tek settle'da öder. **Tasarımın üzerine
kurulduğu sıralama vakası bu ve kendi testi var (§8/16).**

Yerel harness değişmeden çalışır: `fakeRevenueCat.purchase()`
`INITIAL_PURCHASE` yayıyor (`fakeRevenueCat.ts:143`) ve `POST /billing/test-event`
onu `processRevenueCatWebhook`'tan geçiriyor.

### "Token satın alınamaz" iddiası neden ayakta kalıyor

Kamuya açık iddia (`docs/token-messaging-brief.md` ve `welcomePack.ts`): *"ne
parayla ne başka bir şeyle token satın alınamaz"*, ve mekanik gerekçesi
"bakiye `tokenAggregates.all` eksi harcama, ve o agregat all-time liderlik
tablosunun sıraladığı şeyin ta kendisi."

İkisi de ayakta, ve ayrım kesin: **kimse kendi tokenını satın alamaz.** Abone
olan sıfır alır. Hiçbir kişinin yapabileceği hiçbir satın alma kendi bakiyesini
veya kendi sırasını artırmaz. `welcomePack.ts` yorumu kelimesi kelimesine
doğru kalır — para hâlâ eşya alır, token almaz, *ödeyen kişi için*.

*Değişen* şey: all-time sıra artık başkası ödediği için hareket edebiliyor.
Bu gerçek bir maliyet ve `decisions.md`'ye kabul edilmiş olarak yazılıyor.

Brief için metin: *"Token satın alamazsınız. LangX'e gerçekten kullanan birini
getirerek kazanabilirsiniz — o kişi abone olursa da. Tokenlar daveti yapana
gider, asla ödeyene değil, ve hâlâ yalnızca streak dondurma ve kozmetik satın
alır."*

---

## 6. Anti-abuse ve API yüzeyi

### Sunucu tarafında uygulananlar

1. Kişi başına ömür boyu tek referrer — `referrals._id = inviteeUserId`.
2. **Atıf tam olarak bir kez, hesap açılışında yazılır.** Sonrasında bir
   referrer'ı set edebilen ya da değiştirebilen hiçbir endpoint yok. Her şeyi
   ayakta tutan özellik bu — ve v1 restore'larının atfedilememesinin (§Gerçek 3)
   yamalanmak yerine kabul edilmesinin sebebi.
3. Kendini davet reddedilir.
4. Referrer attach anında canlı, silinmemiş bir profil olmalı.
5. **Kayıt için hiçbir şey ödenmez.** Aktivasyon doğrulanmış e-posta,
   tamamlanmış profil ve gerçek bir `message`/`correction` ledger satırı ister.
6. Donmuş referrer 0 kazanır, satır `activationAward: 0` kaydeder.
7. Donmuş davetli referrer'ını hiç aktive etmez.
8. İki unique indeks çifti `maxPerInvitee`'de tavanlar.
9. Abonelik bonusu önceden aktivasyon ister — çalıntı kart yolunu kapatır.
10. `GET /me/referrals` yalnızca handle, ad, avatar, durum ve tutar döner —
    e-posta yok, aktivite detayı yok, ledger satırı yok.
11. **Uygulanmıyor, ve öyle olduğu söyleniyor:** aynı cihaz / aynı IP
    sezgiselleri. Bilerek kapsam dışı. Savunma aktivasyon kapısı; IP
    korelasyonu yurtları, ofisleri ve CGNAT arkasındaki ülkeleri cezalandırır —
    ki bu kullanıcı tabanının büyük kısmı.

### `signupBonus.ts` doküman yorumu

*"İkinci bir hesap sahibine ilk hesapta kullanabileceği hiçbir şey
kazandırmaz"* cümlesi bu özellik yayına girdiği gün yanlış oluyor. Yerine
yazılacak paragraf, (a) eskiden neden doğru olduğunu, (b) referral'ın onu neyi
değiştirdiğini, (c) bu grant'ın buna dahil olmadığını (`attachReferral` kendini
daveti reddediyor), (d) referral ödülünü koruyan şeyin **kayıt için hiç
ödenmemesi** olduğunu anlatacak.

### `GET /me/referrals` (yeni) — `apps/api/src/routes/referrals.ts`, `requireAuth`

`app.ts`'te `xpRoutes`'tan sonra kaydedilir.

```ts
referralStatusSchema = {
  // Toplamlar `invitees`'ten değil, tüm `referrerId` grubu üzerinde bir
  // aggregation'dan sayılır — liste REFERRAL_LIST_LIMIT'te kesiliyor ve
  // toplamların limitten sonra da doğru kalması gerekiyor.
  totals: { invited, activated, subscribed, tokensEarned },
  invitees: [{ handle, displayName, avatarUrl?, status, invitedAt, earned }],
  referredBy: { handle, displayName } | null,
}
```

DTO'da **bilerek yok**: davet kodu ve URL (client'ta zaten `me.handle` var ve
`inviteUrl` çağırıyor) ve ödül tutarları (client `TOKEN_RULES`'u doğrudan
import ediyor, tam olarak `tokens.tsx`'in havuz sayıları için yaptığı gibi).

### `GET /public/qr/:handle?invite=1` (değişiklik) — `routes/qr.ts`

Querystring şeması eklenir ve kodlanan URL dallanır:
`const target = request.query.invite ? inviteUrl(handle) : profileUrl(handle)`.
`CACHE_SECONDS` yorumu güncellenir: görsel artık *(handle, işaret)* çiftinin saf
bir fonksiyonu ve ikisi de URL'de, yani tam URL'e göre edge cache doğru kalıyor.

### `POST /profiles` (değişiklik)

Body'ye `referredByHandle` eklenir. Yanıt değişmez. `createProfile`'ın imzası
değişmez — alan `input: OnboardingProfileInput` içinde geliyor.

Değişmeyen: `GET /me/tokens`, `/me/tokens/history` (yeni kind'lar
`tokenKindSchema` üzerinden otomatik akıyor), `GET /leaderboard`, `GET /me/wallet`.

---

## 7. Mobil

### Davet ekranı — `apps/mobile/app/(app)/invite.tsx`

- `(app)/_layout.tsx`'e `<Tabs.Screen name="invite" options={FULL_SCREEN} />`.
- **`'invite'` → `ROUTE_RESERVED`** (`packages/shared/src/reservedHandles.ts`),
  yoksa `routeLiterals.test.ts` CI'da düşer.
- Yapı, `share-profile.tsx`'ten neredeyse birebir: QR kartı
  (`inviteQrUrl(API_URL, handle)`, aynı sabit 220×220 kutu ve
  `contentFit="contain"` — o dosyadaki "%100'ün yüzdesi olacak bir şeyi yok"
  notu aynen geçerli), handle, `https://` atılmış URL, `Share`/`Copy` düğmeleri,
  toplam `StatTile` satırı, davetli listesi, token açıklaması.
- `keys.referrals` + `useReferrals()` → `apps/mobile/src/api/queries.ts`.

### Giriş noktaları

- `me.tsx` — mevcut "Profilimi paylaş" satırının hemen altına bir `ListRow`.
- `tokens.tsx` — kazanç bölümüne bir satır. O ekran zaten "token nereden gelir"
  ekranı; orada listelenmeyen 1000 tokenlık bir yol, kimsenin bulamayacağı yol.

### Onboarding'de kod yakalama — `app/(onboarding)/handle.tsx`

- `OnboardingDraft`'a ve `EMPTY`'ye `referredByHandle: string`
  (`src/hooks/useOnboardingDraft.ts`). Böylece draft'ın geri kalanıyla birlikte
  bedavaya persist edilir ve rehydrate olur.
- Handle input'unun altında "Davet kodun var mı?" pressable'ı bir metin alanı
  açar; bekleyen bir referrer yakalanmışsa yerine önceden doldurulmuş onaylı
  bir chip. **Yeni bir wizard adımı değil** — azınlığa hizmet için akışı herkes
  için uzatmak yanlış takas.
- Chip ismi `GET /public/profiles/:handle` ile çözer, `GET /profiles/:handleOrId`
  ile değil: ikincisi `recordProfileView` çağırıyor ve bir kod yazmak birine
  bakmış sayılmamalı.
- `submit()`: `...(current.referredByHandle ? { referredByHandle: … } : {})`.
- Satır içi doğrulama yalnızca tavsiye niteliğinde — çözülemeyen bir kod
  `onboarding.inviteCodeUnknown` gösterir, Devam düğmesi açık kalır (sunucunun
  sessiz-yok-say politikasıyla eşleşir).

### Deep link yakalama — ve durumun dürüst hali

**Bugün paylaşılan bir link uygulamayı açmıyor.** `APP_LINK_HOST`
`app.langx.io` (uygulamanın `associatedDomains`, `assetlinks.json` ve AASA'da
iddia ettiği) iken `WEB_HOST` `app2.langx.io` (linklerin gerçekte gösterdiği).
`profileUrl` `WEB_HOST` üstüne kurulu, yani davet linki hiçbir platformda
uygulama tarafından sahiplenilmiyor ve tarayıcıda açılıyor. Bu **önceden var
olan** bir durum — bugün paylaşılan her profil linki için de aynı derecede
doğru — ve `release-runbook.md`'de "`/.well-known/*`'ı `app.langx.io`'dan
sunmak" açık maddesi olarak izleniyor. **Plan bunun kapanacağını varsaymıyor.**

İki katman:

- **Katman 1 — şimdi çıkar, hiç `Linking` yok.** `app/[username].tsx` zaten
  oturum açmamış kartı, web'de, davet linkinin çözüldüğü URL'de çalıştırıyor.
  `useLocalSearchParams()` okunur; işaret varsa genel CTA yerine davet metni
  (`shared.inviteTitle`/`inviteBody`) render edilir ve handle
  `FLAG_KEYS.pendingReferrer`'a yazılır. Web'de bu `localStorage`, yani aynı
  tarayıcı kaydolursa `handle.tsx` önceden doldurur. **Bir linkin bugün
  ulaştığı tek build web build'i olduğu için akışın tamamı bu.**
- **Katman 2 — şimdi yazılır, host'lar birleşene kadar uykuda.**
  `src/hooks/usePendingInvite.ts`, `useNotificationRouting.ts` ile birebir aynı
  modelde: soğuk açılış `Linking.getInitialURL()`, sıcak
  `Linking.addEventListener('url')`, ikisi de saf yardımcıyla parse edilir.
  `expo-linking` zaten bağımlılık (`package.json:39`). **`app/_layout.tsx`
  içindeki `RootShell`'e** mount edilir, `(app)/_layout.tsx`'e değil — bütün
  mesele kişinin oturum açmamış olması, yani `Stack.Protected`'ın üstünde
  durmalı. Sadece bir bayrak yazıyor, asla navigate etmiyor; güvenli kılan bu.

**`src/lib/inviteLink.ts` (saf, testli)** — mobil vitest yalnızca `src/lib/**`
ve `src/i18n/**` kapsıyor, o yüzden mantığın tamamı burada, ekran ve hook ince:
`inviteHandleFromUrl` (shared'dan) ve `normalizeInviteCode(input)` — boşluk
kırpar, baştaki `@`'yi atar, küçük harfe çevirir ve **yapıştırılmış tam bir
davet URL'sini kabul eder** (kutuya linki yapıştırmak en olası kullanıcı
davranışı ve desteklemesi bedava).

**`FLAG_KEYS.pendingReferrer`** → `src/lib/localFlags.ts`; `introSeen` ve
`onboardingDraft`'ın yanına ait olma gerekçesi yorumda: kimse oturum açmadan
önce yakalanıyor, yani cihaza ait. `resetDraft()` içinde temizlenir.

### i18n — 8 katalogun hepsi

`Localized<EnMessages>` eksik anahtarı **derleme hatası** yapıyor;
`catalogs.test.ts` ayrıca `{placeholder}`'ların çeviride hayatta kaldığını
kontrol ediyor. Sayımlar `count === 1 ? …` değil çoğul nesne (`{ one, other }`).

| Blok | Anahtarlar |
| --- | --- |
| `tokenKind` (2) | `referral`, `referralSubscription` — **zorunlu**, yoksa geçmiş ekranı ham identifier gösterir |
| `me` (2) | `invite`, `inviteBody` |
| `tokens` (1) | `inviteRow` |
| `onboarding` (6) | `inviteCodeToggle`, `inviteCodeLabel`, `inviteCodePlaceholder`, `inviteCodeFound`, `inviteCodeUnknown`, `inviteCodeSelf` |
| `shared` (2) | `inviteTitle`, `inviteBody` |
| `invite` (yeni blok, ~19) | `title`, `body`, `code`, `qrAccessibility`, `share`, `copy`, `copied`, `shareMessage`, `howTitle`, `step1..3`, `totalsInvited`*, `totalsActivated`*, `totalsEarned`*, `statusPending`, `statusActivated`, `statusSubscribed`, `emptyTitle`, `emptyBody`, `referredBy`, `disclaimer` (* = çoğul) |

Toplam ~32 anahtar × 8 katalog (`en` kaynak; `tr, de, es, fr, pt-BR, ru, ar`).

---

## 8. Testler

**`packages/shared/src/rules.test.ts`** — yeni `describe('referral rules')`:
1. `activation + subscription === maxPerInvitee` (uygulamada, sitede ve
   brief'te "5000"ü doğru tutan invaryant);
2. iki kind da `TOKEN_KINDS` ve `TOKEN_GRANT_KINDS` içinde, `isGrantKind`
   katılıyor (biri düşerse hafta/ay/yıl referral sıralamaya başlar);
3. `subscription > activation` (ikisini sessizce ters çevirmek, review'un tam
   da kaçıracağı düzenleme);
4. `RESERVED_HANDLES.has('invite')`.

**`packages/shared/src/referral.test.ts`** (yeni) — `inviteUrl('deniz')` →
`https://app2.langx.io/deniz?invite=1`; baştaki `@`'yi atar;
`inviteHandleFromUrl` round-trip; işaretsiz profil URL'i, rezerve segment ve
`null`/`undefined` için `null`.

**`apps/api/src/routes/referrals.test.ts`** (yeni) — `MongoMemoryReplSet`,
`ensureIndexes`, `buildApp`, `signUpAndSignIn`, `app.inject`, DB'ye karşı iddia:

1. **attach** — B, `referredByHandle: A.handle` ile onboard olur → tek satır,
   `_id === B.userId`, `activatedAt` yok, A'nın agregatları değişmemiş,
   `B.profile.referredBy === A.userId`.
2. **bilinmeyen kod sessizce yok sayılır** — 201, satır yok, hata yok.
3. **bozuk kod sessizce yok sayılır** — `'not a handle!!'` → 201, 400 değil.
   (`.catch(undefined)`'ın satın aldığı şey.)
4. **kendini davet reddedilir** — modül seviyesinde `attachReferral`.
5. **çift atıf yok** — farklı referrer'larla iki çağrı → ilk kazanır.
6. **aktivasyon tam bir kez öder** — B gerçek mesaj atar → A `activation` kadar
   kazanır, tam bir `{A, 'referral', B}` ledger satırı, satırda mandal.
7. **sonraki mesajlar bir şey ödemez** — beş gönderim daha, toplam sabit.
8. **post correction da aktive eder** — `feed.ts` çağrı noktası, ayrı fonksiyon
   olduğu için ayrı iddia.
9. **grant-kind kovalama** — aktivasyondan sonra A'nın `week`/`month`/`year`
   agregatları dokunulmamış, yalnızca `all` hareket etmiş. Açık iddia olmadan
   görünmez, ve liderlik invaryantı bu.
10. **donmuş referrer** — ledger satırı yok, `activationAward: 0`, `activatedAt`
    yazılı; A çözülüp tekrar gönderilse de bir şey ödenmez.
11. **donmuş davetli** — ödül yok, referral pending kalır.
12. **doğrulanmamış davetli** — `settleReferral` doğrudan çağrılır → ödeme yok.
    (`authId()` iki-id-dünyası tuzağını yakalamak için iyi bir yer.)
13. **`INITIAL_PURCHASE` öder** — `app_user_id: B` → A toplamı `maxPerInvitee`.
14. **`RENEWAL` ödemez** — (a) B için taze `event.id` ile ilk satın alma
    sonrası; (b) tek olayı `RENEWAL` olan yeni bir davetli → sıfır.
15. **tekrar teslim iki kez ödemez** — kopya `event.id` (`event_id_unique`) ve
    aynı tipte *farklı* `event.id` (`refId`). İkisi de, çünkü farklı korumalar.
16. **önce abone, sonra aktivasyon** — B hiç mesaj atmadan abone olur → hiçbir
    şey ödenmez, satırda yalnızca `subscribedAt`; sonra B mesaj atar → iki ödül
    tek settle'da düşer, toplam `maxPerInvitee`. **Tasarımın dayandığı vaka.**
17. **client fallback** — `POST /billing/refresh`, `free → pro` geçişinde bir
    kez öder; zaten pro iken ikinci refresh ödemez.
18. **`GET /me/referrals`** — A, B'yi doğru durumla görür; B `referredBy` görür
    ve boş liste; ilgisiz C sıfır görür; oturumsuz → 401.
19. **sızıntı yok** — davetli girdisinde e-posta ve ledger detayı yok.
20. **silinmiş referrer** — A soft-delete, yeni davetli A'nın handle'ını
    yazar → satır yok.

**`apps/mobile/src/lib/inviteLink.test.ts`** (yeni) — işaretli URL, işaretsiz
URL, rezerve segment (`/discover?invite=1`), deep-link scheme URL, çöp ve
`null`/`undefined` (`Linking.getInitialURL()`'in gerçekte döndürdüğü şekiller).
`normalizeInviteCode('  @Deniz ')` → `'deniz'`; yapıştırılmış tam URL →
`'deniz'`; `'nope!'` → `null`. `notificationRoute.test.ts` modelinde:
tanınmayan her şeye `null` dönmek, bir açılış yolunun throw etmesini engelleyen
şey.

---

## 9. Dokümanlar

### `langx/docs/` içinde

- **`architecture.md`** — "Earning token — two channels" (~387) üçe çıkar;
  "Anti-abuse" (~469) §6 maddelerini alır; `profiles` şema bloğu (~516)
  `referredBy?` alır; koleksiyon listesi `referrals`'ı `_id`-as-primary-key
  gerekçesiyle alır.
- **`decisions.md`** — ev üslubunda tek giriş: *"Referrals — the handle is the
  code, and the award waits for a real message"*; (a) kod üretimi yok, (b)
  kayıtta neden ödenmiyor, (c) neden iki kind, (d) neden webhook +
  `refreshEntitlement` değil sadece biri değil, (e) **all-time liderlik sonucu,
  bilerek kabul edilmiş**, (f) doğru olmaktan çıkan `signupBonus.ts` yorumu.
- **`token-messaging-brief.md`** — yeni "Referrals" bölümü, **ve mevcut
  "Subscribing" bölümüne düzeltme**: bugün "para asla token üretmez, nokta"
  diye okunuyor; sonrasında "para asla *ödeyen kişi için* token üretmez" olur.
  Alttaki tek satırlık özet ("earn by practising and teaching") "practising,
  teaching, and bringing people in" olur. `tokenIsNot`'un altı maddesinin
  hepsi kelimesi kelimesine doğru kalıyor — bunu açıkça yaz, çünkü bir
  reviewer'ın kontrol edeceği liste o.
- **`release-runbook.md`** — App Review 3.1.5(b) cevabı brief'e atıf yapıyor;
  "token bir satın almayla elde edilebilir mi" cevabının yeniden ifade edilmesi
  gerekiyor. Ayrıca `app.langx.io` `/.well-known` açık maddesi artık sadece
  profil linkleri için değil, davet akışı için de yük taşıyor.
- **`legal/`** — okumadım. **Review için işaretlendi:** tokenın nasıl elde
  edildiğini sayan şartlar bir referral maddesi istiyor, ve parasal tetikli bir
  token ödülü tam olarak sayılan türden bir şey.

### Repo'lar arası (ayrı repo, ayrı PR)

- **`website/src/lib/data/token.ts`** — başlığı kendini `TOKEN_RULES` aynası
  ilan ediyor. `tokenEarning`/`tokenCaps`/`tokenSinks` yanına `tokenReferral`
  (1000 / 4000 / 5000) eklenir. **Bu dosya zaten kaymış durumda:**
  `streakMilestones` orada dört basamak listeliyor, `TOKEN_RULES`'ta yedi var
  (180, 730, 1095 eksik) — sync commit'i bunu da düzeltmeli.
- **`docs/` (GitBook)** — `token/utility.md`, `token/README.md`,
  `learn-2-earn/daily-tokens.md` kazanma yollarını anlatıyor, referral
  eklenmeli. **Daha önemlisi ve bir karar gerektiren:** `token/staking.md`,
  `token/trading.md`, `token/langx-nft.md` ve `learn-2-earn/connect-wallet.md`
  hâlâ yayında ve brief'in geri çekilmesi gerektiğini söylediği şeyler. Geri
  çekilmemiş staking/trading sayfalarının yanına yeni bir kazanma mekanizması
  yayınlamak, brief'in kapatmak için var olduğu boşluğu maddi olarak büyütür.
  **Önerim: geri çekmeyi bu özelliğin lansman ön koşulu saymak** — ama bu
  senin kararın, ve teknik işi bloklamıyor (kod önce merge edilebilir).
- **`token-website/index.html`** — lansman öncesi token iddiaları için grep.

---

## 10. Sıralı görev listesi

Her grup tek tutarlı bir commit. Önce dal (`feat/referrals`), sonunda PR.
Yüzdeler tüm işin tamamlanma oranı tahminidir.

| # | Grup | Kümülatif |
| --- | --- | --- |
| 1 | **Ön koşul refactor:** `isEmailVerified`'ı `modules/profiles/profiles.ts:658`'den yeni yaprak `modules/profiles/emailVerified.ts`'e taşı; `routes/profiles.ts`'teki iki çağrı noktasını güncelle. | %5 |
| 2 | **Shared config:** `token.ts` (iki kind, iki grant kind, `referral` grubu + değerler); `reservedHandles.ts`'e `'invite'`; yeni `referral.ts`; `profile.ts`'e `referredByHandle`; `rules.test.ts` + yeni `referral.test.ts`. **İlerlemeden önce: canlı DB'de `invite` handle'ı var mı bak.** | %20 |
| 3 | **Veri katmanı:** `collections.ts` + `indexes.ts`; `Profile.referredBy?`; yeni `modules/referrals/referrals.ts` (`Referral`, `attachReferral`, `markInviteeSubscribed`, `readReferralStatus`) ve `modules/referrals/settle.ts` (`settleReferral`). | %35 |
| 4 | **Attach + aktivasyon:** `createProfile`'a `attachReferral` (try/catch sarmalı); `awards.ts` ve `feed.ts` çağrıları; `signupBonus.ts` yorumunun yeniden yazımı; testler 1–12. | %55 |
| 5 | **Abonelik:** `webhook.ts` `INITIAL_PURCHASE` dalı; `refresh.ts` pre-image + geçiş kenarı; testler 13–17. | %65 |
| 6 | **API yüzeyi:** yeni `routes/referrals.ts` + `app.ts` kaydı; `qr.ts` `?invite=1`; testler 18–20. | %72 |
| 7 | **i18n:** ~32 anahtar × 8 katalog, `en.ts` önce. Ekranlardan **önce** iner, böylece hiçbir bileşen literal ile yazılmaz. | %80 |
| 8 | **Mobil yakalama:** `FLAG_KEYS.pendingReferrer`; yeni `src/lib/inviteLink.ts` + testi; `useOnboardingDraft` alanı ve `resetDraft` temizliği; `app/[username].tsx` davet varyantı; `handle.tsx` kod alanı; `usePendingInvite.ts` + `RootShell` mount. | %90 |
| 9 | **Davet ekranı:** `app/(app)/invite.tsx`; `FULL_SCREEN` kaydı; `keys.referrals` + `useReferrals()`; `me.tsx` ve `tokens.tsx` giriş satırları. | %96 |
| 10 | **Dokümanlar:** `architecture.md`, `decisions.md`, `token-messaging-brief.md`, `release-runbook.md`, legal review bayrağı. | %100 |
| 11 | **Repo'lar arası (ayrı PR'lar):** `website/src/lib/data/token.ts` (+ kaymış `streakMilestones` düzeltmesi); GitBook referral sayfası ve geri çekme; `token-website` denetimi. | — |

---

## Doğrulama

**Grup 2, 4, 6, 7 ve 9'dan sonra**, `langx/` içinde:

```bash
pnpm -r typecheck && pnpm lint && pnpm format:check && pnpm test
```

Özellikle grup 7 tek başına — eksik bir katalog anahtarı test hatası değil tip
hatası, ve yalnızken bulunması daha hızlı.

**Uçtan uca yerel doğrulama** (üretimde okunamayan bir gelen kutusu gerektiği
için yerel stack + Playwright):

1. Yerel MongoDB'nin **replica set** olduğundan emin ol (Better Auth
   transaction sarıyor), `pnpm dev` → API :4000, Expo :8081.
2. A kullanıcısı aç, onboarding'i bitir, `/(app)/invite` ekranına git, davet
   linkini kopyala.
3. Aynı tarayıcıda linki aç → davet metnini ve `pendingReferrer` bayrağının
   yazıldığını doğrula.
4. B kullanıcısı olarak kaydol; `handle.tsx`'te kodun önceden dolu geldiğini
   gör, onboarding'i bitir. **A'nın bakiyesinin değişmediğini doğrula.**
5. B'den A'ya (ya da üçüncü bir hesaba) gerçek bir mesaj at → A'nın bakiyesi
   +1000, `/(app)/tokens` geçmişinde "Davet bonusu" satırı, **hafta/ay
   agregatları değişmemiş**.
6. `POST /billing/test-event` ile B için `INITIAL_PURCHASE` yolla
   (`REVENUECAT_FAKE_STORE`) → A +4000, toplam 5000. Sonra bir `RENEWAL` yolla
   → hiçbir değişiklik.
7. B'yi tekrar mesaj attır → hiçbir değişiklik.
8. `GET /me/referrals` doğru toplamları ve B'yi `subscribed` durumunda dönüyor.

Canlı doğrulama (app2 / api2) teslim ritmine uygun olarak **en sonda tek
geçişte** yapılacak — ve app2 üretim DB'sini okuduğu için orada gerçek bir
davet zinciri kurmak yerine yalnızca ekranların render'ı doğrulanacak.

---

## Bu planın kapsamı dışında bıraktıklarım

- **Aynı cihaz/IP sezgiselleri** — bilerek yok (§6/11).
- **Referrer başına ömürlük tavan** — bilerek yok (§2).
- **v1 restore atfı** — teknik olarak mümkün değil (§Gerçek 3).
- **`app.langx.io` → deployment yönlendirmesi** — önceden var olan açık madde;
  bu plan onun kapanacağını varsaymıyor, web akışıyla çalışıyor.
- **GitBook staking/trading geri çekmesi** — lansman ön koşulu olarak
  öneriyorum ama senin kararın; kod işini bloklamıyor.
