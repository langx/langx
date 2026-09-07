# Store listing copy (v2)

Both listings currently describe v1 and must be updated before release. One
claim in them is **wrong rather than stale**: badges exist in v1, are not in
v2's first release, and are planned for the next one. Leaving it up is a
feature claim the app does not meet.

Voice messages _were_ on that list and are not any more — they shipped in P0
along with image messages (`cef9309`), pulled forward because the v1 message
migration would otherwise have had to drop 1,270 voice notes and 3,604 photos.
The listing may advertise them.

The listings must also declare in-app purchases. v1 had none.

**The App Store description must end with a working Terms of Use link.**
App Review rejected 2.0.0 on 6 September 2026 under Guideline 3.1.2
(Business: Payments – Subscriptions): an app that sells auto-renewable
subscriptions has to link the Terms of Use (EULA) from the metadata on its
product page, and the app description is the only place Apple reads it from
when the standard Apple EULA is used. The footer below is that link, plus the
privacy policy so both documents are one tap away. Keep it when the description
is next rewritten.

---

## English

**Title (30)**
`LangX: Language Exchange`

**Subtitle / short description (80)**
`Practice a language by talking with people learning yours.`

**Description**

> LangX matches you with people who speak the language you're learning and are
> learning the language you speak. No lessons, no homework — just real
> conversations with someone who needs exactly what you can offer.
>
> **Matched both ways.** You only see people whose languages fit yours in both
> directions, so every conversation has something in it for both of you.
>
> **Correct each other.** Tap any message to suggest a better way to say it.
> Corrections are unlimited for everyone, on every plan — teaching is the whole
> point.
>
> **Translation when you're stuck.** Built in, so you don't leave the chat.
>
> **A reason to come back.** Keep a daily streak, earn tokens for talking and
> teaching, and see where you land on the weekly, monthly, yearly and all-time
> boards.
>
> **Free to use, always.** Reply to every message you receive with no limits,
> and correct as many as you like. On the free plan you can start 5 new
> conversations a day.
>
> **LangX Pro** adds unlimited new conversations, filters by gender, country,
> age and level, unlimited translation, who viewed your profile, and incognito
> browsing.
>
> LangX is open source (BSD-3) and can be self-hosted.
>
> Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Terms & Conditions: https://langx.io/terms-conditions
> Privacy Policy: https://langx.io/privacy-policy

**Keywords (iOS, 100 chars)**
`language,exchange,learn,practice,speaking,tandem,partner,english,spanish,chat`

---

## Türkçe

**Başlık (30)**
`LangX: Dil Değişimi`

**Kısa açıklama (80)**
`Senin dilini öğrenen biriyle konuşarak dil öğren.`

**Açıklama**

> LangX seni, öğrendiğin dili konuşan ve senin dilini öğrenen insanlarla
> eşleştirir. Ders yok, ödev yok — tam olarak senin verebileceğin şeye ihtiyacı
> olan biriyle gerçek sohbetler var.
>
> **Karşılıklı eşleşme.** Yalnızca dilleri seninkiyle iki yönde de uyuşan
> kişileri görürsün, böylece her sohbet iki taraf için de anlamlı olur.
>
> **Birbirinizi düzeltin.** Herhangi bir mesaja dokunup daha doğru söylenişini
> öner. Düzeltmeler her planda sınırsız — asıl mesele öğretmek.
>
> **Takıldığında çeviri.** Uygulamanın içinde, sohbetten çıkmadan.
>
> **Geri dönmek için bir sebep.** Günlük serini koru, konuşarak ve öğreterek token
> kazan, haftalık/aylık/yıllık ve tüm zamanlar tablolarında yerini gör.
>
> **Kullanımı her zaman ücretsiz.** Sana gelen tüm mesajlara sınırsız cevap
> verebilir, istediğin kadar düzeltme yapabilirsin. Ücretsiz planda günde 5 yeni
> sohbet başlatabilirsin.
>
> **LangX Pro** sınırsız yeni sohbet, cinsiyet/ülke/yaş/seviye filtreleri,
> sınırsız çeviri, profilini kimin görüntülediği ve gizli gezinme ekler.
>
> LangX açık kaynaktır (BSD-3) ve kendi sunucunda barındırılabilir.
>
> Kullanım Koşulları (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Şartlar ve Koşullar: https://langx.io/terms-conditions
> Gizlilik Politikası: https://langx.io/privacy-policy

---

## What's new (release notes)

> LangX v2 is a rebuild. Faster matching, realtime chat, message corrections,
> built-in translation, daily streaks and token leaderboards.
>
> Your username is waiting for you — sign up with the email you used before and
> claim it.
>
> Badges are coming back in the next release.

The third line is not optional. Every v1 user has to sign up again — the old
password hashes could not be migrated — and without that sentence the first
thing a returning user meets is a login that rejects them.
