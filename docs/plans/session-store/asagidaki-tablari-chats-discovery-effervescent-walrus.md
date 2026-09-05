# Tab sırası + profilde settings ikonu

## Context

İki küçük UI düzenlemesi, ikisi de `langx/apps/mobile` içinde.

**1. Tab sırası.** Alt tab bar bugün `Discover → Chats → Leaderboard → Profile`
sırasında. İstenen sıra `Chats → Discover → Leaderboard → Profile`, yani ilk iki
tab yer değiştiriyor. (İlk istekte "discovery" yazılmıştı; bu bir yazım hatası —
tab başlığı `Discover` kalıyor, `discover.tsx` route'u yeniden adlandırılmıyor.)

**2. Settings girişi.** `settings` ekranına tüm uygulamada tek bir giriş noktası
var: profil sayfasının en altındaki, token store'un ve kozmetik listesinin
altında kalan ikincil "Settings" butonu (`me.tsx:267-272`). Uzun bir sayfanın
dibinde olduğu için pratikte kaybolmuş durumda. Sağ üst köşede bir settings
ikonuna taşınıyor; alttaki buton kaldırılıyor, böylece tek giriş noktası
kalıyor.

Sonuç: ayarlar profil sayfasını açar açmaz görünür oluyor ve sohbetler
uygulamanın ilk sekmesi hâline geliyor.

## Ön koşul — ikon kütüphanesi

Bugün `apps/mobile` içinde **hiçbir ikon kütüphanesi yok**: tüm ikonlar
`<Text>` içinde emoji ya da Unicode glifi (tab ikonları 🧭 💬 🏆 👤, geri `‹`,
disclosure `›`). Başka bir agent bir ikon kütüphanesi ekleyecek.

Uygulamaya başlarken **önce `apps/mobile/package.json` okunacak** ve o agent'ın
eklediği kütüphane kullanılacak — `@expo/vector-icons` ise `Ionicons`
`settings-outline`, `lucide-react-native` ise `Settings`. Kütüphane henüz
eklenmemişse bu adım orada durur; tab sırası değişikliği ondan bağımsız,
tek başına tamamlanabilir.

## Değişiklikler

### 1. `apps/mobile/app/(app)/_layout.tsx` — tab sırası

Tab bar sırasını `Tabs.Screen` bildirim sırası belirliyor. `name="chats"`
bloğunu (56-60. satırlar) `name="discover"` bloğunun (47-53) üstüne taşı.
Başlıklar, emoji ikonlar, `FULL_SCREEN` listesi ve diğer her şey aynı kalır.

Bunun tek yan etkisi: expo-router'da ilk bildirilen tab aynı zamanda
navigator'ın initial route'u olur, yani `chats` initial route hâline gelir.
Uygulamanın açılışta nereye düştüğü **değişmez** — `app/index.tsx:67`,
`(onboarding)/done.tsx:48` ve `welcome-back.tsx:56` hepsi açıkça
`/(app)/discover` adresine yönlendiriyor. Değişen tek davranış, Android donanım
geri tuşunun bir tab'dan çıkarken artık `chats`'e uğraması.

### 2. `apps/mobile/app/(app)/me.tsx` — sağ üstte settings ikonu

**Ekle:** `<Screen>`'in ilk çocuğu olarak, `styles.hero`'nun üstüne sağa
yaslanmış bir satır:

```tsx
<View style={styles.topBar}>
  <Pressable
    onPress={() => router.push('/(app)/settings')}
    hitSlop={12}
    accessibilityRole="button"
    accessibilityLabel="Settings"
  >
    {/* ikon kütüphanesinden settings ikonu, colors.textMuted */}
  </Pressable>
</View>
```

`topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' }`.

Ayrı bir başlık metni eklenmiyor: `hero`'daki büyük avatar ve isim zaten bu
sayfanın başlığı, üstüne bir de "Profile" yazmak aynı şeyi iki kez söylerdi.
İkon `Screen scroll` içinde olduğu için sayfayla birlikte kayar — bu, uygulamada
`‹ Back` satırlarının tamamının halihazırda davrandığı biçim
(`settings.tsx:138`, `profile/[handle].tsx:116`, `edit-profile.tsx:163`, …).
Header'ı `headerShown: true` ile açmak bir alternatif değil: `(app)/_layout.tsx`
ekranı zaten `SafeAreaView edges={['top']}` içine sarıyor, ikisi üst inset
üzerinde çakışır.

`Pressable` hâlihazırda `me.tsx:14`'te import edilmiş durumda; yeni bir paylaşılan
`IconButton` bileşeni **yapılmıyor** — tek kullanım yeri var.

**Kaldır:** alttaki "Settings" butonu (`me.tsx:267-272`) ve artık kullanılmayan
`settingsSecondary` stili (`me.tsx:337`). "Edit profile" ve "Sign out" butonları
yerinde kalır.

**Küçük temizlik:** kalan `settings: { marginTop: spacing.xl }` stili aslında
"Edit profile" butonuna uygulanıyor (`me.tsx:265`); ayarlarla ilgisi kalmadığı
için adı yanıltıcı olur — `firstAction` olarak yeniden adlandır.

## Dokunulmayan yerler

- `settings.tsx` — `router.back()` ile geri dönüyor, giriş noktası değiştiği
  için değişmesi gerekmiyor.
- `intro.tsx:22`'deki `router.replace('/(app)/settings')` dönüş yolu.
- Tab emoji ikonları. Yeni ikon kütüphanesine geçirmek ayrı bir iş; bu istekte yok.

## Doğrulama

`langx/` bir git checkout'u, şu an temiz ve `main` üzerinde — önce dal aç, iş
bitince PR.

```bash
cd ~/Developer/langx/langx
git checkout -b ui/tab-order-profile-settings
pnpm -r typecheck && pnpm lint && pnpm format:check && pnpm test
```

Otomatik testler bu değişikliği yakalamaz: uygulamada tek bir navigasyon/ekran
testi yok (47 test dosyasının hepsi saf fonksiyon testi), dolayısıyla dört
komut da yalnızca regresyon olmadığını gösterir. Asıl doğrulama elle:

```bash
pnpm dev   # API :4000, Expo :8081
```

Playwright ile `:8081` üzerinden, giriş yapmış bir hesapla:

1. Alt tab bar sırası soldan sağa **Chats · Discover · Leaderboard · Profile**.
2. Dört tab da açılıyor; `chat/[id]`, `settings`, `paywall` gibi ekranlarda tab
   bar hâlâ gizli (`FULL_SCREEN` bozulmamış).
3. Profile tab'ında sağ üstte settings ikonu görünüyor, tıklayınca settings
   ekranı açılıyor, `‹ Back` profile geri dönüyor.
4. Profil sayfasının altında artık "Settings" butonu yok; "Edit profile" ve
   "Sign out" duruyor.
5. Ekran genişliğini daraltıp ikonun `Screen`'in 720px'lik ortalı kolonunun sağ
   kenarına hizalandığını doğrula.

Not: droplet'te Metro'yu çalıştırmadan önce inotify limitini yükselt, yoksa
ENOSPC ile düşer.

## Teslim — doğru sıra

İstenen adımlar "commit → PR → test → merge → deploy" olarak sıralanmıştı;
doğrusu testin commit'ten **önce** ve merge'den sonra bir kez daha gelmesi.
Sıra şu:

1. **Yerel kontroller.** `pnpm -r typecheck && pnpm lint && pnpm format:check && pnpm test`.
   Kırmızı bir şey varsa burada düzelt — CI'ya kırık iş göndermenin maliyeti
   bir tur bekleme.
2. **Elle doğrulama.** Yukarıdaki "Doğrulama" bölümündeki 5 madde, `pnpm dev`
   ile `:8081` üzerinde. Bu değişikliği hiçbir otomatik test yakalamıyor, o
   yüzden bu adım atlanamaz.
3. **Commit.** `ui/tab-order-profile-settings` dalına, İngilizce mesajla,
   `Co-Authored-By` satırıyla. Yalnızca bu işe ait dosyalar
   (`(app)/_layout.tsx`, `(app)/me.tsx`) — aşağıdaki "Paylaşılan çalışma ağacı"
   notuna bak.
4. **Push.** `git push -u origin ui/tab-order-profile-settings`. `origin` zaten
   SSH (`git@github.com:langx/langx.git`) ve droplet'te `xuelink` olarak
   çalışıyor; HTTPS remote'unda kimlik bilgisi yok.
5. **PR aç.** `gh pr create`. Gövdede tab sırası değişikliğinin ekran
   görüntüsünü/açıklamasını ver.
6. **CI.** GitHub Actions dört kontrolü (typecheck, lint, format:check, test)
   PR üzerinde koşturur. Yeşil olmadan merge yok.
7. **Merge.** `langx` deposunun kuralı **rebase** (merge commit değil — o
   `website` için). Rebase, altta duran dalların SHA'larını kaydırır; bu dalın
   üstüne yığılmış başka iş varsa önce ona bak.
8. **Deploy.** İki ayrı hedef, ikisi de merge sonrası:
   - **API** — `main`'e merge Fly.io'ya otomatik deploy eder. Bu değişiklik
     mobile-only, yani API tarafında etkisi yok ama deploy yine de tetiklenir.
   - **Web** — **otomatik değil.** `app2.langx.io`, Cloudflare Pages'teki
     `langx-web` projesi; push yayınlamaz. `apps/mobile` içinden
     `pnpm build:web && pnpm deploy:web` gerekir.
   - Mağazadaki iOS/Android sürümleri ayrı bir konu; bu değişiklik bir sonraki
     mobil sürümle gider.
9. **Deploy sonrası doğrulama.** `app2.langx.io` üzerinde tab sırası ve profil
   sağ üstteki settings ikonu.

Deploy dışa dönük bir adım — 8. adıma geçmeden önce Behic'ten açık onay al.

## Paylaşılan çalışma ağacı — dikkat

Bu checkout'ta **eşzamanlı olarak başka bir agent çalışıyor**. Aynı ağaçta
onların commit'lenmemiş işi duruyor: `@expo/vector-icons` bağımlılığı
(`apps/mobile/package.json` + `pnpm-lock.yaml`), yeni
`src/components/LanguageCards.tsx`, `src/lib/languageLevel.ts`, ve
`discover.tsx` / `profile/[handle].tsx` / `api/queries.ts` / `api/types.ts`
değişiklikleri — **artı `me.tsx` içinde benimkiyle aynı dosyada duran
düzenlemeler** ("My languages" chip'lerini `LanguageCards` ile değiştiriyorlar).

Bunun iki sonucu var:

- 3. adımdaki commit `me.tsx`'i olduğu gibi alamaz; yalnızca bu işe ait hunk'lar
  alınmalı, yoksa başkasının yarım işi commit'lenir.
- Settings ikonu `@expo/vector-icons`'a bağlı ve o bağımlılık **onların**
  commit'lenmemiş değişikliği. Yani bu dal tek başına yeşil CI vermez;
  o iş `main`'e inmeden bu PR merge edilemez.

Doğru çözüm, sıra sorununu bir sıra hâline getirmek: önce onların işi
`main`'e insin, sonra bu dal `main` üzerine rebase edilip 1. adımdan devam
edilsin. Alternatif, bu işi ayrı bir `git worktree`'ye taşımak — ama o zaman
CLAUDE.md gereği o worktree'nin kendi `pnpm install`'ı gerekir.
