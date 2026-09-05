# LangX v2 — yedi iş: skeleton, sonsuz kaydırma, online sıralama, gizlilik, store, debug kotası, mesaj menüsü

## Context

Uygulamanın liste ekranları bugün tam ekran spinner gösteriyor, Chats listesi
sunucu cursor döndürdüğü halde tek sayfa çekiyor, Discover'daki "Online" çipi
sıralama değil sert bir filtre (liste boşalabiliyor), ve mesaj balonunda
uzun basma yalnızca "düzelt" hareketine bağlı.

Keşif sırasında iki şey senin varsayımından farklı çıktı, plan buna göre kuruldu:

1. **"Incognito browsing" çalışıyor ama online durumunu hiç etkilemiyor.** Uçtan
   uca sağlam: `settings.tsx:150-158` → `updateProfileSchema` (`profile.ts:134`)
   → `updateProfile` `$set` → `profileViews.ts:49-50`'de canlı tier kontrolüyle
   uygulanıyor, `moderation.test.ts:326,347` ile kapsanmış. Sadece *kimin profilime
   baktığı* kaydını atlıyor; `toPublicProfile` `privacy`'yi hiç okumuyor. Yani
   istediğin "online'ı gizle" özelliği orada yok — yeni bir alan gerekiyor.
2. **`isOnline` zaten yanlış.** `stats.lastActiveAt` sadece mesaj gönderilince
   yazılıyor (`awards.ts:46-52`); soket bağlantısında presence yazımı yok,
   `disconnect` handler'ı hiç yok. "Online" pratikte "son 5 dakikada mesaj attı"
   demek. Online sıralamasını presence'ı düzeltmeden yapmak, yanlış veriyi
   sıralamak olur.

Ayrıca yol boyunca üç canlı hata çıktı, ilgili PR'lara gömülü olarak düzeltilecek:
`updateProfile`'ın alt-doküman `$set`'i, soket hatalarında ölü kalan
`instanceof ApiRequestError` dalları, ve `useSocket`'in her mesajda tüm sayfaları
yeniden çeken `invalidateQueries`'i.

**Kapsam dışı:** Copilot. `paywall.tsx`'te `shipped: false` işaretli ve o bayrak
tam olarak "yapılmamış özelliği şimdiki zamanda anlatma" için var. Menüde kilitli
satır olarak bile görünmeyecek.

## Durum (2026-08-28)

**Hepsi bitti.** A–J merge edildi ve canlıya çıktı (PR #958–#967, Fly v12 +
Cloudflare). J: web'de Enter ile gönderme (chat composer + dört auth formu). I'de bulgu genişledi: hata `/store`'a özel değildi, dokuz tam
ekran route'unun hepsinde vardı — ve `canGoBack()` bu navigator'da `true`
döndüğü için beklenen düzeltme işe yaramıyor.

## Çalışma düzeni

`~/Developer/langx/langx` üç oturum arasında paylaşılıyor ve şu an başkasının
branch'i checkout edilmiş (`ui/tab-order-profile-settings`, 1 push'lanmamış commit).
Bu yüzden **her iş kendi worktree'sinde**, repo CLAUDE.md'sinin ısrar ettiği gibi:

```bash
git worktree add /root/wt-<isim> -b <branch> origin/main
cd /root/wt-<isim> && pnpm install     # zorunlu, node_modules paylaşılamaz
```

