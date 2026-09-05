# Chat akıcılığı, mesaj eylemleri ve aktivite haritası

## Context

Üç istek: chat'in WhatsApp gibi akıcı olması, reply/reaction ve alıntıya
tıklayınca hedefe gitmek, ve profilde token harcanarak doldurulabilen GitHub
tarzı aktivite karesi.

**Bu plan güncel `main` (`360c62f6`) üzerine yazıldı.** `langx-20` oturumu
istenen işin bir kısmını çoktan yaptı; aşağıdaki "zaten var" satırları o yüzden
plana dahil — tekrar yazılmayacak, üstüne inşa edilecek.

| Zaten var (main'de) | Nerede |
| --- | --- |
| Mesaj geçmişi `useInfiniteQuery` + cursor sayfalama | `queries.ts:246`, commit `9235aaae` |
| Sayfa-farkındalıklı cache yamaları (`appendIncomingMessage`, `applyDeliveredAt`, `flattenMessagePages`) | `src/lib/messageCache.ts` |
| Spinner yerine iskelet satırlar | `components/skeletons/MessageBubbleSkeleton.tsx`, `lib/listState.ts` |
| Uzun basma menüsü + eylem matrisi (copy / translate / correct / report) | `lib/messageActions.ts`, `lib/messageMenu.ts`, commit `99788921` |
| `expo-clipboard`, `errorCodeOf`, `openPaywall` düzeltmeleri | aynı commit |
| `reportSchema.messageId` | `packages/shared/src/moderation.ts` |

Geriye kalan asıl problem ikiye indi:

1. **Liste hâlâ ters değil.** `onContentSizeChange` → `requestAnimationFrame(scrollToEnd)`,
   `atBottom` guard'ı ve `onScroll` offset eşiğiyle eski sayfa yükleme
   (`chat/[id].tsx:321-360`). Guard titremeyi hafifletiyor ama eski sayfa
   geldiğinde içerik hâlâ kayıyor, `renderItem` hâlâ inline closure, dibe
   inmenin kısayolu yok.
2. **Mesajın kendisini değiştiren hiçbir eylem yok.** Peer'ın kendi commit
   mesajının dediği gibi: reply, edit, react, star, pin, delete ve forward'ın
   her biri `Message`'a bir alan **ve var olan bir mesajı mutasyona uğratacak
   ortak bir yol** istiyor. Paket 3 tam olarak o ortak yol + üstündeki yedi
   eylem.

## Kararlar

- Liste **`inverted`** (RN web'de `maintainVisibleContentPosition` yok).
- Zıplama **sunucuda** `?around=<messageId>`; star listesi ve pin banner'ı da
  aynı mekanizmayı kullanır.
- Uzun basma → emoji şeridi + **iki sayfalı menü** (screenshot'taki gibi:
  primary + `More…`).
- **Forward yok.** Herkesten silme **2 gün** içinde. **Düzeltilmiş mesaj
  düzenlenemez.**
- Gün onarımı: **300 token, son 14 gün, ayda 2 hak** (`TOKEN_RULES.sinks`).
- Aktivite haritası başkalarında da görünür, ayarlardan kapatılabilir,
  varsayılan açık.
- Yeni bağımlılık **yok** (`expo-clipboard` zaten geldi; `expo-blur` ve
  `react-native-gesture-handler` istemiyoruz).

---

## Paket 1 — `chat/smooth-list` (kalan kısım)

**Dosyalar:** `apps/mobile/app/(app)/chat/[id].tsx`,
`apps/mobile/src/lib/messageCache.ts`, yeni
`apps/mobile/src/components/MessageBubble.tsx`, yeni `lib/messageGroups.ts`.

1. `FlatList` → **`inverted`**. Şunlar tamamen silinir: `onContentSizeChange`,
   `requestAnimationFrame(scrollToEnd)`, `atBottom` ref'i, `BOTTOM_ANCHOR_SLACK`,
   `OLDER_MESSAGES_THRESHOLD` ve `onScroll` eşiği. Dip artık offset 0 olduğu
   için "yeni mesajda dipte kal" bedava; eski sayfa **listenin sonuna** eklendiği
   için görünen içerik hiç kaymaz — peer'ın yorumda itiraf ettiği "yukarı
   kaydırmayı imkânsız kılan" yank ortadan kalkar.
2. `flattenMessagePages` ters çevirmeyi bırakır (inverted liste zaten
   yeni→eski ister). Fonksiyonun sözleşmesi ve `messageCache.test.ts`
   güncellenir; `appendIncomingMessage` `pages[0]`'a eklemeye devam eder.
3. Eski sayfa yükleme `onEndReached` + `onEndReachedThreshold` ile — ters
   listede "son" geçmiştir, ve `onStartReached`'in RN web'de olmaması sorunu
   böylece ortadan kalkar. `ListFooterComponent` eski-sayfa spinner'ı olur.
4. **`MessageBubble`** ayrı dosya + `React.memo`. Çeviri state'i satırın içine
   iner, `renderItem` referansı sabitlenir; bugün tek bir çeviri isteği tüm
   baloncukları yeniden render ediyor. Baloncuk ölçülebilir bir `ref` tutar —
   Paket 3'ün overlay'i bunu kullanır.
5. **"Dibe in" FAB'ı**: yukarıdayken beliren, okunmamış sayısını gösteren
   buton; `scrollToOffset({ offset: 0, animated: true })`.
6. Gün ayıracı ("Bugün / 12 Ağustos") + aynı kişinin ardışık mesajlarını
   gruplama — saf fonksiyon `lib/messageGroups.ts`, vitest'te test edilir
   (mobil vitest `react-native`'e dokunamıyor).
7. Android'de `KeyboardAvoidingView`'a `behavior` verilmemiş; composer'ı klavye
   örtüyor.

## Paket 2 — `chat/reply`

**Shared** (`packages/shared/src/chat.ts`):
`replyTo?: { messageId, senderId, type, preview }` — snapshot,
`correction.original` ile aynı desen (hedef silinse bile alıntı okunur kalır).
`sendTextMessageSchema` ve `sendMediaMessageSchema`'ya `replyToMessageId`.

**API** (`modules/chat/messages.ts`): hedefin aynı conversation'da olduğu
doğrulanır — `sendCorrection`'daki `targetMessageId` kontrolünün aynısı.

**Around penceresi** (`listMessages` + `routes/messages.ts`):
`GET /conversations/:id/messages?around=<messageId>` → hedefin N öncesi + N
sonrası tek çağrıda. Cursor zaten `(createdAt, _id)` çifti
(`lib/dateIdCursor.ts`), yani iki `find` + birleştirme; her iki yöne de cursor
döner. Client o pencereye ışınlanır, `scrollToIndex` + baloncuğu ~1sn vurgular.
**Bu endpoint üç yerde kullanılacak:** reply alıntısı, pin banner'ı, starred
listesi.

**UI:** sağa kaydır = reply (`PanResponder` + reanimated, ikisi de mevcut),
menüde `reply` maddesi, composer üstünde alıntı çubuğu (bugünkü "Correcting:"
banner'ının kardeşi), baloncuk içinde tıklanabilir alıntı bloğu.

---

## Paket 3 — mesaj eylemlerinin tamamı

Peer stage one'ı (`Message`'a alan gerektirmeyen dört eylem) yaptı. Stage two
bu. İki PR'a bölünüyor çünkü ilki ortak altyapıyı kuruyor, ikincisi onu
tüketiyor — ama tasarım tek parça.

### 3a — `chat/message-mutations` (ortak altyapı + react + delete)

**Sunucu altyapısı** — yeni `apps/api/src/modules/chat/mutations.ts`:
`loadMutableMessage(db, userId, messageId)` → `assertConversationAccess`'ten
geçer, `{ conversation, message }` döner. **Her mutasyon buradan geçer**;
"socket events pass through the same guards as REST" kuralının tek uygulama
noktası. Her mutasyon tek bir fan-out event'i yayar: **`message:updated`**,
yükü güncellenmiş mesajın tamamı. Silme de ayrı event değil — gövdesi
temizlenmiş bir `message:updated`.

**İstemci altyapısı** — `messageCache.ts`'e `applyMessageUpdate(pages, message)`:
id ile sayfalar arasında değiştirir, `applyDeliveredAt`'in `changed` guard'lı
şeklinin aynısı. `useSocket.ts` tek bir yeni dinleyici alır.

**Eylem matrisi** — `messageActions.ts` genişler: `MESSAGE_ACTION_IDS`'e
`reply`, `react`, `edit`, `star`, `pin`, `delete`; her eyleme
`page: 'primary' | 'more'` alanı. Screenshot'taki iki sayfalı menü böylece
**test edilebilir saf fonksiyon** olarak kalır (`messageActions.test.ts` var).

**Overlay (screenshot):** uzun basışta baloncuk `measureInWindow` ile ölçülür,
tam ekran mutlak katman açılır (Modal değil — RN web'de sorunlu), baloncuğun
kopyası ölçülen koordinata çizilir; **emoji şeridi üstte, menü altta**, ekran
kenarına yakınsa flip. Arka plan düz karartma (`rgba(0,0,0,0.4)`); blur
`expo-blur` gerektirdiği için yok. `messageMenu.ts`'in mevcut
subscribe/resolve deseni korunur, sadece host bileşeni bu overlay'e dönüşür.

**Reaction:** `reactions?: Array<{ userId, emoji, at }>`. 1-1 sohbet, en fazla
iki kayıt; kullanıcı başına tek reaction — aynısına basmak kaldırır, farklısına
basmak değiştirir. Şerit: 👍 ❤️ 😂 😮 😢 🙏 🔥 (`MESSAGE_REACTIONS`,
`packages/shared/src/chat.ts`); WhatsApp'ın ❤️‍🔥'ü yerine düz 🔥, seri sembolü
zaten o (`colors.streak`). `+` kendi ızgaramızı açar (~64 emoji, tek sayfa).
Rozet baloncuğun alt köşesinde. Socket `message:react`, `EVENT_LIMITS`'e kendi
kovası. **Token ödemez, `dailyActivity`'ye yazmaz, streak'i ilerletmez** —
`recordMessage`/`awardForSend` yoluna hiç girmez, yoksa emoji basarak farm
edilir. Push bildirimi yok.

**Delete — iki ayrı şey:**
- *Delete for me*: `hiddenFor: string[]`; `listMessages` filtresine
  `hiddenFor: { $ne: userId }` eklenir. Fan-out yok, sadece aktörün cache'i.
- *Delete for everyone*: yalnızca gönderen, `MESSAGE_DELETE_WINDOW_MS` = **2 gün**
  (WhatsApp'ınki gibi) içinde. Daha eskisi için "benden sil" hep açık kalır.
  Uygulama şekli hazır: hesap purge'ü (`modules/account/deletion.ts:165`) zaten
  `$set: { body: '' }, $unset: { correction: '', media: '' }` yapıp satırı
  bırakıyor — aynı desen, `deletedAt` + `deletedBy` ile. Baloncuk "This message
  was deleted" olur.
- Medya baytları da gider: `StorageProviderWithPut.keyFromPublicUrl` +
  `deleteObject` — purge'ün kullandığı ikilinin aynısı. Forward planda
  olmadığı için bir blob'a yalnızca tek mesaj bakar; referans sayımı gerekmez.
- Yan etkiler tek repository fonksiyonunda: silinen mesaj `lastMessage` ise
  yeniden hesaplanır, hâlâ okunmamışsa `unread[recipientId]` düşürülür.
- **Token geri alınmaz.** Ledger append-only ve günlük cap *gönderimi* sayıyor,
  dolayısıyla gönder-sil döngüsüyle farm edilemez. Geri almak `adjustment`
  satırı gerektirirdi ve hiçbir şey kazandırmazdı.
- Correction'ların `original`'ı ve reply'ların `preview`'u snapshot olduğu için
  ayakta kalır — snapshot'ı bunun için seçtik.

### 3b — `chat/message-extras` (star, pin, edit)

- **Star**: özel, kullanıcıya ait. `starredBy: string[]` + index
  `{ starredBy: 1, createdAt: -1 }` (sparse). Yeni ekran `/(app)/starred`;
  satıra dokunmak `?around=` ile mesaja gider. Fan-out yok.
- **Pin**: konuşma başına, iki taraf da görür.
  `conversation.pinned?: { messageId, byUserId, at }` — v1'de **tek** pin,
  yenisi eskisinin yerine geçer (`MAX_PINNED_PER_CONVERSATION`). Thread'in
  üstünde banner, dokununca `?around=` ile zıplar. Socket
  `conversation:pinned`. 1-1 sohbet olduğu için iki taraf da pinleyip
  kaldırabilir.
- **Edit**: yalnızca kendi **metin** mesajın, `MESSAGE_EDIT_WINDOW_MS` içinde.
  `editedAt` + baloncukta "Edited". Mesaj `lastMessage` ise
  `conversation.lastMessage.body` da güncellenir. **Yeni token ödenmez.**
  - **Düzeltilmiş mesaj kilitlenir.** Karşı taraf bir mesaja correction
    yazdıysa o mesaj artık düzenlenemez; menüde Edit yerine "Corrected —
    can't be edited" görünür. Aksi hâlde correction'ın `original` snapshot'ı
    ekranda artık var olmayan bir cümleyi gösterir ve öğretim kaydı yalan olur.
  - Uygulaması ek sorgu istemiyor: `sendCorrection` hedef mesajı zaten yüklüyor
    (`modules/chat/messages.ts`), aynı yolda hedefe `correctedAt` damgası
    basılır; menü de client'ta o alana bakar.
  - Correction'ın kendisi de düzenlenemez — aynı gerekçe, ters yönden.

> **Forward planda yok** (senin kararın). Bir mesajı iletmek 1-1 dil değişiminde
> zayıf bir eylem, ve çıkarılması iki şeyi birden sadeleştiriyor: silmede blob
> referans sayımı ve `media.url` index'i gerekmiyor.

### Menünün son hâli

Emoji şeridi (7 + `+`), sonra:

| Sayfa | Maddeler |
| --- | --- |
| Primary | Reply · Correct · Translate · Copy · Delete |
| `More…` | Edit · Star · Pin · Report |

Görünürlük kuralları `messageActionsFor` içinde kalır ve testten geçer:
Correct/Translate/Report yalnızca karşının mesajında, Edit/Delete-for-everyone
yalnızca kendi mesajında ve süre içinde, Copy/Edit yalnızca gövde varsa,
Correct yalnızca `text`'te, Edit `correctedAt` damgalıysa hiç.

### Şema ve index özeti

`packages/shared/src/chat.ts`: `MESSAGE_REACTIONS`, `MESSAGE_EDIT_WINDOW_MS`,
`MESSAGE_DELETE_WINDOW_MS`, `MAX_PINNED_PER_CONVERSATION` — hiçbiri hard-code
edilmez. `Message`'a: `replyTo`, `reactions`, `hiddenFor`, `deletedAt`,
`deletedBy`, `editedAt`, `correctedAt`, `starredBy`. `Conversation`'a: `pinned`.
`apps/api/src/db/indexes.ts`'e: `{ starredBy: 1, createdAt: -1 }` (sparse) —
index elle açılmıyor.

---

## Paket 4 — `tokens/activity-map`

### Veri kaynağı

Yeni koleksiyon **`streakDays`** (`_id: "<userId>:<yerelGün>"`,
`{ userId, day, source: 'activity' | 'freeze' | 'purchase' | 'legacy' }`),
`recordQualifyingAction` (`modules/tokens/streak.ts`) içinde — zaten yazan yol
— tek ek upsert. Haritanın dolu/boş kaynağı bu; kare **yoğunluğu** (GitHub
tonu) `dailyActivity` sayaçlarından gelir. Gerekçe: streak **yerel** güne göre,
`dailyActivity` **UTC** gününe göre çalışıyor ve bugün hangi günlerin dolu
olduğunu hiçbir şey tutmuyor — sadece `lastQualifiedDay`. Onarımdan sonra
`streak.current`'ı yeniden hesaplayabilmek de bu kümeyi gerektiriyor.

### Gün onarımı

- `TOKEN_RULES.sinks`: `dayRepair: 300`, `dayRepairMaxAgeDays: 14`,
  `dayRepairPerMonth: 2`. (Freeze 200; onarım geriye dönük kolaylık olduğu için
  ondan pahalı.)
- Onay sayfası **etkiyi önceden söyler**: "12 Ağustos dolar, serin 4 günden 11
  güne çıkar, bakiyen 250 → 0". Hiçbir seriyi birleştirmeyen kare için de
  dürüstçe "bu kareyi doldurur ama serini değiştirmez" der. İsteğin özü burada.
- Bugün satın alınamaz (bugün kazanılır), gelecek gün gösterilmez, pencere dışı
  gün kilitli.
- Ledger'a `kind: 'spend'` negatif satır; `tokenAggregates`'e **dokunmaz**
  (liderlik tablosu satın alınamaz), `dailyActivity`'ye **yazmaz** (havuz payı
  satın alınamaz).
- `{ userId, day }` unique index; para ve gün aynı atomik `findOneAndUpdate`'te
  değişir — `wallet.ts`'in mevcut deseni.
- `repairDay()` `modules/tokens/wallet.ts` içinde, route ayrı:
  `POST /me/activity/:day/repair`. `GET /me/activity?from=&to=` → gün dizisi +
  fiyat/pencere/kalan hak.

### Gizlilik ve UI

`Profile`'a `privacy.activityMapVisible` (varsayılan açık — seri zaten public
profilde), `settings.tsx`'e anahtar. Başkasının profilinde ayrı endpoint
`GET /profiles/:handle/activity`, dolu/boş + ton, **sayı yok**, dokunma kapalı.
`me.tsx` içine `ActivityMap`: 7 satır × ~26 hafta, yatay kaydırmalı, bugünde
biten ızgara.

### Elle tutulan senkron

Yeni sink + fiyat `website/src/lib/data/token.ts` ve GitBook `docs/` içine;
iddialar `langx/docs/token-messaging-brief.md` ve
`docs/legal/promise-change.md` ile uyumlu olmalı. Kontrol eden otomasyon yok
(REPO_MAP "Links between repos").

---

## Sıra

1. `chat/smooth-list`
2. `chat/reply`
3. `chat/message-mutations` (3a)
4. `chat/message-extras` (3b)
5. `tokens/activity-map` (+ `website/` ve `docs/` senkron PR'ları)

Sıra bağlayıcı: 3a'nın `loadMutableMessage` + `message:updated` +
`applyMessageUpdate` üçlüsünü 3b'nin dört eylemi de kullanıyor, ve reply'ın
`?around=` penceresini pin banner'ı ile starred listesi de kullanıyor.

## Doğrulama

- `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` — CI'ın
  dördü de geçmeli.
- API (`ws/chat.test.ts`, `routes/messages.test.ts` genişletilir): reply hedef
  doğrulaması · `?around=` hedefi ortalıyor ve iki yöne de cursor veriyor ·
  reaction toggle/replace · **reaction ve gün onarımı token ödemiyor** ·
  delete-for-everyone yalnızca gönderen ve yalnızca 2 gün içinde · silinen mesaj
  `lastMessage` ise yeniden hesaplanıyor, `unread` düşüyor, blob bucket'tan
  gidiyor · edit yalnızca kendi metninde ve süre içinde · **correction gelen
  mesaj `correctedAt` alıyor ve artık düzenlenemiyor** · `hiddenFor` listeden
  düşüyor · aynı gün iki kez onarılamıyor · onarım `tokenAggregates`'e
  dokunmuyor.
- Mobil (saf fonksiyonlar): `messageActionsFor` matrisi (iki sayfalı menü
  dahil), `flattenMessagePages`'in ters çevirmeyi bıraktığı hâli,
  `applyMessageUpdate`, gün gruplama, harita ızgarası, onarım etki metni.
- Elde: droplet'te Expo web (`:8081`, inotify limiti yükseltilmiş) +
  Playwright — uzun sohbette yukarı kaydırma titremiyor mu, eski sayfa gelince
  içerik kaymıyor mu, alıntıya tıklayınca doğru mesaja gidip vurgulanıyor mu,
  overlay ekran kenarında doğru flip ediyor mu, boş kareye tıklayınca doğru
  etki metni ve doğru bakiye çıkıyor mu.
