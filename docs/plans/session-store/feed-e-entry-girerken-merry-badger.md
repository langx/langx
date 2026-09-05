# Feed: gönderi dili seçimi, "Gönderilerim" ekranı ve telaffuzun sayıya katılması

## Context

Üç ayrı istek, hepsi feed'in etrafında ve birbirinden bağımsız uygulanabilir.

**A — Gönderi dili sabit.** Feed'e yazarken başlık "Your sentence in Russian" /
"The word in Russian" görünüyor. Dil `apps/mobile/app/(app)/feed.tsx:124`'te
`me.data?.learning[0]?.code` ile belirleniyor ve hiç sorulmuyor; koddaki yorum
bunu "çoğu kişi tek dil öğreniyor" diye savunuyor. Ama Pro 2, Pro+ 5 dile izin
veriyor (`packages/shared/src/limits.ts:174,188,208`), yani bu kullanıcılar
ikinci dillerinde gönderi yazamıyor.

**B — Kendi gönderilerini görebileceğin hiçbir yer yok.** Hiçbir katmanda yok:
ekran yok, route yok, sorgu şemasında author filtresi yok. Kendi sorduğun bir
cümleye ulaşmanın tek yolu genel feed'i kaydırıp ona denk gelmek.
`corrections.tsx` *chat* düzeltmelerini, `starred.tsx` yıldızlı mesajları,
`likes.tsx` bir gönderiyi beğenenleri listeliyor — hiçbiri bu değil.

**C — Telaffuz kayıtları hiçbir profil sayısına girmiyor.** Profildeki
"Corrections" sayısı `countCorrectionsWritten`
(`apps/api/src/modules/tokens/corrections.ts:25`) = post düzeltmeleri + chat
düzeltmeleri. `pronunciationAnswers` koleksiyonu hiç okunmuyor. Telaffuz cevabı
aynı 10 token'ı ödüyor ama ayrı bir ledger `kind`'ı altında
(`pronunciation.ts:175`). Çoğunlukla telaffuz cevaplayan biri, token bakiyesi
aksini söylerken profilinde 0'a yakın bir sayı görüyor.

### Kararlar (kullanıcı onayladı)

- A: seçici yalnızca **2+** öğrenilen dil varken görünür; seçim **cihazda
  hatırlanır**; feed listesi dile göre filtrelenmez.
- B: **profilden açılan ayrı ekran** (`/(app)/my-posts` + `GET /me/posts`), feed'e
  sekme eklenmez. Hem düzeltme hem telaffuz soruları tek listede.
- C: telaffuz kayıtları **Corrections sayısına katılır**. Veritabanı
  **boşaltılmayacak** — sayı zaten saklanmıyor, her okumada canlı hesaplanıyor,
  dolayısıyla migration gerekmiyor.

### Kapsam dışı

- Feed **listesini** dile göre filtrelemek: `listFeedQuerySchema`'da `language`
  yok, `listFeed`'de dil koşulu yok ve `posts` üzerinde `language` içeren index
  yok (`apps/api/src/db/indexes.ts:369-393`). Ayrı bir sunucu işi.
- **Günlük havuz formülü.** Telaffuz cevapları `recordActivity` çağırmıyor
  (`pronunciation.ts:160-164`) ve bu bilinçli: ağırlıklar `website/` ve iki
  GitBook sayfasında yayımlanmış bir formül. C değişikliği **yalnızca ömür boyu
  sayıyı** etkiler, havuzu değil. Sonucu aşağıda açıkça not ediyorum.
- `discover.tsx:91` de sıralanmamış `learning[0]` kullanıyor ama orada sadece
  kozmetik bir "TR → ES" başlığı üretiyor. Tek satırlık takip işi.

---

# A — Composer'da gönderi dili seçimi

### A1. Yeni saf yardımcı: `apps/mobile/src/lib/postLanguage.ts`

`react-native` import etmez, böylece vitest yükleyebilir (mobil testlerin
`react-native` yükleyememesi bilinen kısıt). İki export:

- `postLanguages(learning): LanguageCode[]` — diziyi **kopyalayıp** `priority`'ye
  göre artan sıralar (API sıralamıyor: `apps/api/src/modules/profiles/profiles.ts:849`;
  `profile/[handle].tsx:110` elle sıralıyor), `code`'lara indirger,
  `isLanguageCode` (`packages/shared/src/languages.ts:219`) ile filtreler. Bu
  filtre hem tanınmayan kodları eler hem de `string → LanguageCode` daraltmasını
  yapar. `undefined` → `[]`.