Sıra: **F → E → A → B → G → D → C**. F ve E ucuz ve bağımsız; riskli işlere
girmeden önce branch → PR → merge → deploy → canlı test döngüsünü çalıştırırlar.
A, B'nin devraldığı `isPending` dallarına dokunur. B, G'den önce (ikisi de
`chat/[id].tsx`'in aynı ~200 satırını yeniden yazıyor). **D, C'den önce** — C'nin
bucket koşulu `privacy.hideOnlineStatus`'u okumak zorunda ve düzeltilmemiş
presence'ı sıralamak özelliğin kendisi değil.

Her PR: `gh pr merge --rebase` (langx `main` kesinlikle lineer).

**Ritim (2026-08-28'de güncellendi):** lokalde sadece `pnpm test`; lint,
format:check ve typecheck PR'da zaten koşuyor, burada tekrar çalıştırılmıyor.
Deploy ve canlı doğrulama her PR'da değil, **tüm iş bittiğinde bir kez**:

```bash
export PATH="/root/.fly/bin:$PATH"
export FLY_API_TOKEN="$(grep -m1 '^FLY_API_TOKEN=' ~/Developer/langx/langx/.env | cut -d= -f2-)"
flyctl deploy -a langx-api                       # repo kökünden
git worktree add --detach /root/langx-deploy <sha> && cd /root/langx-deploy && pnpm install
REPO=/root/langx-deploy bash /root/deploy-web.sh
```

Deploy doğrulaması `/health` uptime'ı ile **yapılmaz** (kendiliğinden restart
ediyor); yalnızca yeni kodun ürettiği bir davranışla veya `flyctl releases` ile.

---

## F — `/me/quota`'ya media + dev-only kota paneli

`feat/debug-quota-panel`

- `apps/api/src/routes/conversations.ts:33-42` — `Promise.all`'a `getQuotaStatus(…, 'media')`
  eklenir, dönüş `{ initiations, translations, media }`. Dev-gate edilmez: kullanıcının
  kendi kotası ve `chat/[id].tsx:123-128` ekin reddedildiğinde doğru bir şey söyleyebilmek
  için buna ihtiyaç duyuyor.
- **yeni** `apps/mobile/src/lib/debugPanel.ts` — `isDebugPanelEnabled()` =
  `__DEV__ && process.env.EXPO_PUBLIC_DEBUG_PANEL === '1'`. İki bağımsız koşul,
  gerekçesi `src/lib/fakePurchases.ts:24-26`'daki ile aynı (`EXPO_PUBLIC_*` tek
  başına production bundle'a sızabiliyor).
- **yeni** `apps/mobile/src/lib/quotaFormat.ts` — `formatQuota(status)` → `"3 / 5"`,
  `limit === null` iken `"∞"`, tükenmişken `"0 / 5 · resets 14:20"`.
- **yeni** `apps/mobile/src/components/DebugQuotaPanel.tsx` — kapalıyken `null`.
- `apps/mobile/app/(app)/me.tsx` — panel "Edit profile" düğmesinin üstüne.
- `apps/mobile/src/api/queries.ts` — `useQuota` dönüş tipine `media` eklenir.
- `.env.example` — `EXPO_PUBLIC_DEBUG_PANEL=`.

Testler: `conversations.test.ts` (üç kova; free'de `media.limit === 50`, pro'da `null`),
yeni `quotaFormat.test.ts`, yeni `debugPanel.test.ts` (`fakePurchases.test.ts` kalıbı).

Canlı doğrulama: `curl … /me/quota | jq keys` → üç anahtar. Deploy edilmiş web
build'de debug kartı **görünmemeli** — asıl kontrol bu.

## E — Token store kendi route'unda

`feat/token-store-screen`

Modal değil route. Uygulamada hiç modal route yok; bottom sheet `@gorhom/bottom-sheet`
+ `react-native-gesture-handler` ister — ikincisi pnpm'in izole layout'unda
`apps/mobile`'dan zaten çözülmüyor — deep-link edilemez ve büyümez. Store'a yeni
özellikler geleceğini söyledin, bu yüzden route.

- **yeni** `apps/mobile/app/(app)/store.tsx` — `settings.tsx:138-140`'taki geri
  chevron'u, bakiye başlığı, `StoreRow` bölümleri.
- **yeni** `apps/mobile/src/components/store/StoreRow.tsx` — `me.tsx`'teki
  `storeRow`/`storeName`/`storeMeta`/`storeAction` stillerini devralır,
  `storeAction`'daki `flexShrink: 0` yorumu birebir taşınır (taşıyıcı yorum).
- **yeni** `apps/mobile/src/lib/storeOffers.ts` — çıkarımın asıl sebebi:
  `buildStoreOffers({ balance, owned, streakFreezes, restorableStreak }): StoreOffer[]`.
  Streak-restore mandalı, `TOKEN_RULES.sinks.maxBankedStreakFreezes`,
  `streakRestorePrice`, kozmetik sahipliği ve satın alınabilirlik bugün JSX içinde
  gömülü ve test edilemez durumda.
- `apps/mobile/app/(app)/me.tsx` — 196-267 satırları ve artık kullanılmayan stiller
  silinir; Balance `Stat`'ı `Pressable` içine alınır → `/(app)/store`,
  `accessibilityRole="button"` ve bir `›` göstergesiyle (yoksa ölü sayı gibi okunuyor).
- `apps/mobile/app/(app)/_layout.tsx` — **zorunlu**
  `<Tabs.Screen name="store" options={FULL_SCREEN} />`. Yoksa beşinci bir tab düğmesi belirir.

Test: yeni `storeOffers.test.ts` (mandal öncesi/sonrası restore teklifi, bakiye
yetmezken freeze, sahip olunan kozmetik).

Canlı doğrulama: Profil → Balance'a dokun → store **tab bar görünmeden** açılıyor,
geri Profil'e dönüyor, URL'ye `/store` yazınca da yükleniyor.

## A — Skeleton primitifi ve skeleton listeler

`feat/skeleton-loading`

**Reanimated değil, RN `Animated`.** `ToastHost.tsx` emsal; `useNativeDriver: true`
ile opacity zaten JS thread dışında koşuyor — Reanimated'a uzanmanın tek sebebi
buydu. Reanimated 4 uygulama kodunda hiç import edilmiyor, `babel.config.js` sade,
ve web yolu worklets bundle'ından geçiyor: daha hoş bir opacity rampası için
canlı Cloudflare bundle'ının build sistemini değiştirmek olur.

- **yeni** `src/components/ui/Skeleton.tsx` — `{ width, height, radius, style }`,
  `0.35 → 1 → 0.35` ~1400ms, `colors.border`.
- **yeni** `src/components/skeletons/{ConversationRow,DiscoveryCard,MessageBubble}Skeleton.tsx`
  — her biri gerçek satırın geometrisini birebir taklit eder; yüksekliği tutmayan
  skeleton yüklenince zıplama üretir.
- **yeni** `src/lib/listState.ts` — `listState({ isPending, isError, itemCount })`
  → `'skeleton' | 'empty' | 'content'`. Test edilebilir tek parça; B
  `isFetchingNextPage`/`isRefetching`'i getirince kolayca yanlış yapılacak yer.
- Değişecekler: `discover.tsx:174-175`, `chats.tsx:39-41`, `chat/[id].tsx:213-214`,
  ve `chats.tsx:72`'deki düz `'Loading…'` metni (partner adı çözülene kadar
  satır içi `<Skeleton>`, avatar da dahil).
