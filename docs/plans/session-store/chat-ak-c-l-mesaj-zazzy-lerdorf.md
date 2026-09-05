# Chat akıcılığı, mesaj eylemleri ve aktivite haritası

> **Taban güncellendi — 29 Ağustos 2026.** Plan `main@360c62f6` üzerine
> yazılmıştı; araya PR #968 (on ekranlık mobil v2 redesign, 14 commit, 94
> dosya) rebase-merge edildi. Geçerli taban **`main@853e78bc`**.
>
> **Paket A (açık/koyu tema) bu merge'de yapıldı — düşürüldü.** Dosyanın
> sonundaki bölüm kayıt olarak duruyor; uygulanan hâlin denetimi ve kalan dört
> açık madde orada.
>
> Paket 1–4 hâlâ geçerli: `chat/[id].tsx` 665 → 827 satır olarak yeniden
> yazıldı ama Paket 1'in hedeflerinin hepsi duruyor (`inverted` yok, `atBottom`
> + `onContentSizeChange` + `rAF(scrollToEnd)` yerinde, `renderItem` inline,
> Android'de `behavior` yok).
>
> **Tema API'si değişti.** `src/lib/theme.ts` artık `src/lib/theme/`; modül
> seviyesindeki `StyleSheet.create` yerine
> `const useStyles = makeStyles(({ colors }) => ({ … }))` + bileşen içinde
> `const styles = useStyles()`. Yeni yazılacak `MessageBubble` ve overlay bu
> deseni kullanır, `colors` import etmez. Stil sonucu şema başına
> önbellekleniyor, yani satır bileşeninde ek maliyet yok.

## Context

Üç istek: chat'in WhatsApp gibi akıcı olması; reply/reaction ve alıntıya
tıklayınca hedefe gitmek; profilde token harcanarak doldurulabilen GitHub tarzı
aktivite karesi.

`langx-20` oturumu işin ilk yarısını `main`'e aldı: `useInfiniteQuery` + cursor
sayfalama (`src/api/queries.ts:246`), sayfa-farkındalıklı cache yamaları
(`src/lib/messageCache.ts`), iskelet satırlar, uzun basma menüsü + saf eylem
matrisi (`src/lib/messageActions.ts`, `src/lib/messageMenu.ts`),
`reportSchema.messageId`. Bunlar tekrar yazılmaz, üstüne inşa edilir.

Geriye kalan iki asıl problem:

1. **Liste hâlâ ters değil.** `onContentSizeChange` → `rAF(scrollToEnd)`,
   `atBottom` guard'ı ve `onScroll` offset eşiği (`chat/[id].tsx:330-436`).
   Guard titremeyi hafifletiyor ama eski sayfa geldiğinde içerik kayıyor,
   `renderItem` hâlâ inline closure, dibe inmenin kısayolu yok.
2. **Mesajın kendisini değiştiren hiçbir eylem yok.** `messageActions.ts:32`
   bunu kendi yorumunda söylüyor: reply/edit/react/star/pin/delete'in her biri
   `Message`'a bir alan **ve var olan bir mesajı mutasyona uğratacak ortak bir
   yol** istiyor. Paket 3 o ortak yol + üstündeki eylemler.

## Keşifte çıkan düzeltmeler

Aşağıdakiler ilk plandaki varsayımları geçersiz kılıyor:

| Plandaki | Gerçek |
| --- | --- |
| `apps/mobile/src/lib/queries.ts` | `apps/mobile/src/api/queries.ts` |
| `src/lib/useSocket.ts` | `src/hooks/useSocket.ts` |
| `apps/api/src/ws/chat.ts` | `apps/api/src/ws/index.ts` (test `ws/chat.test.ts`) |
| `packages/shared/src/chat.ts` içinde `Message` şeması | Orada sadece sabitler + istek/query zod şemaları. `Message`/`Conversation` sunucu TS arayüzleri: `apps/api/src/modules/chat/conversations.ts:15-55`. Mobil aynası `MessageDto` (`src/api/queries.ts:233`) |
| "PanResponder + reanimated, ikisi de mevcut" | `react-native-gesture-handler` **apps/mobile'dan çözülmüyor**. `react-native-reanimated` bağımlılıkta ama **sıfır import** var ve `babel.config.js`'te worklets plugin'i açıkça yazılı değil. Tüm animasyon legacy RN `Animated` ile. `PanResponder` repoda hiç kullanılmamış ama core RN, sorunsuz |
| `flattenMessagePages` "ters çevirmeyi bırakır" | Yetmez. Sayfa içi `items` **eski→yeni** (API `items.reverse()` yapıyor, `messages.ts:240`), yani hem sayfa sırası hem sayfa içi ters çevrilmeli |
| Onarım "para ve gün aynı atomik update'te" | Para `profiles.tokenSpent`'te, gün ayrı koleksiyonda — tek update mümkün değil. Telafi edilebilir iki yazma gerekiyor (aşağıda) |
| `dayRepair` için `{userId, day}` unique index | Gereksiz: `_id = "<userId>:<gün>"` deseni (mevcut `dailyActivity` deseni) hem tekilliği hem aralık taramasını zaten veriyor |

Ek olarak `expo-clipboard` `package.json`'da ve `chat/[id].tsx:26`'da import
edilmiş ama `apps/mobile/node_modules`'da yok — işe başlamadan `pnpm install`.

## Kararlar

- Liste **`inverted`**; upright yol tamamen silinir (RN web'de
  `maintainVisibleContentPosition` yok). Web'de `scaleY(-1)` riski elde
  doğrulanır.
