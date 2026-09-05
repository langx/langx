# Tasarım işini runbook'a yazmak + profil sayfası eklemeleri

## Bağlam

Behic release öncesi son iş olarak tasarımı elden geçirmek istiyor: "bu
haliyle olmaz." Kapsam: `langx/apps/mobile` (Expo, web dahil) + `website/`.
Derinlik: baştan görsel kimlik — palet, tipografi, spacing'den oluşan bir
tasarım sistemi kurulup her ekran/sayfa ona geçirilecek. Tasarım işi
**şimdi yapılmayacak**; istek, bunun release runbook'una bölüm olarak
yazılması. Ek istek: profil sayfasına "Registered X ago" ve "Verified
Email" göstergeleri — bu da plana ekleniyor.

Keşif özeti (bölümün içeriğini belirleyen gerçekler):

- **İkon/splash hiç yok.** `app.config.ts`'te `icon`, `splash`,
  `adaptiveIcon`, `web.favicon` tanımsız; repo'da tek görsel dosya yok.
  Uygulama Expo'nun varsayılan ikonuyla derleniyor — tek başına release
  engelleyici.
- **Kod ile marka ayrışmış.** Yaşayan birikim: sarı `#ffc409` + turuncu
  `#ff571a`, çift-yay logo, Comfortaa (v1 uygulaması, langx.io, token
  sitesi, store görselleri tutarlı). Uygulamanın `theme.ts`'i ise
  siyah/mavi sisteme kaymış (primary `#111113`, accent `#3b6cf6`), sarı
  hiç yok. Sitenin `_themes.scss`'i sarıyı koruyor ve `pro/streak/accent`
  değerlerini `theme.ts`'ten ödünç alıyor — iki yüzey yarı senkron.
- **Uygulama tarafı migrasyona hazır:** token disiplini ~%88 (41
  StyleSheet, 783 token referansı, 6 inline style); `theme.ts`'te değer
  değiştirmek uygulamanın çoğunu tek edit'te boyar. Asıl işler: (a) dark
  mode yok — `colors` sabitten hook'a dönmeli, 41 stylesheet etkilenir
  (sitede üç durumlu dark mode zaten var); (b) ikonlar emoji — tab bar
  dahil 20 dosya, gerçek ikon setine geçmeli; (c) font yok — marka yazı
  tipi `expo-font` ile yüklenmeli; (d) `Button.tsx` ve `FormField.tsx`
  token öncesi kalma, hex hardcode'luyor — yeniden yazılınca 22+7 ekrana
  yayılır.
- **Site tarafı:** SCSS + CSS custom properties; `define-color` mixin'i
  (`-rgb`, `-contrast` türevleri) yük taşıyor, korunmalı. Radius ölçeği ve
  ilk altı spacing değeri uygulamayla zaten hizalı. Marka rengi ayrıca
  `app.html` meta'larında, `static/favicons/*` ve `Logo.svelte` inline
  SVG'sinde hardcoded. `features.ts`'in ekran görüntüleri hâlâ v1 UI.
- **Palet çakışması:** `cosmetics.ts`'teki bronz/gümüş/altın çerçevelerin
  rengi tanımsız ve v1 sarısı altına çok yakın — "gold" kademesi marka
  rengi gibi okunmamalı. `token-messaging-brief.md` coin/zincir
  ikonografisini yasaklıyor (Apple 3.1.5(b) riski).

## Değişiklik 1 — runbook'a "Design pass" bölümü

**Dosya:** `langx/docs/release-runbook.md`. "Actions that succeed
silently"den sonra, "Prerequisites that are business process, not
code"dan önce; aynı kalıp (neden + sessizce ne bozulur + checklist),
İngilizce, runbook üslubunda.

Bölümün anlatacağı: mağazaya giden build'in görünümü iki yönden
tutmuyor — ikon/splash hiç yok, koddaki tema mağazadaki markadan habersiz.
Checklist:

- [ ] Kimlik kararı: v1'in sarı/turuncu birikimi mi korunur, `theme.ts`'in
      kaydığı yön mü resmileşir? (Store update'i olduğu için ikon değişimi
      kurulu tabanda bilinçli maliyet.)
- [ ] Tek kaynak: uygulamada `theme.ts` (dark mode varyantlarıyla — bugün
      yok), sitede `_themes.scss`/`_variables.scss` (`define-color`
      sözleşmesi korunarak); aynı palet ve tip ölçeği, marka fontu
      uygulamaya `expo-font` ile girer.
- [ ] Emoji ikonlar (tab bar dahil, ~20 dosya) gerçek ikon setiyle
      değişir.
- [ ] `Button.tsx` / `FormField.tsx` token'a geçirilir (hardcode'ların
      ~13/18'i burada).
- [ ] Cosmetics: bronz/gümüş/altın renkleri tanımlanır, altın marka
      sarısından ayrışır; token görsellerinde coin/zincir ikonografisi yok.
- [ ] İkon + splash + adaptive icon + favicon üretilip `app.config.ts`'e
      bağlanır (`branding/` kaynakları raster; splash 3601px off-by-one,
      aynen kullanılamaz; vektör master yok).
- [ ] Ekranlar/sayfalar geçirilir; `website/src/lib/data/*.ts` içeriği ve
      toast/alert davranışı aynen kalır. Sitede `app.html` meta renkleri,
      `static/favicons/*`, `Logo.svelte` SVG'si ve `features.ts`'in v1
      ekran görüntüleri de güncellenir.
- [ ] Store ekran görüntüleri yeni kimlikle çekilir (`branding/`'e gider;
      out-of-scope, ihtiyaç olarak not edilir).

Sıra: fonksiyonel checklist'ten sonra, **Release** rollout'undan önce.

## Değişiklik 2 — profil sayfasına iki gösterge (plana kayıt)

`apps/mobile/app/(app)/profile/[handle].tsx` (başkasının profili) ve
uygunsa `me.tsx`:

- **"Registered X days/months/years ago"** — kayıt tarihinden göreli
  metin. Public profil DTO'sunun `createdAt` taşıması gerekir; taşımıyorsa
  `packages/shared` şemasına ve API'nin profil repository'sine eklenir
  (repository kuralı: handler koleksiyona doğrudan gitmez).
- **"Verified Email"** rozeti — Better Auth'un `emailVerified` alanından.
  İki id dünyası kuralına dikkat: `user` koleksiyonu ObjectId, bizimkiler
  string; sınırda `lib/authId.ts` kullanılır. Public DTO'ya boolean olarak
  eklenir (e-posta adresi asla sızmaz).

Bu iş tasarım geçişinden bağımsız uygulanabilir; güven göstergesi olarak
tasarım bölümünün "profil ekranı" geçişinde de görünümü elden geçirilir.
Şimdilik yapılacak olan, bunu runbook'taki design-pass checklist'ine bir
madde olarak eklemek: "Profile screen shows account age ('Registered X
ago') and a Verified Email badge — needs `createdAt` + `emailVerified` in
the public profile DTO."

## Doğrulama

Doküman değişikliği: `langx/` içinde branch + PR (standing rule,
commit/PR İngilizce), CI (prettier `format:check` dahil) yeşilse biter.