- `queries.ts` `useDiscovery` — **`placeholderData: keepPreviousData` eklenir.**
  `keys.discovery(search)` tüm sorgu dizesi olduğu için her filtre dokunuşu yeni
  cache girdisi açıp `isPending`'i tetikliyor. Bu satır olmadan A, tek spinner'ı
  "her çip dokunuşunda tüm liste placeholder'a dönüşüyor"a çevirir — mevcut
  durumdan kötü. **Bu satır A'yı iyileştirme yapan şey; ayrıştırılmaz.**

Test: yeni `listState.test.ts`. A'nın alabileceği tek birim kapsamı bu —
`apps/mobile/vitest.config.ts` yalnızca `src/lib/**` alıyor, bileşen test edilemiyor.

Canlı doğrulama: web build'de Slow 3G ile üç ekran da spinner değil placeholder
gösteriyor; Online çipine basınca önceki liste ekranda kalıyor (`keepPreviousData`).

## B — Twitter tarzı yenileme + sonsuz kaydırma

`feat/paginated-chats-and-history`

- `queries.ts:197-203` — `useConversations` `useInfiniteQuery`'ye döner. Sunucu
  zaten `nextCursor` veriyor (`messages.ts:343-379`), API değişikliği yok.
- **Asıl tehlike şekil değil, `invalidateQueries`.** Infinite query'de TanStack v5
  yüklü *her sayfayı* sırayla yeniden çeker; `useSocket.ts:41,90` her `message:new`'de
  `keys.conversations`'ı kör invalidate ediyor. On sayfa derinken bir mesaj = on istek.
  **yeni** `src/lib/conversationCache.ts` — saf ve test edilebilir:
  `applyIncomingMessage(data, input)` ve `applyConversationRead(data, input)`,
  konuşmayı bulunduğu sayfadan çıkarıp `pages[0]`'ın başına taşır (sunucu
  `lastMessage.createdAt: -1` sıralı, yeni mesaj her zaman başa aittir);
  yüklü sayfalarda yoksa `undefined` döner ve çağıran invalidate'e düşer.
- `chats.tsx` — `pages.flatMap`, `RefreshControl`, `onEndReachedThreshold={0.6}`,
  `hasNextPage && !isFetchingNextPage` korumalı `onEndReached`, footer spinner.
  Şekil `discover.tsx:186-215`'ten birebir kopyalanır, ikinci bir deyim icat edilmez.