- `resolvePostLanguage(languages, chosen: string | null): LanguageCode | undefined` —
  `chosen` listede varsa onu, yoksa `languages[0]`, o da yoksa `undefined`.

Yorumlar iki kararı taşımalı: sıralama neden var, ve `resolvePostLanguage` neden
`LanguageCode` değil `string | null` alıyor (saklanan tercihin bayatlamasına izin
vermek işin bütün amacı).

### A2. `apps/mobile/src/lib/localFlags.ts`

`FLAG_KEYS`'e `postLanguage: 'postLanguage'` eklenir; komşularındaki gibi neden
cihaz düzeyinde olduğunu anlatan yorumla. Bayat veya başka hesaba ait bir değer
tehlikesiz — A1'deki türetme onu zaten temizliyor.

### A3. `apps/mobile/src/components/ui/Chip.tsx`

Yalnızca `Pressable` dalına `accessibilityState={{ selected }}` (statik `View`
dalı kontrol değil). 19 çağrı yerinde güvenli ve ek. Bilerek
`accessibilityRole="radio"` **değil** — chip'ler başka yerlerde çoklu seçim için
kullanılıyor (`edit-profile`, `CountryPicker`), radio rolü orada yalan olurdu.

### A4. i18n: 8 katalogda bir yeni anahtar

`Localized<T>` eksik çeviriyi typecheck hatası yapıyor, sekizi de aynı commit'te.
`feed` altında, `askTitle` yanına:

| Dosya | Değer |
| --- | --- |
| `en.ts` | `postLanguage: 'Language to post in'` |
| `tr.ts` | `'Paylaşacağın dil'` |
| `es.ts` | `'Idioma en el que publicar'` |
| `ru.ts` | `'Язык публикации'` |
| `ar.ts` | `'لغة المنشور'` |
| `fr.ts` | `'Langue de la publication'` |
| `de.ts` | `'Sprache des Beitrags'` |
| `pt-BR.ts` | `'Idioma da publicação'` |

`askTitle` / `pronounceTitle` **değişmiyor** — zaten `{language}` dolduruyorlar,
artık değişken bir değer alıyorlar.

### A5. `apps/mobile/app/(app)/feed.tsx`

**Import'lar:** `postLanguages`, `resolvePostLanguage`; `Chip`; `FLAG_KEYS`,
`readFlag`, `writeFlag`. `CreatePostInput` tip import'u başka yerde
kullanılmıyorsa kalkar.

**State + türetme (`:119-124` yerine):**

```ts
const [chosenLanguage, setChosenLanguage] = useState<string | null>(null)
const askLanguages = useMemo(() => postLanguages(me.data?.learning), [me.data])
const askLanguage = resolvePostLanguage(askLanguages, chosenLanguage)
```

Çözülmüş değer **saklanmaz, her render'da türetilir**. Bayat seçimin cevabı bu:
kullanıcı o dili `edit-profile`'dan kaldırırsa seçim kendiliğinden varsayılana
düşer — uzlaştıran bir `useEffect` yok. Mevcut yorum "sormamayı" savunuyor,
yeniden yazılmalı.

**Kalıcılık** — `ThemeProvider.tsx:70-83` deseninin aynısı (`readFlag` async):

```ts
useEffect(() => {
  let cancelled = false
  void readFlag(FLAG_KEYS.postLanguage).then((stored) => {
    if (!cancelled && stored) setChosenLanguage(stored)
  })
  return () => { cancelled = true }
}, [])
```

Burada doğrulama yok — saklanan değer ham "istek" olarak girer,
`resolvePostLanguage` geçersizse varsayılana düşürür. Chip'e basınca
`setChosenLanguage(code)` + `void writeFlag(FLAG_KEYS.postLanguage, code)`.

**JSX** — `styles.compose` içinde, `:276`'daki `FormField`'ın hemen **üstüne**:

```tsx
{askLanguages.length > 1 ? (
  <View style={styles.languages} accessibilityLabel={t('feed.postLanguage')}>
    {askLanguages.map((code) => (
      <Chip
        key={code}
        label={names.language(code)}
        selected={code === askLanguage}
        onPress={() => choose(code)}
      />
    ))}
  </View>
) : null}
```

Alanın üstünde olması bilinçli: chip'e basınca hemen altındaki etiket gözle
görülür şekilde yeniden yazılıyor — satırın ne işe yaradığının tek açıklaması bu,
ayrı başlık gerekmiyor. Desen `filters.tsx:188-205`'ten.