- Zıplama **sunucuda** `?around=<messageId>`; **ayrı query key** ile (canlı
  cache'e dokunulmaz). Star listesi ve pin banner'ı da aynı mekanizmayı
  kullanır.
- Uzun basma → emoji şeridi + iki sayfalı menü, **kök seviyede mutlak katman**
  (`ToastHost` deseni), Modal değil.
- **Forward yok.** Silme (herkesten) ve düzenleme penceresi **ikisi de 2 gün**,
  ama iki ayrı sabit olarak (`packages/shared` kuralı: eşik hard-code edilmez).
  **Düzeltilmiş mesaj düzenlenemez.**
- Gün onarımı: **300 token, son 14 gün, ayda 2 hak**.
- Aktivite haritasının hem dolu/boş'u hem tonu `streakDays`'ten gelir;
  `dailyActivity` hiç okunmaz.
- Yeni bağımlılık **yok** (`expo-blur`, `gesture-handler`, `reanimated`,
  `expo-haptics` hiçbiri).

---

## Paket 1 — `chat/smooth-list`

**Dosyalar:** `apps/mobile/app/(app)/chat/[id].tsx`,
`src/lib/messageCache.ts`, yeni `src/components/MessageBubble.tsx`, yeni
`src/lib/messageGroups.ts`.

1. **Satırı ayır — diğer her şeyin önkoşulu.** `MessageBubble.tsx`,
   `React.memo`'lu, üç tip dalını (correction / media / text) içeri alır.
   `renderItem` `useCallback`'e döner. Bileşen kendi `View` ref'ini tutar
   (Paket 3'ün `measureInWindow`'u) ve kendi `PanResponder`'ını (Paket 2).
   Ekrandaki `translations: Record<string,string>` state'i (`[id].tsx:62`)
   **kalkar** — map'i prop olarak geçmek `memo`'yu anlamsız kılıyor; çeviri
   Paket 3a'nın `applyMessageUpdate`'i ile cache'teki mesaja `translatedBody`
   olarak yazılır (navigasyondan da sağ çıkar).
2. **`flattenMessagePages` → `messagesNewestFirst(data)`.** Yeniden
   adlandırılır ki anlamı sessizce değişmesin; tek çağıran chat ekranı.
   Gövdesi: `data.pages.flatMap((p) => [...p.items].reverse())` + `!m.hidden`
   filtresi (Paket 3a). Cache'in tel şekli **değişmez**: `pages[0]` hâlâ en yeni
   sayfa, sayfa içi hâlâ eski→yeni, `appendIncomingMessage` hâlâ
   `pages[0].items`'ın sonuna ekler.
3. **`messageCache.test.ts`**: `'puts the oldest page first…'` testi
   `['new2','new1','old2','old1']` beklentisiyle yeniden yazılır. Bugünkü
   fixture'lar sayfa-içi ters çevirmeyi yakalamıyor — o yüzden yeni bir
   invariant testi eklenir:
   `messagesNewestFirst(appendIncomingMessage(data, m))[0]._id === 'fresh'`.
4. **FlatList:** `inverted`, `onEndReached={loadOlder}` (+
   `onEndReachedThreshold={0.4}`, `hasNextPage && !isFetchingNextPage`
   guard'ı korunur), `ListFooterComponent` = eski-sayfa spinner'ı (ters listede
   footer görsel olarak üsttedir), `onScrollToIndexFailed` (Paket 2).
   **Silinir:** `onContentSizeChange` + `rAF(scrollToEnd)`, `atBottom` ref'i,
   `OLDER_MESSAGES_THRESHOLD`, `onScroll` içindeki üst-sayfa dalı,
   `ListHeaderComponent`. `onScroll` sadece FAB için kalır.
5. **"Dibe in" FAB'ı:** ters listede dip `contentOffset.y <=
   BOTTOM_ANCHOR_SLACK`; buton `scrollToOffset({ offset: 0, animated: true })`,
   üstünde okunmamış sayısı. Gönderimde de aynı çağrı.
6. **Gün ayıracı + gruplama:** saf `src/lib/messageGroups.ts`, vitest'te test
   edilir (mobil vitest `src/lib/**` dışına bakmıyor, `react-native`
   import edemez).
7. `KeyboardAvoidingView` (`[id].tsx:456`) Android'de `behavior` almıyor;
   composer'ı klavye örtüyor. Düzeltilir.

**Risk:** RN web `inverted`'ı `scaleY(-1)` ile uyguluyor; wheel yönü ve DOM
sırası bozulabilir. Elde doğrulanacak (aşağıda). Bozulursa upright yol git
geçmişinde duruyor; kalıcı iki kod yolu tutmuyoruz.

## Paket 2 — `chat/reply`

**Shared** (`packages/shared/src/chat.ts`): `replyToMessageId` alanı
`sendTextMessageSchema` ve `sendMediaMessageSchema`'ya eklenir.
**Sunucu** (`Message` arayüzü, `conversations.ts`):
`replyTo?: { messageId, senderId, preview }` — snapshot, `correction.original`
ile aynı desen, hedef silinse bile alıntı okunur kalır.
`sendTextMessage`/`sendMediaMessage` hedefin aynı conversation'da olduğunu
`sendCorrection`'ın `findOne({ _id: targetId, conversationId })` kalıbıyla
doğrular (`messages.ts:118`).

### `?around=` penceresi — sunucu

- `listMessagesQuerySchema`'ya `around?` ve `after?`. **`.refine()`
  kullanılmaz** — `fastify-type-provider-zod` querystring'de `ZodEffects`'i
  kaldırmıyor; karşılıklı dışlama modülde `ApiError(VALIDATION_FAILED)` ile.
- `MessagePage`'e `prevCursor: string \| null` (yeni yön; `null` ⇒ sayfa canlı
  kuyruğa değiyor) ve `anchorId?`.
- Yeni `listMessagesAround(db, userId, conversationId, { around, limit })`:
  erişim → anchor'ı conversation'a scope'layarak yükle → `half = limit/2` ile
  iki `find` (eski: `$lt` + `{createdAt:-1,_id:-1}`; yeni: `$gt` +
  `{createdAt:1,_id:1}`) → birleştir → iki cursor. `listMessages`'a da `after`
  dalı eklenir (pencerenin kuyruğa doğru sayfalanması).
- **Index (`db/indexes.ts`):** artan `{createdAt:1,_id:1}` sıralamasını mevcut
  `conversation_created` karşılamıyor (bellekte SORT'a düşer). **Yeni adla**
  `conversation_created_id` = `{ conversationId: 1, createdAt: -1, _id: -1 }`
  eklenir — bileşik index iki yönde de yürür. Mevcut index'i yerinde yeniden
  adlandırmak `IndexOptionsConflict` (85) verir; eskisi ayrı bir işte düşer.
- Route aynı yol, aynı erişim kapısı, aynı yanıt şekli
  (`routes/messages.ts`'te dal).

### `?around=` penceresi — istemci

**Ayrı query key.** Canlı sorguyu çift yönlü yapmak (`getPreviousPageParam`)
"`pages[0]` en yeni sayfadır" invariant'ını kırıyor — `appendIncomingMessage`,
`useSocket` ve üç doc yorumu buna dayanıyor. Bunun yerine:

- `keys.messagesAround = (id, anchorId) => ['messages', id, 'around', anchorId]`
  — `keys.messages(id)` bunun **öneki**, socket yamaları bu yüzden ikisine de
  ulaşıyor.
- `useMessageWindow(conversationId, anchorId)` çift yönlü infinite query;
  pencerenin ekleme hedefi ve invariant'ı olmadığı için çift yön burada
  serbest. Aynı yönelimde oluştuğu için `messagesNewestFirst` ikisine de olduğu
  gibi hizmet eder.
- `appendIncomingMessage`'a tek guard: `if (first.prevCursor) return data` —
  canlı sayfalar `prevCursor` taşımadığı için davranış aynı kalır, ama tarih
  ortasındaki bir pencereye taze mesaj eklenmez.
- `useSocket.ts`'teki her `setQueryData(keys.messages(id), …)` →
  `setQueriesData({ queryKey: keys.messages(id) }, …)`.
- Hedef zaten yüklü sayfalardaysa fetch yok: saf `src/lib/messageJump.ts` →
  `planJump(items, messageId): { kind:'scroll'; index } | { kind:'fetch'; anchorId }`.
  `scrollToIndex` değişken yükseklikli satırlarda `getItemLayout` olmadan
  **fırlatır**; `onScrollToIndexFailed` zorunlu.
- Giriş noktası tek: `/(app)/chat/[id]?at=<messageId>`. Alıntı dokunuşu, pin
  banner'ı, starred listesi ve ileride push aynı yolu kullanır. "Jumped"
  modundan çıkış: pill, gönderim, ya da kendi `message:new`'in.

**UI:** sağa kaydır = reply (`PanResponder` + legacy `Animated`; saf
`src/lib/swipeToReply.ts` → `shouldCaptureSwipe(dx,dy)`,
`swipeTranslation(dx)`, `swipeReleased(dx)`). Kilit `dx > 10 && dx >
|dy|*1.5` — hafif çapraz hareket kaydırma olarak kalır.
`onMoveShouldSetPanResponder` kullanılır, **capture faz asla** (ScrollView'dan
çalar, dikey kaydırma ölür). Web'de responder kapatılır
(`Platform.OS === 'web' ? {} : panHandlers`): fare sürüklemesi metin seçimiyle
kavga ediyor, trackpad yatayı `wheel` event'i, yani hiç ateşlemiyor — yarım
çalışan jest, olmayandan kötü. Tarayıcıda Reply menüden.
Ayrıca: menüde `reply` maddesi, composer üstünde alıntı çubuğu (bugünkü
"Correcting:" banner'ının kardeşi), baloncuk içinde tıklanabilir alıntı bloğu.

---

## Paket 3a — `chat/message-mutations`

### Önkoşul: tel projeksiyonu

`listMessages` bugün ham `Message` belgeleri döndürüyor. `starredBy`/`hiddenFor`
eklenip ham gönderilirse karşı taraf neyi yıldızladığını görür. Yeni saf
`apps/api/src/modules/chat/messageView.ts`:
`toMessageView(message, viewerId)` — `starredBy`/`hiddenFor` düşer, yerine
`starred`/`hidden` boolean'ları; `deletedAt` varsa `body:''` + `media` düşer +
`deleted:true`; `reactions` bütün kalır + `myReaction`. `listMessages`,
`listMessagesAround`, `fanOutMessage` ve güncelleme fan-out'u aynı şekli
kullanır. Mongo'suz test edilir.

### Sunucu altyapısı

Yeni `apps/api/src/modules/chat/mutations.ts`:

```ts
loadMutableMessage(db, userId, conversationId, messageId)
  : Promise<{ message: Message; conversation: Conversation }>
reactToMessage / editMessage / deleteMessage / starMessage
  (db, userId, input): Promise<MessageMutationResult>
// MessageMutationResult = { message, conversation, audience: 'both' | 'actor' }
```

`loadMutableMessage` = `assertConversationAccess` (`modules/chat/access.ts:17`)
→ conversation'a scope'lu `findOne`. **Her mutasyon buradan geçer** — "socket
events pass through the same guards as REST" kuralının tek uygulama noktası.

Fan-out tek: `ws/fanOut.ts`'e `fanOutMessageUpdate(io, conversation, message,
audience, actorId)`, alıcı başına `toMessageView` ile **kişiye özel** yük ve tek
event **`message:updated`**. Silme ayrı event değil — gövdesi temizlenmiş bir
`message:updated`. Push yok, delivery damgası yok.
`audience: 'actor'` (star ve benden-sil) yalnızca aktörün odasına gider: karşı
taraf hiçbir şey almaz, ama aktörün diğer cihazları yakınsar.

`EVENT_LIMITS` (`ws/rateLimit.ts:30`) kendi kovalarını alır: `message:react`
30/2s, `message:star` 30/2s, `message:edit` 10/0.5s, `message:delete` 10/0.5s.

### Paylaşılan kurallar

`packages/shared/src/chat.ts`: `MESSAGE_REACTIONS` (👍 ❤️ 😂 😮 😢 🙏 🔥),
`MESSAGE_EDIT_WINDOW_MS` ve `MESSAGE_DELETE_WINDOW_MS` (ikisi de 2 gün, ayrı
sabitler), `MAX_PINNED_PER_CONVERSATION`, `reactToMessageSchema`,
`editMessageSchema`, `deleteMessageSchema` (`scope: 'me' | 'everyone'`),
`starMessageSchema`, ve saf `canEditMessage(m, userId, now)` /
`canDeleteForEveryone(m, userId, now)`. Tek kural, hem `mutations.ts` hem
`messageActions.ts` onu tüketir — görünürlük testi mantığı çoğaltmaz.

`Message`'a eklenen alanlar (`conversations.ts` + `MessageDto`):
`replyTo`, `reactions`, `hiddenFor`, `deletedAt`, `deletedBy`, `editedAt`,
`correctedAt`, `starredBy`.

### İstemci altyapısı

`messageCache.ts`'e `applyMessageUpdate(pages, message)` —
`applyDeliveredAt`'in `changed` guard'lı / aynı-referans disiplininin aynısı;
`sameId`'de satır **bütünüyle değiştirilir** (sunucu tam projeksiyonu yolladı;
merge silinmiş `media`'yı diriltirdi); bulunamazsa no-op.
`useSocket.ts` tek yeni dinleyici alır (`setQueriesData` ile), `deleted` ise
`keys.conversations` invalidate edilir.

`messageActions.ts` genişler: `MESSAGE_ACTION_IDS`'e `reply`, `react`, `edit`,
`star`, `pin`, `delete`; her eyleme `page: 'primary' | 'more'`, artı saf
`paginateActions(actions, page)`.

### Overlay

**Kök seviyede mutlak katman**, Modal değil. `MessageMenuHost`'un yorumu
sekme navigatörünün *içindeki* overlay'e karşı; `ToastHost` ise `_layout.tsx`'te
`<Stack>`'ten **sonra** monte edilmiş düz mutlak katman ve sekme çubuğunun
üstünü boyuyor — yani karşı örnek. Ayrıca Android'de Modal ayrı bir pencere
(durum çubuğu dahil) olduğu için `measureInWindow` koordinatı düzeltme
istiyor; aynı pencerede o düzeltme sıfır. Mevcut `MessageMenuHost` genişletilir
(ikinci host değil): istek `anchor` taşıyorsa çapalı, taşımıyorsa bugünkü alt
sayfa. Backdrop `rgba(0,0,0,0.45)` ve dokunuşu **yakalar**; Android geri tuşu
`BackHandler` ile elle.

`messageMenu.ts` sözleşmesi korunur, sadece konumsal `(preview, actions)` tek
options nesnesine döner (`{ bubble, actions, anchor?, reactions?, myReaction? }`)
ve sonuç `{ kind:'action' } | { kind:'reaction' }` olur. Dosya JSX almaz,
vitest kapsamında kalır.

Geometri saf: yeni `src/lib/messageMenuLayout.ts` →
`messageMenuLayout({ anchor, screen, insets, menu, strip, mine })` →
`{ placement, strip, menu, bubble }`. Menü yüksekliği **ölçülmez, türetilir**
(`rowHeight * n + chrome`) ki flip ilk boyamadan önce kararlaşsın. Baloncuk
konumu **çıktıdır**: ikisi de sığmazsa üçlü güvenli alana ortalanır.
Testler: kenar flip'i, sol/sağ clamp, mine/theirs hizası, ikisi de sığmama.

### Reaction

`reactions?: Record<string, string[]>` (emoji → userId'ler; `$addToSet`/`$pull`
ile `reactions.<emoji>` nokta yolu — `z.enum(MESSAGE_REACTIONS)` keyfi anahtarı
kapatıyor). Kullanıcı başına tek reaction: aynısına basmak kaldırır, farklısına
basmak değiştirir. Şerit 7 emoji + `+` (kendi ızgaramız, ~64 emoji tek sayfa).
Rozet baloncuğun alt köşesinde.
**Token ödemez, `dailyActivity`'ye yazmaz, streak'i ilerletmez** —
`recordMessage`/`awardForSend` yoluna hiç girmez, yoksa emoji basarak farm
edilir. Push yok.

### Delete

- *Benden sil*: `hiddenFor: string[]`, fan-out `audience:'actor'`.
  `listMessages` sunucuda **filtrelemez** (30'luk keyset sayfası 12 dönerdi);
  satır projeksiyonda `hidden: true` + boş gövde gelir,
  `messagesNewestFirst` düşürür.
- *Herkesten sil*: yalnızca gönderen, `MESSAGE_DELETE_WINDOW_MS` (2 gün)
  içinde. Silme **koşullu** yapılır — eşzamanlılık tasarımının tamamı bu:
  ```ts
  updateOne(
    { _id, conversationId, senderId: userId, deletedAt: { $exists: false } },
    { $set: { deletedAt, deletedBy, body: '' }, $unset: { media: '', correction: '' } })
  // modifiedCount === 0 ⇒ zaten silinmiş, yan etki yok, idempotent
  ```
  Desen hazır: hesap purge'ü (`account/deletion.ts:162`) zaten aynı şeyi yapıp
  satırı bırakıyor. Baloncuk "This message was deleted" olur.
- **`lastMessage` yeniden hesaplanmaz, koşullu yamalanır.** Mezar taşı modelinde
  en yeni mesaj hâlâ o satır; "bir sonraki hayatta kalanı bul" sorgusu, boş
  thread kenar durumu ve `listConversations`'ın sıraladığı alanın `$unset`'i
  gerekmiyor:
  ```ts
  updateOne(
    { _id: conversation._id, 'lastMessage.createdAt': deleted.createdAt,
      'lastMessage.senderId': deleted.senderId },
    { $set: { 'lastMessage.body': '', 'lastMessage.deleted': true } })
  ```
  Yordam filtrede, uygulama kodunda değil: araya `message:new` girdiyse filtre
  tutmaz, no-op olur — doğru davranış. Transaction yok, read-modify-write yarışı
  yok.
- **`unread` koşullu `$inc -1`**, recount değil (`{ [unread.<peer>]: { $gt: 0 } }`
  taban). `$inc -1`, `recordMessage`'ın eşzamanlı `$inc +1`'iyle **değişmeli**;
  `countDocuments` + `$set` değil.
- Medya baytları: önce Mongo'da `$unset media`, **sonra** `supportsPut(storage)`
  arkasında `keyFromPublicUrl` + `deleteObject` (best-effort, mutasyonu
  düşürmez). Ters sıra 404'e canlı referans bırakır. Forward olmadığı için bir
  blob'a tek mesaj bakıyor; referans sayımı gerekmiyor.
- **Token geri alınmaz.** Ledger append-only, günlük cap *gönderimi* sayıyor;
  gönder-sil döngüsüyle farm edilemez.
- Correction'ların `original`'ı ve reply'ların `preview`'u snapshot olduğu için
  ayakta kalır.
- **Bitişik hata (senin onayınla dahil):** `account/deletion.ts` purge'ü mesaj
  gövdelerini siliyor ama `conversation.lastMessage`'a dokunmuyor — karşı
  tarafın sohbet listesinde silinmiş cümle duruyor. Aynı PR'da tek `updateMany`
  (`{ participants: userId, 'lastMessage.senderId': userId }` →
  `$set { 'lastMessage.body': '', 'lastMessage.deleted': true }`) + bir test.

## Paket 3b — `chat/message-extras`

- **Star**: özel, kullanıcıya ait. `starredBy: string[]` + sparse index
  `{ starredBy: 1, createdAt: -1 }`. Yeni ekran `/(app)/starred`; satıra
  dokunmak `?at=` ile mesaja gider. Fan-out `audience:'actor'`.
- **Pin**: konuşma başına, iki taraf da görür.
  `conversation.pinned?: { messageId, byUserId, at }` — v1'de tek pin, yenisi
  eskisinin yerine geçer. Thread'in üstünde banner, dokununca `?at=` ile
  zıplar. Socket `conversation:pinned`. 1-1 olduğu için iki taraf da pinleyip
  kaldırabilir.
- **Edit**: yalnızca kendi **metin** mesajın, `MESSAGE_EDIT_WINDOW_MS` (2 gün)
  içinde. `editedAt` + baloncukta "Edited". Mesaj `lastMessage` ise
  `conversation.lastMessage.body` de yukarıdaki koşullu filtre kalıbıyla
  güncellenir. **Yeni token ödenmez.**
  - **Düzeltilmiş mesaj kilitlenir.** Karşı taraf bir mesaja correction
    yazdıysa o mesaj artık düzenlenemez; menüde Edit yerine "Corrected — can't
    be edited". Aksi hâlde correction'ın `original` snapshot'ı ekranda artık
    var olmayan bir cümleyi gösterir ve öğretim kaydı yalan olur. Pencere 2 gün
    olduğu için bu kilit dekoratif değil, gerçekten devreye girecek.
  - Ek sorgu istemiyor: `sendCorrection` hedefi zaten yüklüyor
    (`messages.ts:118`); aynı yolda hedefe `correctedAt` damgası basılır, menü
    client'ta o alana bakar.
  - Correction'ın kendisi de düzenlenemez — aynı gerekçe, ters yönden.

### Menünün son hâli

Emoji şeridi (7 + `+`), sonra:

| Sayfa | Maddeler |
| --- | --- |
| Primary | Reply · Correct · Translate · Copy · Delete |
| `More…` | Edit · Star · Pin · Report |

Görünürlük kuralları `messageActionsFor` içinde kalır ve testten geçer:
Correct/Translate/Report yalnızca karşının mesajında, Edit/Delete-for-everyone
yalnızca kendi mesajında ve süre içinde, Copy/Edit yalnızca gövde varsa, Correct
yalnızca `text`'te, Edit `correctedAt` damgalıysa hiç.

---

## Paket 4 — `tokens/activity-map`

### Veri kaynağı

Yeni koleksiyon **`streakDays`**, `_id: "<userId>:<yerelGün>"` (mevcut
`dailyActivity` deseni; `_id` hem tekilliği hem önek aralık taramasını verdiği
için ek index gerekmez), `{ userId, day, source: 'activity' | 'freeze' |
'purchase' | 'legacy', actions: number }`.

Yazma yeri `recordQualifyingAction` (`modules/tokens/streak.ts:52`), **ama
`lastQualifiedDay === today` erken çıkışından (satır 66) önce** — yoksa günün
ikinci mesajı sayaca yazmaz. Tek upsert: `$inc: { actions: 1 }`,
`$setOnInsert: { userId, day, source }`.

Haritanın hem dolu/boş'u hem tonu bu tek belgeden gelir. Gerekçe: streak
**yerel** güne, `dailyActivity` **UTC** gününe göre çalışıyor
(`tokens/dailyActivity.ts:5-16`); ikisini karıştırmak kareyi bir gün kaydırırdı.
Ayrıca bugün hangi günlerin dolu olduğunu hiçbir şey tutmuyor — sadece
`lastQualifiedDay` — ve onarımdan sonra `streak.current`'ı yeniden
hesaplayabilmek de bu kümeyi gerektiriyor.

### Gün onarımı

- `TOKEN_RULES.sinks`: `dayRepair: 300`, `dayRepairMaxAgeDays: 14`,
  `dayRepairPerMonth: 2`. (Freeze 200; onarım geriye dönük kolaylık olduğu için
  ondan pahalı.)
- Onay sayfası **etkiyi önceden söyler**: "12 Ağustos dolar, serin 4 günden 11
  güne çıkar, bakiyen 250 → 0". Hiçbir seriyi birleştirmeyen kare için dürüstçe
  "bu kareyi doldurur ama serini değiştirmez" der. İsteğin özü burada. Metni
  üreten fonksiyon saf ve `src/lib`'de test edilir.
- Bugün satın alınamaz (bugün kazanılır), gelecek gün gösterilmez, pencere dışı
  gün kilitli. Aylık hak: `_id` önek aralığında `source:'purchase'` sayımı (ayda
  ≤31 belge, ucuz) — ayrı alan gerekmiyor.
- **İki yazma, telafili.** Para `profiles.tokenSpent`'te, gün `streakDays`'te;
  tek atomik update mümkün değil. Sıra: `insertOne` (duplicate key ⇒ gün zaten
  dolu, `VALIDATION_FAILED`) → `wallet.ts`'in mevcut atomik
  `findOneAndUpdate` + `$expr` bakiye guard'ı ile ücret → ücret düşerse
  eklenen günü `deleteOne` ile geri al. Tekillik `_id`'de olduğu için çifte
  onarım fiziksel olarak imkânsız.
- Ledger'a `recordSpend` ile `kind:'spend'` negatif satır; `tokenAggregates`'e
  **dokunmaz** (liderlik tablosu satın alınamaz — `wallet.ts:116` bunu zaten
  böyle yapıyor), `dailyActivity`'ye **yazmaz** (havuz payı satın alınamaz).
- Onarımdan sonra `streak.current`/`longest` `streakDays` kümesinden yeniden
  hesaplanır.
- `repairDay()` `modules/tokens/wallet.ts` içinde. Route:
  `POST /me/activity/repair`, gövde `{ day }` — mevcut `/me/wallet/purchase`
  stiliyle aynı; yol parametreleri bu repoda zod'dan geçmiyor.
  `GET /me/activity?from=&to=` → gün dizisi + fiyat/pencere/kalan hak.

### Gizlilik ve UI

`packages/shared/src/profile.ts:141`'deki `privacy` nesnesine
`activityMapVisible` (varsayılan açık — seri zaten public profilde), sunucu
`Profile` tipine ve `settings.tsx`'e anahtar (`update.mutate({ privacy: {
activityMapVisible } })` — sadece değişen anahtar; sunucu noktalı yolla
birleştiriyor). **Tier kontrolü yok**, ücretsiz.
`PublicProfile` allow-list olduğu için yeni alan kendiliğinden gizli kalır;
başkasının haritası ayrı endpoint: `GET /profiles/:handle/activity` → dolu/boş
+ ton, **sayı yok**, dokunma kapalı.
`me.tsx`'e `ActivityMap`: 7 satır × ~26 hafta, yatay kaydırmalı, bugünde biten
ızgara. Izgara hesabı saf `src/lib`'de. Ton rampası hazır: `colors.streak`
(`src/lib/theme.ts:22`).

### Elle tutulan senkron

Yeni sink dört elle düzenleme istiyor (REPO_MAP "Links between repos"; kontrol
eden otomasyon yok):
`packages/shared/src/token.ts` → `website/src/lib/data/token.ts` (`tokenSinks`)
→ GitBook `docs/token/utility.md` + `docs/library/day-streaks.md` →
`langx/docs/legal/promise-change.md`'in virtual-items satırı.
İddialar `langx/docs/token-messaging-brief.md` ile uyumlu olmalı: onarım bir
uygulama içi puan harcaması, **ücretli bir özelliği açmıyor**, nakit değeri yok.

---

## Sıra

1. `chat/smooth-list`
2. `chat/reply`
3. `chat/message-mutations` (3a)
4. `chat/message-extras` (3b)
5. `tokens/activity-map` (+ `website/` ve `docs/` senkron PR'ları)

Sıra bağlayıcı: 3a'nın `loadMutableMessage` + `message:updated` +
`applyMessageUpdate` + `toMessageView` dörtlüsünü 3b'nin üç eylemi de
kullanıyor; reply'ın `?around=` penceresini pin banner'ı ile starred listesi de
kullanıyor; ve Paket 1'in `MessageBubble`'ı hem swipe'ın hem overlay'in
önkoşulu.

Başlamadan: `apps/mobile`'da `pnpm install` (`expo-clipboard` eksik), ve
dallanmadan önce `git status` + `ListAgents` — bu checkout eşzamanlı oturumlarla
paylaşılıyor.

## Doğrulama

- `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` — CI'ın
  dördü de geçmeli.
- **API** (`ws/chat.test.ts`, `routes/messages.test.ts` genişletilir): reply
  hedef doğrulaması · `?around=` hedefi ortalıyor ve iki yöne de cursor veriyor
  · `around` + `cursor` birlikte `VALIDATION_FAILED` · reaction toggle/replace ·
  **reaction ve gün onarımı token ödemiyor** · star/benden-sil karşı tarafa
  event **yollamıyor**, aktörün diğer oturumuna yolluyor · `toMessageView`
  `starredBy`/`hiddenFor` sızdırmıyor · delete-for-everyone yalnızca gönderen ve
  yalnızca 2 gün içinde · ikinci silme no-op · silinen mesaj `lastMessage` ise
  yamalanıyor **ama araya yeni mesaj girdiyse yamalanmıyor** · `unread` düşüyor
  ve 0'ın altına inmiyor · blob bucket'tan gidiyor · edit yalnızca kendi
  metninde ve süre içinde · **correction gelen mesaj `correctedAt` alıyor ve
  artık düzenlenemiyor** · purge sonrası `lastMessage.body` boş · aynı gün iki
  kez onarılamıyor · onarım `tokenAggregates`'e dokunmuyor · bakiye yetmezse
  eklenen gün geri alınıyor.
- **Mobil (saf fonksiyonlar):** `messagesNewestFirst` (sayfa **ve** sayfa-içi
  ters çevirme) + `appendIncomingMessage` ile ortak invariant ·
  `applyMessageUpdate` · `messageActionsFor` matrisi + `paginateActions` ·
  `messageMenuLayout` (kenar flip, clamp, ikisi de sığmama) · `planJump` ·
  `swipeToReply` eşikleri · gün gruplama · harita ızgarası · onarım etki metni.
- **Elde** (droplet, Expo web `:8081`, inotify limiti yükseltilmiş + Playwright;
  jestler için dokunmatik emülasyonu şart):
  1. Uzun sohbette yukarı kaydırma titremiyor, eski sayfa gelince içerik
     kaymıyor — **`inverted`'ın RN web'deki `scaleY(-1)` davranışı burada
     doğrulanır** (wheel yönü, DOM sırası, metin netliği).
  2. Alıntıya tıklayınca doğru mesaja gidip ~1sn vurgulanıyor; "Back to latest"
     canlı listeye dönüyor ve bu sırada gelen mesaj kaybolmuyor.
  3. Overlay ekran alt kenarında yukarı flip ediyor, sekme çubuğunun üstünde
     çiziliyor, Android geri tuşu kapatıyor.
  4. Boş kareye tıklayınca doğru etki metni ve doğru bakiye çıkıyor; onarımdan
     sonra seri sayısı beklendiği gibi.
  5. Karşılıklı iki oturumda: reaction anında görünüyor, star karşı tarafta
     görünmüyor.

---

# Paket A — açık/koyu tema — **YAPILDI** (PR #968, 29 Ağustos 2026)

Aşağıdaki plan uygulanmadı; iş paralel bir oturumda `main`'e girdi ve aynı
kararları verdi (`auto | light | dark`, `localFlags.themePreference`,
`ThemeProvider` + `makeStyles`, `tokens.ts` içinde `lightColors`/`darkColors`,
`settings.tsx`'te Appearance seçici). Migrasyon plandan geniş: `apps/mobile`
altında `StyleSheet.create` **sıfır** kaldı, 61 dosya `makeStyles` kullanıyor,
ayrıca `SegmentedControl`/`Toggle`/`Card`/`ListRow`/`ProgressBar`/`StatTile`/
`ScreenHeader`/`Callout` primitive'leri eklendi. `typecheck` temiz, mobil
vitest 120 test geçiyor.

**Denetimde çıkan dört açık madde** (ayrı küçük bir iş olarak alınabilir):

1. **`expo-system-ui` hâlâ hiç çağrılmıyor** — bağımlılıkta duruyor, kodda tek
   referans yok; `+html.tsx` ve `app.config.ts`'te `backgroundColor` de yok.
   Android pencere arkaplanı ve web `<body>` varsayılanda kalıyor, koyu modda
   overscroll alanı beyaz görünür. `ThemeProvider` içinde tek effect:
   `SystemUI.setBackgroundColorAsync(colors.bg)`.
2. **Soğuk açılışta bir kare açık tema** — `ThemeProvider.tsx:65-71` bunu
   bilerek yapıyor, ama `dark` seçmiş + cihazı açık olan kullanıcı için *her*
   soğuk açılışta oluyor. `_layout.tsx:87`'de zaten bir `showSpinner` kapısı
   var; tercih okuması oraya eklenirse maliyet pratikte sıfır.
3. **Tercih mantığı test edilemiyor** — resolve ifadesi ve `isPreference`,
   `react-native` import eden bir `.tsx` içinde; mobil vitest ulaşamıyor.
   `resolveScheme` + `parseThemePreference` saf bir `.ts`'ye çıkarılmalı.
4. **`ui/Toggle.tsx:55` sabit `shadowColor: '#000000'`** — repoda kalan tek
   sabit hex; `Card`/`Button` tema-farkındalıklı `cardShadow`'u kullanıyor.

<details>
<summary>Uygulanmayan özgün plan (kayıt için)</summary>

## Context

Ayarlarda tema seçimi yok. `app.config.ts:39` `userInterfaceStyle: 'automatic'`
baştan beri ayarlı ama arkasında hiçbir şey yok, `expo-system-ui` bağımlılıkta
duruyor ve hiç import edilmiyor, site ise ilk günden beri üç durumlu temaya
sahip (`website/.../ThemeToggle.svelte`, `auto → light → dark`). Bu madde
`langx/docs/release-runbook.md:332-336`'da zaten açık bir iş olarak duruyor ve
orada doğru teşhis de yazılı: **bu bir değer değiştirme işi değil.**

`colors` düz bir modül sabiti ve **46 dosya** onu modül seviyesindeki
`StyleSheet.create` çağrısına yükleme anında yakalıyor — `StyleSheet.create`
içeren 50 dosyanın hiçbirinde stil bileşen gövdesinde ya da `useMemo` içinde
üretilmiyor. Dolayısıyla `colors`'ı çalışma anında değiştirmek hiçbir şeyi
değiştirmez; her dosya bir fabrikaya çevrilmek zorunda.

Ayrıca `ui/Button.tsx`, `ui/FormField.tsx`, `PhotoGallery.tsx` ve altı auth
ekranı bugün `theme`'i hiç import etmiyor; toplam 21 sabit hex taşıyorlar. Bunlar
taşınmazsa koyu modda beyaz-üstüne-beyaz kalırlar.

**Kararlar:** kapsam tek PR (yarım migrasyon sevk edilebilir bir ara durum
üretmiyor); tercih cihazda saklanıyor (`localFlags.ts`), sunucu değişikliği yok;
üç durum `auto | light | dark` — siteyle aynı sözlük.

## 1. Palet ayrımı — `src/lib/theme.ts`

- `export type ThemeName = 'light' | 'dark'`, `export interface Palette` (14
  anahtar: `bg, surface, border, text, textMuted, primary, primaryText, accent,
  danger, success, streak, read, pro, proPlus`).
- `lightColors` = bugünkü değerler, `darkColors` = yeni.
- `spacing`, `radius`, `font`, `layout` tema-bağımsız; oldukları gibi kalır.
- **`export const colors` kaldırılır.** Geriye dönük uyum için bırakmak
  migrasyonun yarım kalmasını sessiz hâle getirir; kaldırınca `tsc` kaçırılan
  her dosyayı derleme zamanında yakalar. Bu, testin yapamadığı işi yapan asıl
  kanıt (aşağıda, Doğrulama).

**Önerilen koyu palet:**
`bg #0f0f11` · `surface #1a1a1e` · `border #2c2c32` · `text #f2f2f4` ·
`textMuted #9a9aa3` · `primary #f2f2f4` · `primaryText #0f0f11` ·
`accent #6b8ffb` · `danger #f97066` · `success #47cd89` · `streak #fdb022` ·
`read #84c5ff` · `pro #9b8afb` · `proPlus #a78bfa`.

`primary`/`primaryText` bilerek ters çevrildi: butonun "zıt kontrast" anlamı
açıkta siyah-üstüne-beyaz, koyuda beyaz-üstüne-siyah olarak korunuyor. Aksan ve
durum renkleri koyu zeminde AA kontrastı için bir ton açıldı.
`release-runbook.md:322-325` "kimlik amber mi siyah mı" kararını açık bırakmış;
bu palet mevcut siyah kimliği koruyor, amber'e geçilirse yalnızca
`primary`/`accent` iki dosyada değişir.

## 2. Saf karar mantığı — `src/lib/themePreference.ts`

Vitest `src/lib/**` dışına bakmadığı için mantığın tamamı burada, RN importu yok:

```ts
export const THEME_PREFERENCES = ['auto', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export function parseThemePreference(raw: string | null): ThemePreference  // bozuk/eksik ⇒ 'auto'
export function resolveTheme(pref: ThemePreference, system: 'light' | 'dark' | null): ThemeName
```

`localFlags.ts`'in `FLAG_KEYS`'ine tek satır: `themePreference`. Anahtar adı
localFlags'in kendi camelCase desenini izler (`introSeen`, `onboardingDraft`);
sitenin `theme-preference`'ı ayrı bir origin, sözlük değil.

## 3. Sağlayıcı ve kanca

- `src/components/ThemeProvider.tsx` — `useColorScheme()` (react-native) ile
  sistem şeması, `readFlag` ile tercih. Context değeri
  `{ theme, colors, preference, setPreference }`.
- Montaj: `app/_layout.tsx`'te `SafeAreaProvider`'ın hemen içine,
  `QueryClientProvider`'ın dışına — host'lar ve `:68-77`'deki spinner da
  kapsansın.
- `readFlag` **async**: ilk boyamada tercih henüz yok. Bu tam olarak
  `AppGate`/`introSeen`'in çözdüğü problem; okuma o mevcut bekleyişe eklenir,
  böylece açık temanın bir kare yanıp sönmesi olmaz.
- `src/hooks/useThemedStyles.ts`:
  ```ts
  export function useThemedStyles<T>(factory: (colors: Palette) => T): T
  ```
  Sonuç `WeakMap<factory, Record<ThemeName, T>>` ile önbelleklenir —
  `StyleSheet.create` her render'da çağrılmaz.

## 4. 46 dosyalık mekanik migrasyon

Dosya başına iki satır:

```ts
const styles = StyleSheet.create({ … })                              // önce
const makeStyles = (colors: Palette) => StyleSheet.create({ … })     // sonra
// bileşen gövdesinde:
const styles = useThemedStyles(makeStyles)
```

Render gövdesinde `colors.*` okuyan 14 dosya ayrıca `const { colors } =
useTheme()` alır — `placeholderTextColor`, `<Ionicons color>`, `Chip`'in
`TONE` haritası (modül sabitinden fonksiyona döner), `(app)/_layout.tsx`'in
`Tabs` `screenOptions`'ı.

Aynı PR'da token'a taşınır: `ui/Button.tsx` (`#111`, `#fff`),
`ui/FormField.tsx` (`#999`, `#c0392b`), `PhotoGallery.tsx`, ve altı
`app/(auth)/*` ekranı.

## 5. Sistem kroması

- `app/_layout.tsx:66`: `<StatusBar style="auto" />` → `style={theme === 'dark'
  ? 'light' : 'dark'}` — `"auto"` sistemi izler, uygulama içi override'ı değil.
- `expo-system-ui` (zaten bağımlılıkta, hiç kullanılmamış):
  `SystemUI.setBackgroundColorAsync(colors.bg)` — Android pencere arkaplanı ve
  web `<body>`. Bugün web arkaplanını hiçbir şey ayarlamıyor; beyaz,
  `Screen`'in `backgroundColor`'ından geliyor (`ui/Screen.tsx:63`).
- `(app)/_layout.tsx:39-45`: `tabBarStyle` bugün yalnızca `borderTopColor`
  veriyor; `backgroundColor: colors.bg` eklenmezse sekme çubuğu koyu modda açık
  kalır.
- `app.config.ts:39` `userInterfaceStyle: 'automatic'` zaten doğru, dokunulmaz.

## 6. Ayarlar UI

`settings.tsx`'e "Appearance" bölümü, Privacy'nin üstüne. `Row` boolean-only
olduğu için üç yönlü seçim **yeni bileşen yazılmadan** `Chip selected` ile
yapılır — `filters.tsx:133-156`'daki cinsiyet seçicinin ("Any / Female / Male")
birebir aynı deseni, etiketler `System / Light / Dark`.
`setPreference` hem context'i günceller hem `writeFlag` çağırır; sunucuya
gitmez, `useUpdateProfile` kullanılmaz.

## 7. Runbook

`langx/docs/release-runbook.md:332-336`'daki madde işaretlenir; aynı listedeki
`:341-343` (`Button`/`FormField` token'a) bu PR'da kapandığı için o da.

## Doğrulama

- `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`.
- **`typecheck` migrasyonun kanıtıdır**: `colors` export'u kaldırıldığı için
  atlanan her dosya derlenmez. Bunu test edecek bir birim testi yok, olması da
  gerekmiyor.
- Saf testler `src/lib/themePreference.test.ts`: `auto` + sistem koyu → `dark`;
  `auto` + sistem `null` → `light`; açık/koyu tercihi sistemi eziyor; bozuk
  saklanmış değer → `auto`.
- **Elde** (droplet, Expo web `:8081` + Playwright): Playwright'ın
  `prefers-color-scheme` emülasyonuyla önce `auto`, sonra üç seçenek tek tek —
  sekme çubuğu, durum çubuğu, `placeholderTextColor`'lar, overlay backdrop'u,
  altı auth ekranı, iskelet ve boş durumlar. Uygulama yeniden yüklendiğinde
  seçim korunuyor ve ilk boyamada açık tema yanıp sönmüyor.
- Sabit hex kalmadığının kontrolü: `apps/mobile/src` ve `apps/mobile/app`
  altında `#[0-9a-fA-F]{3,6}` taraması `theme.ts` dışında boş dönmeli.