- Mesaj geçmişi: `useMessages` de infinite olur. **Sayfa sırası ters** —
  `listMessages` her sayfayı eskiden yeniye döndürür ve `nextCursor` *daha eskiyi*
  gösterir, yani `pages[0]` en yeni sayfadır: `[...pages].reverse().flatMap(...)`.
  Eski sayfalar yukarıdan yüklenir (`onStartReached`, web paritesi için
  `contentOffset.y < 80`).
  **yeni** `src/lib/messageCache.ts` — `appendIncomingMessage` (`pages[0]`'a ekler,
  `useSocket.ts:36-38`'deki tekrar korumasını korur) ve `applyDeliveredAt` (tüm
  sayfalarda, `useSocket.ts:78-85`'teki filtreyi koruyarak).
- **Kaydırma çıpası hatası:** `chat/[id].tsx:220`'deki koşulsuz
  `onContentSizeChange → scrollToEnd`, her eski sayfa çekilişinde kullanıcıyı
  dibe fırlatır. İlk dolu render'dan sonra dönen bir `didInitialScroll` ref'iyle
  koşullanır. Liste `inverted` yapılmaz — react-native-web'in `inverted` davranışı
  bu kod tabanının kaçındığı türden platform ayrışması.

Testler: yeni `conversationCache.test.ts`, yeni `messageCache.test.ts`,
ve `messages.test.ts`'e `?limit=2` ile ikinci sayfanın ne tekrar ettiği ne atladığı
(sunucu tarafı zaten doğru; istemci buna bağlanmadan önce sabitlensin).

Canlı doğrulama: 20+ konuşmalı hesapla ikinci sayfa geliyor; pull-to-refresh
çalışıyor; 50+ mesajlı thread'de yukarı kaydırınca görünüm dibe zıplamıyor.
Devtools Network'te on sayfa derinken kendine mesaj at → **bir** istek, on değil.

## G — Mesaj aksiyon menüsü (Aşama 1)

`feat/message-action-menu`

Senin Aşama 1'in alansız değildi: **reply `replyTo`, delete `deletedAt` ister.**
Düzeltilmiş kademeleme:

| Aşama | Aksiyonlar | Backend |
|---|---|---|
| **1 (bu PR)** | copy, translate, correct, report | yalnız `reportSchema.messageId?` |
| 2 | reply, edit, delete, react | `replyTo`/`editedAt`/`deletedAt`/`reactions` + tek bir `message:updated` fan-out ailesi |
| 3 | star, pin | ayrı `messageFlags` koleksiyonu |

Reply/delete Aşama 2'ye taşındı çünkü ikisi de edit ve react ile aynı tesisatı
istiyor — "var olan bir mesajı değiştir" yolu + tek bir güncelleme yayını. Onu bir
kez kurmak kademelemenin tüm gerekçesi. **Star ve pin kişiye özeldir**, mesaja
değil: aynı thread'deki iki kişi farklı mesajları yıldızlar. `{ userId, messageId }`
unique index'li `messageFlags` koleksiyonuna aittir — Aşama 3 `Message.starred: boolean`
olarak tasarlanmasın diye şimdiden not ediliyor.

- **yeni** `src/lib/messageActions.ts` — `messageActionsFor({ mine, type, hasBody,
  alreadyTranslated }): MessageAction[]`. "Sadece karşıdakinin mesajında / sadece
  metinde / çevrildikten sonra değil" kurallarını `chat/[id].tsx:264-289`'daki
  JSX'ten çıkarır; şu an testlerin göremediği yer orası.
- **yeni** `src/lib/messageMenu.ts` — `src/lib/alert.ts` kalıbında durum modülü
  (`openMessageMenu`, `subscribeToMessageMenu`, `resolveMessageMenu`,
  `resetMessageMenuForTest`). `src/lib/` içinde ki vitest erişebilsin.
- **yeni** `src/components/MessageMenuHost.tsx` — `AlertHost.tsx` gibi RN `Modal`;
  telefonda alt sayfa, web'de ortalanmış kart.
- `app/_layout.tsx:87` — `<AlertHost />` yanına, **navigator'ın üstüne** mount edilir.
  Oradaki yorum sebebini açıklıyor: tab navigator içindeki mutlak `View` web'de tab
  bar'ın altında kalıyor — düğmelerin tam duracağı yer orası.
- `chat/[id].tsx` — 282-289'daki `onLongPress` `openMessageMenu`'ye döner, **tüm**
  mesaj tiplerine ve kendi mesajlarına genişler; `correct` koca bir hareket yerine
  bir satır olur; 271-279'daki satır içi Translate bağlantısı kaldırılır.
  `copy` → `Clipboard.setStringAsync` + toast; `translate` → mevcut akış,
  `QUOTA_EXCEEDED`'de `openPaywall('unlimitedTranslation')`; `report` →
  `chooseAlert` ile sebep, sonra `messageId` ile `POST /reports`.
- `packages/shared/src/moderation.ts:26-32` — `reportSchema`'ya `messageId?`.
  `apps/api/src/modules/moderation/reports.ts` varsa saklar. `Message` değişmez.
- `apps/mobile/package.json` — **`expo-clipboard`**. Tüm planın tek yeni bağımlılığı;
  birinci parti Expo, web'de `navigator.clipboard` üzerinden çalışıyor.

**Bu PR'a katlanan canlı hata:** `emitWithAck` (`src/lib/socket.ts:52-58`) düz bir
`Error`'a `.code` iliştirerek reject ediyor, `ApiRequestError` değil. Yani soket
yolundaki her `instanceof ApiRequestError` dalı ölü — `chat/[id].tsx:123-128`'deki
media kota mesajı hiç gösterilmemiş. `src/lib/errors.ts`'e `errorCodeOf(error)`
eklenir ve dallar ona bağlanır. Aynı yerde paywall tutarsızlığı da giderilir:
`chat/[id].tsx:123-128` ve `204-210` `openPaywall`'a bağlanır,
`profile/[handle].tsx:69-74` ham `router.push` yerine `openPaywall()` kullanır.

Testler: yeni `messageActions.test.ts`, yeni `messageMenu.test.ts`
(`alert.test.ts` kalıbı), `errors.test.ts`'e `errorCodeOf`, `moderation.test.ts`'e
`messageId`'li ve `messageId`'siz rapor.

Canlı doğrulama: web build'de karşıdakinin mesajına uzun bas → menü **composer'ın
ve tab bar'ın üstünde** açılıyor (mount kontrolü); copy panoya yazıyor; correct
eski uzun basmanın yaptığını birebir yapıyor; rapor satırı `messageId` ile düşüyor.
Sonra iOS'ta safe area'nın sayfayı kırpmadığı doğrulanır.

## D — Gerçek presence + `privacy.hideOnlineStatus`

`feat/presence-and-hide-online-status`

**Shared** — `packages/shared/src/discovery.ts`: `PRESENCE_HEARTBEAT_MS = 60_000`,
`PRESENCE_WRITE_MIN_GAP_MS = 50_000` (heartbeat'in altında, sınırda sessizce
düşmesin), `isOnlineAt(lastActiveAt, now)`. `profiles.ts:378`'deki kopya
`ONLINE_WINDOW_MS` silinir, shared'dan import edilir; `profiles.ts:415` ve
`discovery.ts:248` `isOnlineAt`'ten geçer.

`limits.ts`: `PlanLimits.hideOnlineStatus` (free `false`, pro/pro_plus `true`),
`PRO_FEATURES` ve `PRO_BENEFITS` listelerine eklenir — `rules.test.ts:62-68`
gerçek listeyi gezdiği için kapsam kendiliğinden gelir. `paywall.tsx`'teki iki
`Record<…>` kopya tablosu yazılana kadar derleme hatası verir; kasıt bu.

**`privacy` şeması ve gizli hata:** `profile.ts:134`'teki `privacy` nesnesi
`.partial()` yapılır — bugün iki alan zorunlu olsa mevcut istemcilerin
`{ privacy: { incognito: true } }` göndermesi anında doğrulamadan düşerdi. Ama
`updateProfile` (`profiles.ts:249-251,273`) `definedUpdates`'i olduğu gibi `$set`
ediyor, yani **alt-dokümanın tamamını değiştiriyor** — kısmi bir `privacy` diğer
bayrağı sessizce siler. Bu hata bugün canlıda mevcut, sadece `privacy`'nin tek
alanı olduğu için görünmüyor. `privacy` için noktalı yollara (`privacy.incognito`,
`privacy.hideOnlineStatus`) düzleştirilir; **ayrı commit ve `docs/decisions.md`'ye
ayrı not.**

**Presence yazımı** — yeni `apps/api/src/modules/presence/presence.ts`:
`touchPresence(db, userId, at)` (tek iş: `stats.lastActiveAt`) ve `PresenceThrottle`
(soket başına yazma kısıtı, `SocketRateLimiter` ile aynı ömür ve şekil).
`ws/types.ts` `SocketData`'ya `presence` eklenir. `ws/index.ts`'te:
bağlantıda kısıtsız `touchPresence` (insan uygulamayı açar açmaz noktayı bekler;
üstündeki `markPendingDelivered` süpürmesi gibi ateşle-unut), yeni
`presence:ping` handler'ı (throttle'lı), ve **yeni bir `disconnect` handler'ı**
yine kısıtsız `touchPresence(now)` ile.