**`submitAsk` (`:176-208`):** `as CreatePostInput['language']` cast'i ve iki
satırlık özür yorumu silinir, `language: askLanguage` doğrudan geçilir. Mevcut
`if (!askLanguage …) return` guard'ı `undefined`'ı zaten daraltıyor.

**Stil (`:691` civarı):** `languages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }`.
`marginTop` yok — `compose` zaten `gap: spacing.md` veriyor. `flexWrap`, 5 uzun
dil adının `SegmentedControl`'de yaşayacağı kırpılmayı önlüyor; bu ekrandaki
diğer iki kontrolün aksine `Chip` kullanılmasının sebebi bu.

`feed.tsx:274`, `:393` ve iki `SegmentedControl` değişmiyor.

### A6. Testler: `apps/mobile/src/lib/postLanguage.test.ts`

`dedupeById.test.ts` üslubunda. `postLanguages`: `priority`'ye göre sıralar —
`[{ru,2},{es,1}]` → `['es','ru']`; girdisini **mutasyona uğratmaz**; bilinmeyen
kodu eler; `undefined` → `[]`. `resolvePostLanguage`: geçerli seçimi korur;
`null` → ilk dil; **listede olmayan seçim → ilk dil** (düşürülmemesi gereken
test); boş liste → `undefined`.

---

# B — "Gönderilerim" ekranı

### B1. Sunucu: hidrasyonu ayıkla, sonra yeni okuma ekle

`apps/api/src/modules/feed/feed.ts` içindeki `listFeed`'in kuyruğu
(`:189-241` — özet okumaları, `loadAuthors`, `readLikeSummary`, `postDto`
eşlemesi) `hydratePosts(db, userId, items, { corrections, answers })` adında bir
yardımcıya ayıklanır. `listFeed` bugünkü davranışını korur (bölüme göre yalnızca
birini ister); yeni okuma **ikisini birden** ister, çünkü listesi karışık
kind'lı. `:191-196`'daki "her sekme diğerinin toplamasını ödemesin" gerekçesi
genel feed içindi; kendi gönderilerin küçük ve tek kullanıcılık bir liste.

Sonra `listMyPosts(db, userId, limit, cursor)`:
- Filtre yalnızca `{ authorId: userId }` — kind'a bakmaz (kullanıcı hem
  düzelttiklerini hem telaffuz sorularını istiyor), blok filtresi anlamsız
  (gönderiler zaten kendisinin).
- Sıralama `{ createdAt: -1, _id: -1 }`, `encodeFeedCursor(createdAt, _id, null)`
  ile düz keyset. `countField === null` dalı `feed.ts:167-175`'te zaten var.
- **Yeni index gerekmiyor:** `posts` üzerinde `{ authorId: 1, createdAt: -1 }`
  `author` index'i mevcut (`indexes.ts:375`) ve şu an yalnızca hesap silme
  tarafından kullanılıyor.

### B2. Şema ve route

- `packages/shared/src/feed.ts`: `listMyPostsQuerySchema = z.object({ cursor, limit })`
  (`listFeedQuerySchema`'nın `kind`/`filter`'sız hâli). Yanıt mevcut
  `feedPageSchema` / `FeedPage` — böylece istemci tarafında yeni bir tip yok.
- `apps/api/src/routes/feed.ts`: `app.get('/me/posts', { preHandler: requireAuth, schema: { querystring: listMyPostsQuerySchema } }, …)`.
  `/me/corrections` ve `/me/starred` ile aynı adlandırma (`messages.ts:111,128`).
- Testler `apps/api/src/routes/feed.test.ts`'e: her iki kind'ın da döndüğü,
  başkasının gönderisinin dönmediği, sayfalamanın sınırda tekrar/atlama
  yapmadığı.

### B3. İstemci sorgusu

`apps/mobile/src/api/queries.ts`: `useMyPosts()` — `useInfiniteQuery`,
`api.get<FeedPage>('/me/posts…')`. Sorgu anahtarı **`['feed','mine']`** olmalı:
gönderi oluşturma/silme zaten `invalidateQueries({ queryKey: ['feed'] })` ile
önek geçersizleştiriyor (`queries.ts:748,774,892,904`), böylece yeni ekran
bedavaya tazeleniyor. `keys` fabrikasına (`queries.ts:105` civarı) `myPosts`
eklenir.

### B4. Ekran: `apps/mobile/app/(app)/my-posts.tsx`

