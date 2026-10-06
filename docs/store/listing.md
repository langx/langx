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

**There is one paid plan, LangX Pro** (since 28 September 2026; Fluent and
Polyglot were merged into it — `decisions.md` → _One plan: Pro_). Every
language's description carries the same three blocks, straight from
`PLAN_LIMITS`: what Free gives (5 new chats and 20 translations a day; photo
and voice messages up to 500 a day and 10 profile photos on every plan), the
Pro list, with translation at 1,000 a day rather than "unlimited", and the ways
to get Pro without paying — invites, streaks and gift codes. The free week is
promised for the _first_ subscription only, because that is who the stores give
it to. No prices anywhere: the store shows its own, in the reader's currency.
The in-app purchase display names and descriptions read "LangX Pro" in all
eight languages; they go through Apple's IAP review on their own, without an
app version.

**The App Store description must end with a working Terms of Use link.**
App Review rejected 2.0.0 on 6 September 2026 under Guideline 3.1.2
(Business: Payments – Subscriptions): an app that sells auto-renewable
subscriptions has to link the Terms of Use (EULA) from the metadata on its
product page, and the app description is the only place Apple reads it from
when the standard Apple EULA is used. The footer below is that link, plus the
privacy policy so both documents are one tap away. Keep it when the description
is next rewritten. Play's full description is the same text without the
Apple EULA line.

`docs/store/2.9-metadata.json` is this file's 2.9 text in plain form — no
Markdown, one object per store locale — for the App Store Connect and Play APIs.
Change the copy here first and carry it over; nothing checks the two agree.
Play has no Russian or Arabic listing, so the file has no Play entry for
either.

Apple's subtitle is **30 characters**; the 80-character line is Google Play's
short description. They were the same field here until now, which made every
subtitle in this file too long for the App Store — the English and the Turkish
included. Both are written out below, per language.

---

## English

**Title (30)**
`LangX: Language Exchange`

**Apple subtitle (30)**
`Practice with real people`

**Play short description (80)**
`Practice a language by talking with people learning yours.`

**Description**

> LangX matches you with people who speak the language you're learning and are learning the language you speak. No lessons, no homework — just real conversations with someone who needs exactly what you can offer.
>
> **Matched both ways.** You only see people whose languages fit yours in both directions, so every conversation has something in it for both of you.
>
> **Correct each other.** Tap any message to suggest a better way to say it. Corrections are unlimited for everyone, on every plan — teaching is the whole point.
>
> **Translation when you're stuck.** Built in, so you don't leave the chat.
>
> **Voice and video calls.** Call the people you chat with, free on every plan. A call rings like a phone call even when the app is closed, and one switch turns calls off.
>
> **A reason to come back.** Keep a daily streak, earn tokens for talking and teaching, and see where you land on the weekly, monthly, yearly and all-time boards.
>
> **Free to use, always.** Reply to every message you receive with no limits, and correct as many as you like. Every day the free plan gives you 5 new conversations and 20 translations. Photo and voice messages, up to 500 a day, and 10 profile photos are the same on every plan.
>
> **LangX Pro is one plan with everything:**
> • Unlimited new conversations
> • 1,000 translations a day
> • Gender and city filters
> • See who viewed your profile
> • Incognito browsing
> • Nearby: partners close to you
> • Up to 5 languages you learn and 5 you speak
> • Send in their language: write in yours, and both arrive
> • Export your saved phrases
> • A boosted profile in Discover
>
> Your first subscription, monthly or yearly, starts with a free week.
>
> **Or get Pro for free.** Invite three friends who start talking on LangX and you get a month of Pro. A 100-day streak earns you a month, a 365-day streak three. Have a gift code? Enter it on the Plans screen.
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

**Apple altbaşlığı (30)**
`Gerçek insanlarla pratik`

**Play kısa açıklaması (80)**
`Senin dilini öğrenen biriyle konuşarak dil öğren.`

**Açıklama**