Ayrılışta "offline bayrağı" değil `now` yazılmasının sebebi: doğru ("az önce
görüldü"), 5 dakikalık sönümü gerçek ayrılış anından başlatır, `active`
sıralamasını bozmaz ve — asıl önemlisi — **sönümlenen bir zaman damgası
takılı kalamaz.** Süreç çökünce `true` kalan bir boolean herkesi sonsuza dek
online gösterir; bu tasarım o klasik hataya fiziksel olarak bağışık.

`ws/rateLimit.ts:30-37` — `'presence:ping': { capacity: 4, refillPerSecond: 0.05 }`.
60 sn'lik heartbeat rahat geçer, döngüye giren istemci reddedilir. (`DEFAULT_LIMIT`
teknik olarak kapsardı ama `rateLimit.ts:39` yeni event'in adlı girdi almasını
açıkça söylüyor.) `awards.ts:46-52`'deki yazım kalır — artık gereksiz ama token
ödül hunisinin içinde, çıkarmak diff'i ekonomi yoluna genişletir; tek satırlık
"artık birincil yazar presence" yorumu eklenir.

**Bayrağa uyma** — yeni `modules/profiles/presenceVisibility.ts`
`hidesOnlineStatus(profile)`. `toPublicProfile`'da gizliyken `isOnline: false`
**ve `lastActiveAt` alanı yanıttan tamamen çıkarılır** — taze bir zaman damgası
dönüp `isOnline: false` demek, herhangi bir istemcinin tek çıkarmayla gerçeği
hesaplaması demektir; bayrak tiyatro olurdu. `PublicProfile.lastActiveAt` ve
`apps/mobile/src/api/types.ts:42` opsiyonel olur (bugün hiçbir yerde
render edilmiyor).

`routes/profiles.ts` PATCH — `hideOnlineStatus: true`, tier yetmiyorsa
`403 UPGRADE_REQUIRED` + `feature: 'hideOnlineStatus'`. **`false`'a çekmek her
zaman serbest**; aboneliği biten biri ayarı kapatabilmeli.