`corrections.tsx` şablonu birebir: `Screen` + `ScreenHeader` (`goBackTo('/(app)/me')`),
`FlatList`, `listState`, `dedupeById`, `EmptyState`, `onEndReached` ile sayfalama.

Satır **kompakt** olmalı, feed kartının kopyası değil: `feed.tsx`'teki
`renderItem` (`:375`) ekranın düzeltme state'ine ve mutasyonlarına kapanan
satır içi bir closure — paylaşılan bir kart bileşeni yok ve ayıklamak bu işin
kapsamını iki katına çıkarır. Satır gösterir: gövde (2 satır), kind rozeti
(düzeltme / telaffuz), `names.language(item.language)`, düzeltme veya kayıt
sayısı, göreli zaman. Dokununca `openPost(item._id, '/(app)/my-posts')`
(`src/lib/navigation.ts:42`).

### B5. Giriş noktası: `apps/mobile/app/(app)/me.tsx`

`:167`'deki "Who viewed your profile" satırının **üstüne** bir `ListRow`
(`title={t('me.myPosts')}`, `onPress={() => router.push('/(app)/my-posts')}`).
`ListRow` `onPress` varken chevron'u kendi çiziyor (`ListRow.tsx:54`).

Dördüncü bir `StatTile` **değil**: `:129-154`'teki sıra üç `flex: 1` tile ile
dolu, dördüncüsü sıkıştırır.

`profile/[handle].tsx` değişmiyor — o başkalarının profili; kullanıcının kendi
profili `me.tsx`.

### B6. i18n: 4 yeni anahtar × 8 dil