> LangX seni, öğrendiğin dili konuşan ve senin dilini öğrenen insanlarla eşleştirir. Ders yok, ödev yok — tam olarak senin verebileceğin şeye ihtiyacı olan biriyle gerçek sohbetler var.
>
> **Karşılıklı eşleşme.** Yalnızca dilleri seninkiyle iki yönde de uyuşan kişileri görürsün, böylece her sohbet iki taraf için de anlamlı olur.
>
> **Birbirinizi düzeltin.** Herhangi bir mesaja dokunup daha doğru söylenişini öner. Düzeltmeler her planda sınırsız — asıl mesele öğretmek.
>
> **Takıldığında çeviri.** Uygulamanın içinde, sohbetten çıkmadan.
>
> **Sesli ve görüntülü arama.** Sohbet ettiğin kişileri ara; her planda ücretsiz. Arama, uygulama kapalıyken bile telefon gibi çalar; istemezsen tek bir ayarla kapatırsın.
>
> **Geri dönmek için bir sebep.** Günlük serini koru, konuşarak ve öğreterek token kazan, haftalık/aylık/yıllık ve tüm zamanlar tablolarında yerini gör.
>
> **Kullanımı her zaman ücretsiz.** Sana gelen tüm mesajlara sınırsız cevap verebilir, istediğin kadar düzeltme yapabilirsin. Ücretsiz planda her gün 5 yeni sohbet başlatabilir, 20 çeviri yapabilirsin. Fotoğraflı ve sesli mesajlar (günde 500'e kadar) ve 10 profil fotoğrafı her planda aynı.
>
> **LangX Pro, her şeyi içeren tek plan:**
> • Sınırsız yeni sohbet
> • Günde 1.000 çeviri
> • Cinsiyet ve şehir filtreleri
> • Profiline kimlerin baktığı
> • Gizli gezinme
> • Yakınındaki partnerler
> • Öğrendiğin 5, konuştuğun 5 dile kadar
> • Onun dilinde gönder: sen kendi dilinde yaz, ikisi birden gitsin
> • Kaydettiğin ifadeleri dışa aktarma
> • Keşfet'te öne çıkan profil
>
> İlk aboneliğin, ister aylık ister yıllık olsun, ücretsiz bir haftayla başlar.
>
> **Pro'yu ücretsiz de alabilirsin.** Davet ettiğin üç arkadaşın LangX'te konuşmaya başlarsa bir ay Pro senin. 100 günlük seri bir ay, 365 günlük seri üç ay kazandırır. Hediye kodun mu var? Planlar ekranında gir.
>
> LangX açık kaynaktır (BSD-3) ve kendi sunucunda barındırılabilir.
>
> Kullanım Koşulları (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Şartlar ve Koşullar: https://langx.io/terms-conditions
> Gizlilik Politikası: https://langx.io/privacy-policy

**Anahtar kelimeler (iOS, 100 karakter)**
`dil,değişim,öğren,pratik,konuşma,tandem,partner,ingilizce,ispanyolca,sohbet`

---

## Español (es-ES)

**Título (30)**
`LangX: Intercambio de idiomas`

**Subtítulo de Apple (30)**
`Practica con gente real`

**Descripción corta de Play (80)**
`Practica un idioma hablando con quien aprende el tuyo.`

**Descripción**

> LangX te empareja con personas que hablan el idioma que aprendes y están aprendiendo el tuyo. Sin clases, sin deberes: solo conversaciones reales con alguien que necesita exactamente lo que tú puedes ofrecer.
>
> **Emparejamiento en ambos sentidos.** Solo ves a personas cuyos idiomas encajan con los tuyos en las dos direcciones, así que cada conversación aporta algo a los dos.
>
> **Corrección mutua.** Toca cualquier mensaje para sugerir una forma mejor de decirlo. Las correcciones son ilimitadas para todo el mundo y en todos los planes: enseñar es lo esencial.
>
> **Traducción cuando te atascas.** Integrada, sin salir del chat.
>
> **Llamadas de voz y videollamadas.** Llama a las personas con las que chateas, gratis en todos los planes. La llamada suena como una de teléfono aunque la app esté cerrada, y un solo ajuste las desactiva.
>
> **Un motivo para volver.** Mantén tu racha diaria, gana tokens por hablar y enseñar, y mira dónde quedas en las clasificaciones semanal, mensual, anual y de siempre.
>
> **Gratis siempre.** Responde sin límite a todos los mensajes que recibas y corrige tantos como quieras. Cada día, el plan gratuito te da 5 conversaciones nuevas y 20 traducciones. Los mensajes de foto y de voz (hasta 500 al día) y las 10 fotos de perfil son iguales en todos los planes.
>
> **LangX Pro es un solo plan con todo:**
> • Conversaciones nuevas ilimitadas
> • 1.000 traducciones al día
> • Filtros por género y ciudad
> • Quién ha visto tu perfil
> • Navegación de incógnito
> • Gente cerca de ti
> • Hasta 5 idiomas que aprendes y 5 que hablas
> • Envía en su idioma: escribe en el tuyo y le llegan los dos
> • Exporta tus expresiones guardadas
> • Perfil destacado en Descubrir
>
> Tu primera suscripción, mensual o anual, empieza con una semana gratis.
>
> **O consigue Pro gratis.** Invita a tres amigos que empiecen a conversar en LangX y te llevas un mes de Pro. Una racha de 100 días te da un mes; una de 365, tres. ¿Tienes un código de regalo? Introdúcelo en la pantalla Planes.
>
> LangX es de código abierto (BSD-3) y se puede autoalojar.
>
> Términos de uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Términos y condiciones: https://langx.io/terms-conditions
> Política de privacidad: https://langx.io/privacy-policy

**Palabras clave (iOS, 100 caracteres)**
`idioma,intercambio,aprender,practicar,hablar,tándem,compañero,inglés,español,chat`

---

## Русский (ru)

**Название (30)**
`LangX: языковой обмен`

**Подзаголовок Apple (30)**
`Практика с живыми людьми`

**Краткое описание Play (80)**
`Практикуй язык с теми, кто учит твой.`

**Описание**

> LangX подбирает тебе собеседников, которые говорят на языке, который ты учишь, и учат твой язык. Никаких уроков и домашних заданий — просто живые разговоры с человеком, которому нужно именно то, что ты можешь дать.
>
> **Совпадение в обе стороны.** Ты видишь только тех, чьи языки подходят твоим в обоих направлениях, поэтому каждый разговор что-то даёт обоим.
>
> **Исправляйте друг друга.** Нажми на любое сообщение, чтобы предложить, как сказать лучше. Исправления безлимитны для всех и на любом тарифе — учить друг друга и есть смысл приложения.
>
> **Перевод, когда застрял.** Встроенный, не выходя из чата.
>
> **Аудио- и видеозвонки.** Звони тем, с кем переписываешься, — бесплатно на любом тарифе. Звонок приходит как обычный телефонный, даже если приложение закрыто, а отключить звонки можно одним переключателем.
>
> **Повод возвращаться.** Держи ежедневную серию, зарабатывай токены за общение и помощь другим и смотри своё место в таблицах за неделю, месяц, год и всё время.
>
> **Всегда бесплатно.** Отвечай без ограничений на все полученные сообщения и исправляй сколько хочешь. На бесплатном тарифе каждый день можно начать 5 новых разговоров и сделать 20 переводов. На всех тарифах одинаково: до 500 фото и голосовых сообщений в день и 10 фото в профиле.
>
> **LangX Pro — один тариф со всем сразу:**
> • Безлимитные новые разговоры
> • 1000 переводов в день
> • Фильтры по полу и городу
> • Кто заходил в твой профиль
> • Невидимый режим
> • Собеседники рядом с тобой
> • До 5 изучаемых и 5 родных языков
> • Отправка на их языке: пишешь на своём, а приходят оба варианта
> • Экспорт сохранённых фраз
> • Продвижение профиля в Поиске
>
> Первая подписка — месячная или годовая — начинается с бесплатной недели.
>
> **Или получи Pro бесплатно.** Пригласи трёх друзей, которые начнут общаться в LangX, — и месяц Pro твой. Серия в 100 дней приносит месяц, в 365 дней — три. Есть подарочный код? Введи его на экране «Тарифы».
>
> LangX — открытый исходный код (BSD-3), можно развернуть на своём сервере.
>
> Условия использования (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Условия и положения: https://langx.io/terms-conditions
> Политика конфиденциальности: https://langx.io/privacy-policy

**Ключевые слова (iOS, 100 символов)**
`язык,обмен,учить,практика,разговор,тандем,партнёр,английский,испанский,чат`

---

## العربية (ar-SA)

**الاسم (30)**
`LangX: تبادل اللغات`

**العنوان الفرعي في Apple (30)**
`تدرّب مع أشخاص حقيقيين`

**الوصف المختصر في Play (80)**
`تدرّب على لغة بالحديث مع من يتعلّم لغتك.`

**الوصف**

> يجمعك LangX مع أشخاص يتحدثون اللغة التي تتعلّمها ويتعلّمون لغتك. لا دروس ولا واجبات — فقط محادثات حقيقية مع شخص يحتاج تمامًا إلى ما تستطيع تقديمه.
>
> **تطابق في الاتجاهين.** لا ترى إلا من تتوافق لغاتهم مع لغاتك في الاتجاهين، فيكون في كل محادثة ما يفيد الطرفين.
>
> **صحّحوا لبعضكم.** اضغط على أي رسالة لتقترح صياغة أفضل. التصحيحات غير محدودة للجميع وفي كل الخطط — فالتعليم هو جوهر التطبيق.
>
> **ترجمة عند التوقف.** مدمجة، دون مغادرة المحادثة.
>
> **مكالمات صوتية ومكالمات فيديو.** اتصل بمن تتحدث معهم، مجانًا في كل الخطط. ترنّ المكالمة مثل مكالمة هاتفية حتى عندما يكون التطبيق مغلقًا، ويمكنك إيقاف المكالمات بمفتاح واحد.
>
> **سبب للعودة.** حافظ على سلسلتك اليومية، واكسب الرموز مقابل الحديث والتعليم، وشاهد ترتيبك في لوحات الأسبوع والشهر والسنة وكل الأوقات.
>
> **مجاني دائمًا.** ردّ بلا حدود على كل رسالة تصلك، وصحّح ما شئت. تمنحك الخطة المجانية كل يوم 5 محادثات جديدة و20 ترجمة. أما رسائل الصور والرسائل الصوتية (حتى 500 يوميًا) و10 صور في الملف الشخصي فهي واحدة في كل الخطط.
>
> **LangX Pro خطة واحدة فيها كل شيء:**
> • محادثات جديدة بلا حدود
> • 1000 ترجمة يوميًا
> • فلاتر حسب الجنس والمدينة
> • معرفة من زار ملفك
> • التصفّح الخفي
> • أشخاص قريبون منك
> • حتى 5 لغات تتعلّمها و5 تتحدثها
> • أرسل بلغته: اكتب بلغتك ويصله النصّان
> • تصدير العبارات التي حفظتها
> • ملف مُبرَز في الاستكشاف
>
> يبدأ اشتراكك الأول، شهريًا كان أو سنويًا، بأسبوع مجاني.
>
> **أو احصل على Pro مجانًا.** ادعُ ثلاثة أصدقاء، وإذا بدؤوا الحديث على LangX فلك شهر من Pro. سلسلة 100 يوم تمنحك شهرًا، وسلسلة 365 يومًا ثلاثة أشهر. لديك رمز هدية؟ أدخله في شاشة الخطط.
>
> LangX مفتوح المصدر (BSD-3) ويمكن استضافته ذاتيًا.
>
> شروط الاستخدام (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> الشروط والأحكام: https://langx.io/terms-conditions
> سياسة الخصوصية: https://langx.io/privacy-policy

**الكلمات المفتاحية (iOS، 100 حرف)**
`لغة,تبادل,تعلم,تدريب,محادثة,تاندم,شريك,إنجليزي,إسباني,دردشة`

---

## Français (fr-FR)

**Nom (30)**
`LangX : échange linguistique`

**Sous-titre Apple (30)**
`Pratiquez avec de vrais gens`

**Description courte Play (80)**
`Pratiquez une langue avec ceux qui apprennent la vôtre.`

**Description**

> LangX vous met en relation avec des personnes qui parlent la langue que vous apprenez et qui apprennent la vôtre. Pas de cours, pas de devoirs — juste de vraies conversations avec quelqu'un à qui vous apportez exactement ce dont il a besoin.
>
> **Une correspondance dans les deux sens.** Vous ne voyez que des personnes dont les langues complètent les vôtres dans les deux sens : chaque conversation a donc un intérêt pour les deux.
>
> **Corrigez-vous mutuellement.** Touchez un message pour proposer une meilleure formulation. Les corrections sont illimitées pour tout le monde et sur toutes les formules — s'apprendre les uns aux autres, c'est tout l'objet.
>
> **La traduction quand vous bloquez.** Intégrée, sans quitter la conversation.
>
> **Appels vocaux et vidéo.** Appelez les personnes avec qui vous discutez, gratuitement sur toutes les formules. L'appel sonne comme un appel téléphonique même quand l'app est fermée, et un seul réglage suffit pour les couper.
>
> **Une raison de revenir.** Tenez une série quotidienne, gagnez des jetons en parlant et en aidant, et voyez votre place aux classements de la semaine, du mois, de l'année et de tous les temps.
>
> **Gratuit, toujours.** Répondez sans limite à tous les messages que vous recevez et corrigez-en autant que vous voulez. Chaque jour, la formule gratuite vous donne 5 nouvelles conversations et 20 traductions. Les messages photo et vocaux (jusqu'à 500 par jour) et les 10 photos de profil sont les mêmes dans toutes les formules.
>
> **LangX Pro, une seule formule qui contient tout :**
> • Nouvelles conversations illimitées
> • 1 000 traductions par jour
> • Filtres par genre et par ville
> • Les visiteurs de votre profil
> • Navigation en incognito
> • Des partenaires à proximité
> • Jusqu'à 5 langues apprises et 5 parlées
> • Envoyer dans leur langue : vous écrivez dans la vôtre, les deux versions partent
> • Export de vos expressions enregistrées
> • Profil mis en avant dans Découvrir
>
> Votre premier abonnement, mensuel ou annuel, commence par une semaine offerte.
>
> **Ou obtenez Pro gratuitement.** Invitez trois amis qui se mettent à discuter sur LangX et gagnez un mois de Pro. Une série de 100 jours rapporte un mois, une série de 365 jours trois mois. Vous avez un code cadeau ? Saisissez-le sur l'écran Formules.
>
> LangX est open source (BSD-3) et peut être auto-hébergé.
>
> Conditions d'utilisation (CLUF) : https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Conditions générales : https://langx.io/terms-conditions
> Politique de confidentialité : https://langx.io/privacy-policy

**Mots-clés (iOS, 100 caractères)**
`langue,échange,apprendre,pratiquer,parler,tandem,partenaire,anglais,espagnol,chat`

---

## Deutsch (de-DE)

**Name (30)**
`LangX: Sprachaustausch`

**Apple-Untertitel (30)**
`Üben mit echten Menschen`

**Play-Kurzbeschreibung (80)**
`Übe eine Sprache mit Menschen, die deine lernen.`

**Beschreibung**

> LangX bringt dich mit Menschen zusammen, die die Sprache sprechen, die du lernst, und die deine Sprache lernen. Kein Unterricht, keine Hausaufgaben — nur echte Gespräche mit jemandem, der genau das braucht, was du geben kannst.
>
> **Passend in beide Richtungen.** Du siehst nur Menschen, deren Sprachen in beide Richtungen zu deinen passen. So hat jedes Gespräch für beide Seiten etwas.
>
> **Korrigiert euch gegenseitig.** Tippe auf eine Nachricht und schlage vor, wie man es besser sagt. Korrekturen sind für alle und in jedem Tarif unbegrenzt — ums Beibringen geht es hier.
>
> **Übersetzung, wenn du hängst.** Eingebaut, ohne den Chat zu verlassen.
>
> **Sprach- und Videoanrufe.** Ruf die Leute an, mit denen du schreibst — kostenlos in jedem Tarif. Ein Anruf klingelt wie ein Telefonanruf, auch wenn die App geschlossen ist, und ein Schalter stellt Anrufe ab.
>
> **Ein Grund wiederzukommen.** Halte deine tägliche Serie, verdiene Tokens fürs Reden und Helfen und sieh, wo du in den Ranglisten für Woche, Monat, Jahr und alle Zeiten stehst.
>
> **Immer kostenlos.** Antworte unbegrenzt auf jede Nachricht, die du bekommst, und korrigiere so viel du willst. Im kostenlosen Tarif hast du jeden Tag 5 neue Gespräche und 20 Übersetzungen. Foto- und Sprachnachrichten (bis zu 500 am Tag) und 10 Profilfotos sind in jedem Tarif gleich.
>
> **LangX Pro ist ein Tarif mit allem:**
> • Unbegrenzt neue Gespräche
> • 1.000 Übersetzungen am Tag
> • Filter nach Geschlecht und Stadt
> • Sehen, wer dein Profil besucht hat
> • Surfen im Inkognito-Modus
> • Partner in deiner Nähe
> • Bis zu 5 Sprachen, die du lernst, und 5, die du sprichst
> • In ihrer Sprache senden: Du schreibst in deiner, und beide Versionen kommen an
> • Gespeicherte Wendungen exportieren
> • Hervorgehobenes Profil in Entdecken
>
> Dein erstes Abo, ob monatlich oder jährlich, beginnt mit einer Gratiswoche.
>
> **Oder hol dir Pro gratis.** Lade drei Freunde ein, die auf LangX ins Gespräch kommen, und du bekommst einen Monat Pro. Eine Serie von 100 Tagen bringt einen Monat, eine von 365 Tagen drei. Du hast einen Geschenkcode? Gib ihn im Bildschirm „Tarife“ ein.
>
> LangX ist Open Source (BSD-3) und lässt sich selbst hosten.
>
> Nutzungsbedingungen (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Allgemeine Geschäftsbedingungen: https://langx.io/terms-conditions
> Datenschutzerklärung: https://langx.io/privacy-policy

**Keywords (iOS, 100 Zeichen)**
`Sprache,Austausch,lernen,üben,sprechen,Tandem,Partner,Englisch,Spanisch,Chat`

---

## Português do Brasil (pt-BR)

**Nome (30)**
`LangX: Intercâmbio de Idiomas`

**Subtítulo da Apple (30)**
`Pratique com gente real`

**Descrição curta da Play (80)**
`Pratique um idioma conversando com quem aprende o seu.`

**Descrição**

> O LangX conecta você a pessoas que falam o idioma que você aprende e que estão aprendendo o seu. Sem aulas, sem lição de casa — só conversas de verdade com alguém que precisa exatamente do que você tem a oferecer.
>
> **Combinação nos dois sentidos.** Você só vê pessoas cujos idiomas encaixam com os seus nas duas direções, então toda conversa tem algo para os dois.
>
> **Corrijam um ao outro.** Toque em qualquer mensagem para sugerir um jeito melhor de dizer. As correções são ilimitadas para todo mundo, em todos os planos — ensinar é o ponto principal.
>
> **Tradução quando você trava.** Integrada, sem sair da conversa.
>
> **Chamadas de voz e de vídeo.** Ligue para as pessoas com quem você conversa, de graça em todos os planos. A chamada toca como uma ligação normal, mesmo com o app fechado, e um único ajuste desliga as chamadas.
>
> **Um motivo para voltar.** Mantenha sua sequência diária, ganhe tokens por conversar e ensinar e veja sua posição nos rankings da semana, do mês, do ano e de todos os tempos.
>
> **Grátis, sempre.** Responda sem limite a todas as mensagens que receber e corrija quantas quiser. Todo dia, o plano gratuito dá 5 conversas novas e 20 traduções. As mensagens de foto e de voz (até 500 por dia) e as 10 fotos de perfil são iguais em todos os planos.
>
> **O LangX Pro é um plano só, com tudo:**
> • Conversas novas ilimitadas
> • 1.000 traduções por dia
> • Filtros por gênero e cidade
> • Quem visitou seu perfil
> • Navegação anônima
> • Gente perto de você
> • Até 5 idiomas que você aprende e 5 que você fala
> • Envie no idioma da pessoa: escreva no seu, e ela recebe os dois
> • Exporte suas expressões salvas
> • Perfil em destaque no Descobrir
>
> Sua primeira assinatura, mensal ou anual, começa com uma semana grátis.
>
> **Ou ganhe o Pro de graça.** Convide três amigos que comecem a conversar no LangX e ganhe um mês de Pro. Uma sequência de 100 dias vale um mês; uma de 365 dias, três. Tem um código de presente? Digite na tela Planos.
>
> O LangX é de código aberto (BSD-3) e pode ser hospedado por você mesmo.
>
> Termos de uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Termos e condições: https://langx.io/terms-conditions
> Política de privacidade: https://langx.io/privacy-policy

**Palavras-chave (iOS, 100 caracteres)**
`idioma,intercâmbio,aprender,praticar,falar,tandem,parceiro,inglês,espanhol,chat`

---

## What's new (release notes)

These are **2.9's** notes. 2.9 is the calls release: the first build that
carries voice and video calls to the phones (#1711) — the browser has had them
since #1700 — ringing through CallKit on an iPhone and as a full-screen call on
Android.

**Calls come first**, then the chat camera with view-once photos and videos
(#1705, #1713), reviews on a practice partner's profile (#1686), hidden mode
(#1706), Only people I talk to can write (#1703) and the reply arrow on threads
that were read and not answered (#1675).

**The camera needs a newer build than iOS 184.** #1713 added
`expo-screen-capture` after 184 was built from `24738cbdc`, which moves the
runtime fingerprint: 184 has no chat camera and cannot get one over the air.
The build sent for review must come from a commit that includes #1713, or these
notes claim a feature the binary does not have.

A version update needs release notes in **every** localization, not just the
primary one — App Store Connect will not let the version be submitted with one
missing.

The last line is not optional in any language. Every v1 user has to sign up
again — the old password hashes could not be migrated — and without that
sentence the first thing a returning user meets is a login that rejects them.

**Not claimed, deliberately.** The rule that opens reviews between two people is
written nowhere, in the store as in the app. Calls are not said to need a few
messages first: the rule is the photo gate's, and the app says so where it
applies. "Your Year" first shows on 20 December and is left for then. The scam
report reason, the warning before a suspension, and keeping hidden and
suspended people off leaderboards and lists are left for people to find.

### Promotional text (iOS only, 170 characters)

App Store Connect's promotional text sits above the description and, unlike the
description, **can be changed without shipping a build**. That is what it is
for: it carries the newest thing while the build that introduced it is still
the current one. Play has no equivalent field. For 2.9 that is calls; it
replaces 2.8's Pro text.

| Language            | Promotional text                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| English             | Voice and video calls are here. Call the people you practice with right from the chat, free for everyone. A call rings like a real phone call.         |
| Türkçe              | Sesli ve görüntülü arama geldi. Birlikte pratik yaptığın kişileri doğrudan sohbetten ara, herkese ücretsiz. Arama gerçek bir telefon gibi çalar.       |
| Español             | Llegan las llamadas de voz y las videollamadas. Llama a quien practica contigo desde el chat, gratis para todos. Suenan como una llamada de teléfono.  |
| Русский             | Аудио- и видеозвонки уже здесь. Звони тем, с кем практикуешься, прямо из чата, бесплатно для всех. Звонок приходит как обычный телефонный.             |
| العربية             | المكالمات الصوتية ومكالمات الفيديو وصلت. اتصل بمن تتدرّب معهم من داخل الدردشة، مجانًا للجميع. ترنّ المكالمة مثل مكالمة هاتفية حقيقية.                  |
| Français            | Les appels vocaux et vidéo sont là. Appelez vos partenaires de pratique depuis la discussion, gratuitement. Ça sonne comme un vrai appel.              |
| Deutsch             | Sprach- und Videoanrufe sind da. Ruf deine Übungspartner direkt aus dem Chat an, kostenlos für alle. Es klingelt wie ein echter Telefonanruf.          |
| Português do Brasil | Chegaram as chamadas de voz e de vídeo. Ligue para quem pratica com você direto da conversa, grátis para todo mundo. Toca como uma ligação de verdade. |

### Release notes

**English**

> Call your practice partners: voice and video calls, right from the chat. Tap the call button at the top of a conversation.
> A call rings like a phone call, even when the app is closed. Free for everyone.
> Rather not be called? Switch off Allow calls.
> New chat camera: tap for a photo, hold for a video. Send it as View once, or let them replay it once.
> Write a review on the profile of someone you practice with.
> Hidden mode: stay out of sight of new people. Everything with the people you already talk to stays the same.
> Only people I talk to can write: nobody new can send you a first message.
> Chats you've read but not answered show a reply arrow.
>
> Coming back from the old app? Sign up with the email you used before - your username is waiting for you.

**Türkçe**

> Pratik arkadaşlarını ara: sesli ve görüntülü arama artık sohbetin içinde. Sohbetin üstündeki arama düğmesine dokun.
> Arama, uygulama kapalıyken bile telefon araması gibi çalar. Herkese ücretsiz.
> Aranmak istemiyor musun? Aramalara izin ver ayarını kapat.
> Yeni sohbet kamerası: fotoğraf için dokun, video için basılı tut. Bir kez görüntüle olarak gönder ya da bir kez daha oynatılmasına izin ver.
> Birlikte pratik yaptığın birinin profiline yorum yaz.
> Gizli mod: yeni insanlara görünmez ol. Konuştuğun kişilerle her şey aynı kalır.
> Sadece konuştuklarım yazabilsin: yeni biri sana ilk mesajı gönderemez.
> Okuyup cevaplamadığın sohbetlerde artık bir cevap oku görünüyor.
>
> Eski uygulamadan mı dönüyorsun? Daha önce kullandığın e-postayla kaydol - kullanıcı adın seni bekliyor.

**Español**

> Llama a tus compañeros de práctica: llamadas de voz y videollamadas desde el propio chat. Toca el botón de llamada en la parte superior de una conversación.
> La llamada suena como una de teléfono, incluso con la app cerrada. Gratis para todos.
> ¿Prefieres que no te llamen? Desactiva Permitir llamadas.
> Nueva cámara del chat: toca para foto, mantén para vídeo. Envíalo como Ver una vez o deja que lo vuelvan a ver una vez.
> Escribe una reseña en el perfil de alguien con quien practicas.
> Modo oculto: que la gente nueva no te vea. Con quienes ya hablas, todo sigue igual.
> Solo pueden escribirme mis contactos de chat: nadie nuevo puede enviarte un primer mensaje.
> Los chats que has leído y no has contestado muestran una flecha de respuesta.
>
> ¿Vuelves de la app anterior? Regístrate con el correo que usabas antes - tu nombre de usuario te está esperando.

**Русский**

> Звони партнёрам по практике: аудио- и видеозвонки прямо из чата. Нажми кнопку звонка вверху переписки.
> Звонок приходит как обычный телефонный, даже если приложение закрыто. Бесплатно для всех.
> Не хочешь, чтобы тебе звонили? Выключи «Разрешить звонки».
> Новая камера в чате: нажми - фото, удерживай - видео. Отправь с пометкой «Один просмотр» или разреши пересмотреть один раз.
> Напиши отзыв в профиле человека, с которым практикуешься.
> Скрытый режим: новые люди тебя не видят, а с теми, с кем ты уже общаешься, всё по-прежнему.
> «Писать могут только мои собеседники»: никто новый не сможет написать тебе первым.
> У прочитанных, но неотвеченных чатов теперь есть стрелка ответа.
>
> Возвращаешься из старого приложения? Зарегистрируйся с той же почтой - твоё имя пользователя ждёт тебя.

**العربية**

> اتصل بشركائك في التدريب: مكالمات صوتية ومكالمات فيديو من داخل الدردشة مباشرةً. اضغط زر الاتصال أعلى المحادثة.
> ترنّ المكالمة مثل مكالمة هاتفية، حتى عندما يكون التطبيق مغلقًا. مجانًا للجميع.
> لا تريد أن يتصل بك أحد؟ أوقف «السماح بالمكالمات».
> كاميرا جديدة في الدردشة: اضغط لصورة، واضغط مطولًا لفيديو. أرسلها «عرض مرة واحدة» أو اسمح بإعادة تشغيلها مرة واحدة.
> اكتب مراجعة على ملف شخص تتدرّب معه.
> الوضع المخفي: لن يراك الأشخاص الجدد، ويبقى كل شيء كما هو مع من تتحدث معهم.
> «يراسلني فقط من أتحدث معهم»: لا يستطيع أي شخص جديد أن يرسل إليك أول رسالة.
> تظهر الآن علامة رد بجانب المحادثات التي قرأتها ولم ترد عليها.
>
> عائد من التطبيق القديم؟ سجّل بالبريد الإلكتروني الذي استخدمته من قبل - اسم المستخدم الخاص بك في انتظارك.

**Français**

> Appelez vos partenaires de pratique : appels vocaux et vidéo, directement depuis la discussion. Touchez le bouton d'appel en haut d'une conversation.
> L'appel sonne comme un appel téléphonique, même quand l'app est fermée. Gratuit pour tous.
> Vous préférez ne pas être appelé ? Désactivez Autoriser les appels.
> Nouvelle caméra dans la discussion : touchez pour une photo, maintenez pour une vidéo. Envoyez-la en Voir une fois, ou autorisez à la revoir une fois.
> Écrivez un avis sur le profil de quelqu'un avec qui vous pratiquez.
> Mode discret : les nouvelles personnes ne vous voient plus. Rien ne change avec celles à qui vous parlez déjà.
> Seuls mes contacts peuvent m'écrire : personne de nouveau ne peut vous envoyer un premier message.
> Une flèche de réponse signale les discussions lues restées sans réponse.
>
> Vous revenez de l'ancienne app ? Inscrivez-vous avec l'e-mail utilisé auparavant - votre nom d'utilisateur vous attend.

**Deutsch**

> Ruf deine Übungspartner an: Sprach- und Videoanrufe direkt aus dem Chat. Tippe oben in einer Unterhaltung auf den Anruf-Button.
> Ein Anruf klingelt wie ein Telefonanruf, auch wenn die App geschlossen ist. Kostenlos für alle.
> Lieber nicht angerufen werden? Schalte „Anrufe erlauben“ aus.
> Neue Chat-Kamera: Tippen für Foto, halten für Video. Schick es als „Einmal ansehen“ oder erlaube einmaliges Wiederholen.
> Schreib eine Bewertung auf das Profil von jemandem, mit dem du übst.
> Versteckter Modus: Neue Leute sehen dich nicht mehr. Mit deinen Chatpartnern bleibt alles wie gehabt.
> „Nur meine Chatpartner können schreiben“: Niemand Neues kann dir eine erste Nachricht schicken.
> Gelesene, aber unbeantwortete Chats zeigen jetzt einen Antwortpfeil.
>
> Kommst du von der alten App? Registriere dich mit der E-Mail, die du vorher genutzt hast - dein Benutzername wartet auf dich.

**Português do Brasil**

> Ligue para seus parceiros de prática: chamadas de voz e de vídeo direto da conversa. Toque no botão de chamada no topo da conversa.
> A chamada toca como uma ligação normal, mesmo com o app fechado. Grátis para todo mundo.
> Prefere não receber chamadas? Desative Permitir chamadas.
> Nova câmera na conversa: toque para foto, segure para vídeo. Envie como Ver uma vez ou permita rever uma vez.
> Escreva uma avaliação no perfil de alguém com quem você pratica.
> Modo oculto: pessoas novas deixam de te ver. Com quem você já conversa, nada muda.
> Só meus contatos podem me escrever: ninguém novo pode te mandar a primeira mensagem.
> Conversas lidas e ainda sem resposta agora mostram uma seta de resposta.
>
> Voltando do app antigo? Cadastre-se com o e-mail que você usava antes - seu nome de usuário está esperando por você.

### Play release notes (500 characters)

Play's "What's new" field caps at **500 characters per language**, and Play
truncates silently. Calls take the first line, then the camera, reviews and
hidden mode, and the returning-user line stays last; Allow calls, Only people I
talk to can write and the reply arrow were dropped to fit. Play has **no
Russian or Arabic listing**, so there are no notes for either.

**English**

> Voice and video calls are here: call your practice partners right from the chat. A call rings like a phone call, even when the app is closed. Free for everyone.
> New chat camera: send a photo or a video as View once.
> Write a review on the profile of someone you practice with.
> Hidden mode keeps you out of sight of new people.
>
> Coming back from the old app? Sign up with the email you used before - your username is waiting for you.

**Türkçe**

> Sesli ve görüntülü arama geldi: pratik arkadaşlarını doğrudan sohbetten ara. Arama, uygulama kapalıyken bile telefon gibi çalar. Herkese ücretsiz.
> Yeni sohbet kamerası: fotoğraf ya da videoyu Bir kez görüntüle olarak gönder.
> Birlikte pratik yaptığın birinin profiline yorum yaz.
> Gizli mod seni yeni insanlara görünmez yapar.
>
> Eski uygulamadan mı dönüyorsun? Daha önce kullandığın e-postayla kaydol - kullanıcı adın seni bekliyor.

**Español**

> Llegan las llamadas de voz y las videollamadas: llama a tus compañeros desde el chat. Suenan como una llamada de teléfono, incluso con la app cerrada. Gratis para todos.
> Nueva cámara del chat: envía una foto o un vídeo como Ver una vez.
> Escribe una reseña en el perfil de alguien con quien practicas.
> El modo oculto hace que la gente nueva no te vea.
>
> ¿Vuelves de la app anterior? Regístrate con el correo que usabas antes - tu nombre de usuario te está esperando.

**Français**

> Les appels vocaux et vidéo arrivent : appelez vos partenaires depuis la discussion. Ça sonne comme un vrai appel, même app fermée. Gratuit pour tous.
> Nouvelle caméra : envoyez une photo ou une vidéo en Voir une fois.
> Écrivez un avis sur le profil de quelqu'un avec qui vous pratiquez.
> Le mode discret vous cache des nouvelles personnes.
>
> Vous revenez de l'ancienne app ? Inscrivez-vous avec l'e-mail utilisé auparavant - votre nom d'utilisateur vous attend.

**Deutsch**

> Sprach- und Videoanrufe sind da: Ruf deine Übungspartner direkt aus dem Chat an. Es klingelt wie ein Telefonanruf, auch bei geschlossener App. Kostenlos für alle.
> Neue Chat-Kamera: Schick ein Foto oder Video als „Einmal ansehen“.
> Schreib eine Bewertung auf das Profil deiner Übungspartner.
> Der versteckte Modus macht dich für neue Leute unsichtbar.
>
> Kommst du von der alten App? Registriere dich mit der E-Mail, die du vorher genutzt hast - dein Benutzername wartet auf dich.

**Português do Brasil**

> Chegaram as chamadas de voz e de vídeo: ligue para seus parceiros direto da conversa. Toca como uma ligação normal, mesmo com o app fechado. Grátis para todo mundo.
> Nova câmera: envie uma foto ou um vídeo como Ver uma vez.
> Escreva uma avaliação no perfil de quem pratica com você.
> O modo oculto te esconde de pessoas novas.
>
> Voltando do app antigo? Cadastre-se com o e-mail que você usava antes - seu nome de usuário está esperando por você.