> **Karar — itiraz edersen değişir.** Incognito okuma anında tier'ı yeniden
> kontrol ediyor (`profileViews.ts:49`). `hideOnlineStatus` için bunu yapmıyorum:
> aynısı, aboneliği biten birini kendi hiçbir eylemi olmadan sessizce online
> görünür yapardı — faturalama olayıyla geri alınan bir gizlilik ayarı. Bu yüzden
> **yazma anında** kapılıyor: açmak için ücretli tier gerekir, açıldıktan sonra
> korumaya devam eder. Gelir açısından tersi savunulabilir, tek satırlık fark.

**Mobil:** `useSocket.ts`'e `PRESENCE_HEARTBEAT_MS` aralıklı `presence:ping`
(teardown'da `closeSocket()` yanında temizlenir; `_layout.tsx:22-27` soketin neden
tek sahipli olduğunu zaten açıklıyor). `settings.tsx`'e Incognito'nun altına
"Hide when I'm online — People will not see the green dot on your profile. You
can still see theirs.", `disabled={!isPro}`.

Testler: yeni `presence.test.ts` (enjekte saatli throttle, `rateLimit.test.ts`
deyimi); `ws/chat.test.ts`'e bağlanma ve ayrılma `lastActiveAt`'i tazeliyor +
`presence:ping` kova aşımında ack'ten `RATE_LIMITED`; `profiles.test.ts`'e
gizli Pro kullanıcı `isOnline: false` **ve `lastActiveAt` yok** (DB'de taze olduğu
halde), free kullanıcı yazmada 403, `false`'a çekmek hep başarılı, ve
**kısmi `privacy` regresyonu**; `moderation.test.ts`'e iki bayrağın bağımsız
olduğunu sabitleyen testler — **senin "çalışıyor mu test et" isteğinin cevabı
düzyazı değil, bu testler.**

Canlı doğrulama: iki hesapla iki cihazda. A, B'nin profiline bakar — nokta yanıyor.
B sekmeyi kapatır; ~5 dk sonra nokta söner (D'den önce B'nin son *mesajından*
5 dk sonra sönerdi, hata buydu). B "Hide when I'm online"ı açar; A yenileyince
nokta yok ve devtools'ta yanıtta `lastActiveAt` de yok. Atlas'ta
`db.profiles.findOne({_id: B})` — `stats.lastActiveAt` hâlâ yazılıyor. Fly
log'unda boşta duran bağlı istemci dakikada ~bir presence yazımı üretiyor,
olay başına bir tane değil.

## C — Discover'da online öncelikli sıralama

`feat/discovery-online-first`

**`sort=active` zaten online-öncelikli.** `'stats.lastActiveAt': -1` ile sıralamak
tanım gereği 5 dakikalık pencerede olanları başa koyuyor (`discovery.ts:198`).
O sıralama için C, `discovery.ts:125-127`'deki `$match`'i **silmekten** ibaret.
Kova sıralaması yalnız `recommended` ve `nearby` için gerekli.

`recommended` — `query.online` verildiğinde `$addFields`'e `onlineBucket`
(`lastActiveAt >= cutoff` **ve** `privacy.hideOnlineStatus !== true`) eklenir,
`$sort: { onlineBucket: -1, score: -1, 'stats.lastActiveAt': -1, _id: 1 }`.
Çip basılı değilse sıralama hiç değişmez.

`nearby` — yalnız `query.online` iken `$geoNear` sonrasına
`{ $sort: { onlineBucket: -1, distanceMeters: 1, _id: 1 } }`. Bu,
`discovery.ts:206-209`'un belgelediği en-yakın-önce garantisini bile bile atar —
ama çipe basarak istenen tam olarak bu, ve blocking sort `maxDistance` ile sınırlı,
Pro+'a özel bir aday kümesi üzerinde koşuyor. O yorum güncellenir; "`$sort` yok"
demeye devam etmesi, sıradaki okunacak dosyada yalan olur.

**Cursor doğruluğu — cutoff cursor'a çakılır.** `cutoff` istek başına yeniden
hesaplanıyor; iki sayfa arasında biri sınırı geçince tüm bölünme, çoktan verilmiş
bir `$skip`'in altından kayar (bir satır tekrarlar, biri kaybolur).
`discovery.ts:51-57`'deki çıplak tamsayı offset cursor'ı `<cutoffISO>|<offset>`
olur; `|` içermeyen cursor eski istemciler için `cutoff = now` ile ayrıştırılır
(geriye uyumlu). `packages/shared/src/discovery.ts`'e yeni
`DISCOVERY_CURSOR_MAX_AGE_MS` (1 saat) — daha eski cursor `VALIDATION_FAILED`
alır ve istemci baştan başlar; çakılı cutoff sınırsız bırakılırsa sonunda herkesi
online sayar ve kova sessizce anlamını yitirir.

**Index: yok, bilerek.** `onlineBucket` tıpkı `score` gibi `$addFields` türevi;
hiçbir index o sıralamayı süremez — `discovery.ts:21-37`'nin zaten kaydettiği
takas. Buraya index eklemek, `indexes.ts:1-14`'ün önlemek için var olduğu
"lokalde geçer, production'da collection scan'e düşer" sonucuna ters yönden
varmak olur. PR gövdesine bu gerekçe yazılır.