`me.myPosts` ("Your posts") ve yeni bir `myPosts` bloğu: `title`
("Posts you wrote"), `emptyTitle` ("Nothing asked yet"), `emptyBody`
("Ask about a sentence you are unsure of, or a word you cannot say — it appears
here."). Sekiz katalog da aynı commit'te.

---

# C — Telaffuz kayıtlarını Corrections sayısına katmak

### C1. `apps/api/src/modules/tokens/corrections.ts`

`countCorrectionsWritten`'a üçüncü bir sayım eklenir:

```ts
db.collection(COLLECTIONS.pronunciationAnswers).countDocuments({ authorId: userId })
```

`pronunciationAnswers` üzerinde `author_recent` = `{ authorId: 1, createdAt: -1 }`
index'i zaten var (`indexes.ts:406`), yani sayım index'li. Fonksiyonun başındaki
doc yorumu ("in a thread or on a post") yeniden yazılmalı: artık üç kaynak var ve
neden bir arada sayıldıkları — hepsi birinin kendi zamanını bir yabancının
cümlesine harcaması.

**Migration yok.** Sayı saklanmıyor, her okumada hesaplanıyor; değişiklik
deploy anında geçmişe dönük olarak yürürlüğe girer.

### C2. Artık yanlış olan yorumları düzelt

İki yerde bu ayrımı savunan yorum var ve C onları yanlışlıyor:
- `apps/api/src/modules/feed/pronunciation.ts:152-158` — "Its own kind because
  the correction badges and cosmetic gates count corrections *written*, and
  folding a different act into that number moves a threshold that names the
  other one."
- `packages/shared/src/token.ts:22-30` — aynı gerekçenin kopyası.

Ledger `kind`'ı **ayrı kalıyor** (refId, havuz ve raporlama için hâlâ doğru);
düzeltilmesi gereken tek şey, sayının artık ikisini birden kapsadığı. Her iki
yorum da yeni kararı ve gerekçesini söyleyecek şekilde güncellenir.

### C3. Bilerek kabul edilen sonuçlar

- **Rozetler ve kozmetik kapılar yukarı kayar.** Aynı fonksiyon
  `apps/api/src/modules/tokens/badges.ts:63` ve `wallet.ts:107` tarafından da
  okunuyor; telaffuz cevaplayanlar rozet ve kozmetik kazanır. Kullanıcı bunu
  kabul etti — v2 henüz yayında değil, veriler test verisi.
- **Haftalık grafik hemfikir olmayacak.** `me.tsx`'teki ömür boyu tile telaffuzu
  sayacak, altındaki `WeeklyChart` saymayacak — çünkü telaffuz cevapları
  `recordActivity` çağırmıyor ve günlük havuzun ağırlıkları `website/` ile iki
  GitBook sayfasında yayımlanmış bir formül. Havuzu değiştirmek bir "pool
  rebalance", bu işin parçası değil. Bunu bilerek bırakıyorum; rahatsız ederse
  ayrı bir iş olarak konuşalım.
- **Etiket "Corrections" kalıyor.** Sayı artık iki farklı eylemi topluyor, ama
  yeniden adlandırmak 8 dil + site + doküman demek. Şimdilik değişmiyor.

### C4. Elle senkron (CLAUDE.md kuralı)

`docs/token/utility.md:71-72` kozmetik kapıyı "corrections" diye anlatıyor.
Kapının eşiği artık telaffuz kayıtlarını da kapsadığı için bu cümle güncellenir.
`docs/learn-2-earn/daily-tokens.md:41` (günlük havuz ağırlıkları) **değişmiyor** —
havuza dokunmuyoruz. `website/` tarafında token ödül oranları değişmediği için
değişiklik yok; yine de `website/src/lib/data/token.ts` gözden geçirilir.

---

## Sıralama

A, B ve C birbirinden bağımsız; ayrı dallar ve ayrı PR'lar olmalı
(`main`'den `origin/main`'e dallanarak).

- **A:** A1+A6 → A2 → A3 → A4 → A5. i18n anahtarını ekrandan önce koymak her
  commit sınırında `pnpm -r typecheck`'i yeşil tutar.
- **B:** B1 (ayıklama, davranış değişmeden — mevcut feed testleri yeşil kalmalı)
  → B2 → B6 → B3 → B4 → B5.
- **C:** C1 → C2 → C4. En küçüğü; tek başına gidebilir.

## Doğrulama

- `pnpm test` — A'nın yeni lib suite'i; B'nin route testleri; C için mevcut
  token/badge testleri, telaffuz cevabı sonrası sayının arttığını gösteren yeni
  bir assert ile.
- `pnpm -r typecheck` — 8 katalogda yeni anahtarların varlığını ve A5'teki
  cast'in kaldırılabildiğini kanıtlar.
- `pnpm lint`, `pnpm format:check`.
- Droplet'te Expo web (`pnpm dev`, Metro :8081, Playwright).
  **Ön koşul:** ≥2 öğrenilen dili olan bir hesap (pro/pro_plus) —
  `src/lib/fakePurchases.ts` + `edit-profile`'dan ikinci dil.
  1. **A / tek dilli hesap:** composer eskisiyle birebir aynı, chip satırı yok.
  2. **A / çok dilli:** chip'ler `priority` sırasında, ilki seçili; ikincisine
     basınca `FormField` etiketi yeniden yazılıyor; gönderi sonrası kartta
     `names.language(item.language)` seçilen dili gösteriyor.
  3. **A / bölüm geçişi:** `pronunciation`'a geç — chip'ler duruyor, etiket aynı
     dille `pronounceTitle`'a dönüyor.
  4. **A / kalıcılık:** sayfayı yenile, seçim korunuyor.
  5. **A / bayat seçim:** ikinci dil seçiliyken `edit-profile`'dan o dili sil ve
     geri dön — seçim kalan dile atlıyor.
  6. **B:** bir düzeltme sorusu ve bir telaffuz sorusu gönder; `me.tsx` →
     "Your posts" ikisini de yeni-önce gösteriyor; bir satıra dokununca doğru
     `post/[id]` açılıyor; gönderiyi silince liste kendiliğinden tazeleniyor
     (`['feed']` önek geçersizleştirmesi).
  7. **B / izolasyon:** ikinci bir hesapla gönderi at, ilk hesabın listesinde
     görünmediğini doğrula.
  8. **C:** bir telaffuz isteğine kayıt bırak; `me.tsx`'teki "Corrections"
     tile'ının 1 arttığını doğrula. Aynı turda haftalık grafiğin **artmadığını**
     da gör — bu beklenen davranış (C3).
  9. `ar` ile RTL kontrolü (chip satırı `flexWrap` ile sarıyor).

## Riskler

- **B1'deki ayıklama** canlı feed'in okuma yolunu ellliyor. Davranış değişmeden,
  mevcut `feed.test.ts` yeşil kalarak yapılmalı — B'nin ilk ve ayrı commit'i bu.
- **C** rozet ve kozmetik eşiklerini geçmişe dönük kaydırır. Kullanıcı kabul
  etti; v2 yayında değil.
- Küçük telefonda 5 uzun dil adının satır kaydırması composer'ı uzatır — kabul,
  `filters.tsx`'in zaten yaptığı takas.
- `Chip`'teki `accessibilityState` paylaşılan bileşene dokunuyor; ek bir
  değişiklik, hiçbir görsel çıktıyı değiştiremez.