**İstemci:** çip etiketi "Online first" olur (artık filtre değil sıralama
değiştirici); `selected`/`setParams` tesisatı aynı kalır. D `lastActiveAt`'i
her ~60 sn'de oynattığı için `active` keyset'i aynı profili iki kez yayabilir:
yeni `src/lib/dedupeById.ts` ile düzleştirmede tekilleştirilir (B'de Chats'e de
uygulanır). Boş liste metninin online'ı açıklaması gerekmez — çip yüzünden liste
artık boşalamaz.

Testler (`discovery.test.ts`): yüksek skorlu offline vs düşük skorlu online →
online önde; `online=1` ile offline profiller hâlâ dönüyor, liste boşalmıyor;
`sort=active&online=1` ile `sort=active` aynı sonucu veriyor; **asıl cursor
testi** — `limit=1` ile iki sayfa arasında bir profil sınırı geçirilir, ikinci
sayfa ne tekrar ediyor ne atlıyor (çakılı cutoff olmadan bu test düşer, yazılma
sebebi bu); `hideOnlineStatus: true` + taze `lastActiveAt` yükseltilmiyor ve
`isOnline: false` dönüyor — **bu test taşıyıcı**, çünkü kova koşulu bir aggregation
`$cond`'unda, okuma değeri TypeScript'te: tek kuralın iki ifadesini bir arada
tutan tek şey bu test. Kod yorumunda bu ikilik not edilir.

Canlı doğrulama: web build'de "Online first"e bas — liste yeşil noktalarla
başlıyor ve boşalmak yerine offline profillerle devam ediyor; çip açıkken iki
sayfa kaydır, hiçbir kart iki kez görünmüyor; ikinci hesap kaydırmanın ortasında
sekmesini kapatınca liste zıplamıyor. Atlas'ta `recommended` pipeline'ına
`explain('executionStats')` — `$match` hâlâ `IXSCAN` alıyor; eklenen `$sort`'un
bozması en muhtemel şey bu.

---

## Riskler

1. **`privacy` `$set` hatası bugün canlıda.** `privacy` tek alanlı olduğu için
   gizli; D iner inmez ısırır. D'nin diff'inde ama kendi commit'ini hak ediyor.
2. **`errorCodeOf`** — soket reddi hiçbir zaman `ApiRequestError` değil, yani
   `chat/[id].tsx:123-128` kota mesajını hiç göstermemiş. G'ye katlandı; daha
   erken istersen öne alınabilir.
3. **Tek yeni bağımlılık `expo-clipboard`.** Diğer altı iş kurulu olanla çıkıyor.
4. **A'yı `keepPreviousData` olmadan göndermek regresyon**, iyileştirme değil.
5. **Star/pin kişiye özel.** Aşama 3 `Message.starred` olarak tasarlanırsa,
   thread'deki iki kişi farklı mesaj yıldızladığı ilk gün yeniden yazılır.
6. **Copilot menüde yok**, kilitli olarak da yok — gerekçe Context'te.
7. **`hideOnlineStatus` yazma-anında kapılıyor**, incognito emsalinden bilerek
   ayrılıyor. Ürün kararı; istersen tier'lar aynı davransın diye çevirebiliriz.
8. **Checkout paylaşımlı.** Her iş kendi worktree'sinde, her worktree kendi
   `pnpm install`'ı ile. Web deploy'u da ayrı `--detach` worktree'den — `expo export`
   commit'i değil çalışma ağacını paketliyor, başkasının kodunu yayınlamamak için.

---

## H — Kalan üç listeyi sayfala

`feat/paginate-remaining-lists`

B, chats ve mesaj geçmişini sayfaladı. Üç liste hâlâ tek atışlık ve üçü de
sessizce yanlış:

| Uç | Bugünkü hali | Sorun |
| --- | --- | --- |
| `GET /me/viewers` | `.limit(100)`, cursor yok | **Sessiz kırpma.** 150 kişi baktıysa Pro kullanıcı 100'ünü görür, kalanı yok sayılır — üstelik `total` doğruyu söylediği için sayı ile liste birbirini yalanlar |
| `GET /blocks` | limit **hiç yok** | Sınırsız sorgu, sınırsız yanıt |
| `GET /leaderboard` | `limit` varsayılan ve tavan `LEADERBOARD_PAGE_SIZE = 100` | 101. sıra ve sonrası ulaşılamaz |

**Sunucu.** Üçü de `limit + 1` ile `hasMore` tespiti ve `nextCursor` döndürür,
`listConversations`'daki kalıp. `viewers` ve `blocks` tarih sıralı olduğu için
mevcut `lib/dateIdCursor.ts` doğrudan oturuyor (`lastViewedAt`/`createdAt` +
id). Şemalar `packages/shared`'a: `cursor` + `limit`.

`viewers`'ta `total` sayımı kalır — ücretsiz kullanıcıya gösterilen sayı o, ve
`locked: true` dalı sayfalamadan önce dönüyor.

**Leaderboard'un ince yeri.** `rankOf(index, ...)` sayfa *içindeki* konumu
kullanıyor, yani ikinci sayfa 1'den başlar; sayfa sınırına denk gelen bir
beraberlik iki farklı sıra alır. Sıralamayı sayfalamadan bağımsız yapmak için:
her sayfanın **ilk satırının** sırası `countDocuments({tokens: {$gt: first.tokens}}) + 1`
ile hesaplanır, sayfanın kalanı mevcut beraberlik mantığıyla yürür. Bu, dosyanın
yorumunda korunması gerektiği söylenen değişmezi — sayfadaki ve sayfa dışındaki
görüntülemenin aynı sırayı vermesi — inşa gereği sağlar. Sayfa başına bir fazla
`countDocuments`, sıralama başına değil.

Keyset `{tokens: -1, _id: 1}` üzerinde; sıralama zaten öyle ve oradaki yorum
"`_id` beraberliği belirli biçimde bozar, böylece sayfalama ve tekrar çağrılar
uyuşur" diyor — yani bunun için tasarlanmış.

**İstemci.** `viewers.tsx`, `blocked.tsx`, `leaderboard.tsx` → `useInfiniteQuery`,
`RefreshControl`, korumalı `onEndReached`, footer spinner; şekil `discover.tsx`'ten
kopyalanır. Düzleştirmede `dedupeById`. `blocked.tsx` ve `viewers.tsx`
`useProfileCache` kullanıyor, yani A'daki `Skeleton` satır içi isim
yer tutucusu buralara da uygulanır.

**Index.** `profileViews` ve `blocks` için keyset sıralamasını karşılayan
bileşik index'ler `db/indexes.ts`'te var mı diye bakılır; yoksa oraya eklenir —
elle asla.

**Testler.** Üç uç için de: ikinci sayfa ne tekrar ediyor ne atlıyor;
`viewers`'ta `total` sayfalanmış listeden bağımsız kalıyor ve `locked` dalı
değişmiyor; leaderboard'da sayfa sınırına denk gelen beraberlik iki sayfada da
aynı sırayı veriyor **ve** sayfa dışındaki `viewer.rank` ile uyuşuyor — bu
sonuncusu taşıyıcı test.

**Doğrulama.** Lokal: `pnpm test`, sonra seed edilmiş hesapla üç ekranda da
ikinci sayfanın geldiği tarayıcıda görülür.

---

## I — Tam ekran route'larda geri tuşu

`fix/back-from-full-screen-routes`

**Bildirilen:** `app2.langx.io/store`'da geri tuşu Chats'i açıyor; profile
dönmesi gerekiyor.

**Kök neden repo'da zaten yazılı.** `app/(app)/intro.tsx`'in başındaki yorum:
*"Inside a tab navigator 'back' is whatever the stack happens to hold, and it
landed on Discover when this screen was opened on a fresh load."* Aynı hata;
sekmeler yeniden sıralandığı için (Chats artık ilk) düştüğü yer Discover değil
Chats. `intro` bunu `router.back()` yerine hedefi adıyla söyleyerek çözmüş.

`router.back()` çağıran **on ekran** var — `store`, `settings`, `viewers`,
`blocked`, `filters`, `edit-profile`, `paywall`, `profile/[handle]`,
`chat/[id]` — ve `canGoBack` hiçbir yerde kullanılmıyor. Yani bu tek bir
ekranın hatası değil, tekrarlanan bir kalıp.

**Önce doğrula, sonra düzelt.** İki senaryo ayrı ayrı ölçülecek, çünkü
düzeltmeyi belirleyen şey hangisinin bozuk olduğu:

1. Profile → Balance → Store → Geri (gerçek geçmiş var)
2. Doğrudan `/store` yüklenip Geri (geçmiş yok)

Sadece (2) bozuksa `canGoBack()` yeterli. (1) de bozuksa tab navigator geçmişi
yutuyor demektir ve hedefin adıyla verilmesi gerekir.

**Beklenen düzeltme:** `src/lib/navigation.ts`'e tek bir yardımcı —
`goBackTo(fallback: Href)`: geçmiş varsa `router.back()`, yoksa
`router.replace(fallback)`. On çağrı yerine uygulanır; her ekran kendi
ebeveynini adıyla verir (`store` → `/(app)/me`, `viewers` → `/(app)/me`,
`blocked`/`filters` → onları açan ekran). `paywall` gibi birden çok yerden
açılan ekranlarda çıplak `back()` doğru davranıştır ve fallback yalnızca
geçmiş yokken devreye girer.

**Test.** `vitest.config.ts` yalnız `src/lib`'e bakıyor, o yüzden karar
mantığı (`canGoBack` var/yok) saf bir fonksiyona çıkarılıp orada test edilir;
davranışın kendisi tarayıcıda iki senaryoda doğrulanır.
