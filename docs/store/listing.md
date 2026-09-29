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

`docs/store/2.8-metadata.json` is this file's 2.8 text in plain form — no
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

These are **2.8's** notes. 2.8 is the Feed's release, and the build that
carries the one paid plan to the phones.

**Pro comes first.** One plan with everything (#1658), a free first week,
the "You're Pro" celebration with a PRO badge on the profile, gift codes on the
Plans screen, polls from @langx (#1655) and a monthly recap in the Me tab
(#1657). The build that replaces the one in review is the first to carry any of
it, so the notes lead with it. Nothing names a price — the store shows its own —
and nothing says "unlimited" about translation.

**Then the Feed**, as before: one timeline ordered for the reader (#1632,
#1622), moments — a photo, a video or a sentence — with Correction needed and
Pronunciation needed as optional asks on any post (#1626, #1629), replies to
comments (#1623, #1636), and an Echo card posted to the Feed with Pronunciation
needed already ticked. Around it sits the chat work merged since 2.7: any emoji
as a reaction (#1625), search within a conversation (#1624), send later
(#1627), forwarding (#1628), sharing a location (#1633), tapping a word to
translate it (#1614), conversation starters (#1621) and Show text on voice notes
(#1631). A profile shows the other person's local time (#1648). Arabic and
Russian counts read correctly on the phones, which had no plural rules of their
own (#1634). On Android the white page after signing up is gone (#1641, #1645)
and changing the system font size no longer resets the app (#1647).

A version update needs release notes in **every** localization, not just the
primary one — App Store Connect will not let the version be submitted with one
missing.

The last line is not optional in any language. Every v1 user has to sign up
again — the old password hashes could not be migrated — and without that
sentence the first thing a returning user meets is a login that rejects them.

**The Android fixes are not claimed anywhere now.** They were Play's alone —
the white page and the font-size reset never happened on iOS — and Play's 500
characters went to Pro.

**Not claimed, deliberately.** The smaller chat changes — formatting and
spoilers, muting, the "New messages" line, the voice-note waveform and speed,
Latin letters for a message — are left for people to find; listing all of them
would bury the Feed. The map preview in a location bubble (#1638) needs a
Google Maps key on Android, so "share where you are" is claimed and the map is
not. Copilot is on the Pro list in the app as "coming soon" and is not in any
store text.

### Promotional text (iOS only, 170 characters)

App Store Connect's promotional text sits above the description and, unlike the
description, **can be changed without shipping a build**. That is what it is
for: it carries the newest thing while the build that introduced it is still
the current one. Play has no equivalent field. For 2.8 that is Pro; the Feed
text it replaces was the one entered while the first 2.8 build was in review.

| Language            | Promotional text                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English             | One plan, everything in it: LangX Pro. Unlimited new chats, gender and city filters, who viewed you and more. Your first week is free.                                |
| Türkçe              | Tek plan, içinde her şey: LangX Pro. Sınırsız yeni sohbet, cinsiyet ve şehir filtreleri, profiline kimlerin baktığı ve fazlası. İlk haftan ücretsiz.                  |
| Español             | Un solo plan con todo: LangX Pro. Chats nuevos ilimitados, filtros por género y ciudad, quién ha visto tu perfil y más. Tu primera semana es gratis.                  |
| Русский             | Один тариф, и в нём всё: LangX Pro. Безлимитные новые чаты, фильтры по полу и городу, кто заходил в твой профиль и не только. Первая неделя бесплатно.                |
| العربية             | خطة واحدة فيها كل شيء: LangX Pro. محادثات جديدة بلا حدود، وفلاتر حسب الجنس والمدينة، ومعرفة من زار ملفك، والمزيد. أسبوعك الأول مجاني.                                 |
| Français            | Une seule formule avec tout : LangX Pro. Nouvelles conversations illimitées, filtres par genre et ville, visiteurs de votre profil et plus. Première semaine offerte. |
| Deutsch             | Ein Tarif mit allem: LangX Pro. Unbegrenzt neue Chats, Filter nach Geschlecht und Stadt, wer dein Profil besucht hat und mehr. Die erste Woche ist gratis.            |
| Português do Brasil | Um plano só, com tudo: LangX Pro. Conversas novas ilimitadas, filtros por gênero e cidade, quem visitou seu perfil e mais. A primeira semana é grátis.                |

### Release notes

**English**

> One plan now: LangX Pro, with everything in it. Monthly or yearly, your first week is free.
> Going Pro comes with a little celebration, and a PRO badge on your profile.
> Have a gift code? Enter it on the Plans screen and Pro is on us.
> @langx can send you quick polls now - one tap to answer.
> In the first week of each month, your recap of the month before waits in the Me tab, ready to share.
>
> The Feed is now one timeline, ordered for you. Share a moment from your day: a photo, a video or a sentence.
> Want help with a post? Tick Correction needed or Pronunciation needed - only if you want to.
> You can reply to a comment now.
> In Echo, post a card to the Feed - Pronunciation needed is ticked for you.
> Someone's local time shows on their profile.
> In chats, react with any emoji, search a conversation, send a message later, forward it or share where you are.
> Tap a word in a message to translate it and keep it in Echo.
> Voice notes have Show text, so you can read what was said.
> Not sure what to say? Tap a conversation starter.
> Counts in Arabic and Russian read correctly now.
>
> Coming back from the old app? Sign up with the email you used before - your username is waiting for you.

**Türkçe**

> Artık tek plan var: her şeyi içeren LangX Pro. Aylık ya da yıllık, ilk haftan ücretsiz.
> Pro olduğunda seni küçük bir kutlama ve profilinde bir PRO rozeti karşılıyor.
> Hediye kodun mu var? Planlar ekranında gir, Pro bizden.
> @langx artık sana kısa anketler gönderebiliyor - cevaplamak tek dokunuş.
> Her ayın ilk haftasında geçen ayın özeti Ben sekmesinde seni bekliyor, paylaşmaya hazır.
>
> Akış artık tek bir liste ve sana göre sıralanıyor. Gününden bir an paylaş: bir fotoğraf, bir video ya da bir cümle.
> Gönderinde yardım mı istiyorsun? Düzeltme gerekli ya da Telaffuz gerekli'yi işaretle - sadece istersen.
> Artık bir yoruma cevap verebilirsin.
> Echo'da bir kartı Akış'a gönder - Telaffuz gerekli senin için işaretli gelir.
> Birinin yerel saati artık profilinde görünüyor.
> Sohbetlerde istediğin emojiyle tepki ver, sohbette ara, mesajı sonra gönder, ilet ya da konumunu paylaş.
> Bir mesajdaki kelimeye dokun, çevirisini gör ve Echo'ya ekle.
> Sesli mesajlarda Metni göster var; söyleneni okuyabilirsin.
> Ne diyeceğini bilemedin mi? Bir sohbet başlatıcıya dokun.
> Arapça ve Rusçada sayılı ifadeler artık doğru yazılıyor.
>
> Eski uygulamadan mı dönüyorsun? Daha önce kullandığın e-postayla kaydol - kullanıcı adın seni bekliyor.

**Español**

> Ahora hay un solo plan: LangX Pro, con todo incluido. Mensual o anual, tu primera semana es gratis.
> Hacerte Pro viene con una pequeña celebración y una insignia PRO en tu perfil.
> ¿Tienes un código de regalo? Introdúcelo en la pantalla Planes y el Pro corre de nuestra cuenta.
> @langx ya puede enviarte encuestas rápidas: respondes con un toque.
> En la primera semana de cada mes, el resumen del mes anterior te espera en la pestaña Yo, listo para compartir.
>
> El Muro es ahora una sola línea de tiempo, ordenada para ti. Comparte un momento de tu día: una foto, un video o una frase.
> ¿Quieres ayuda con una publicación? Marca Necesito corrección o Necesito pronunciación - solo si quieres.
> Ya puedes responder a un comentario.
> En Echo, publica una tarjeta en el Muro - Necesito pronunciación ya viene marcado.
> La hora local de cada persona aparece en su perfil.
> En los chats, reacciona con cualquier emoji, busca en una conversación, envía un mensaje más tarde, reenvíalo o comparte dónde estás.
> Toca una palabra de un mensaje para traducirla y guardarla en Echo.
> Los mensajes de voz tienen Mostrar texto, para leer lo que se dijo.
> ¿No sabes qué decir? Toca un tema para conversar.
> Las cantidades en árabe y ruso ahora se escriben bien.
>
> ¿Vuelves de la app anterior? Regístrate con el correo que usabas antes - tu nombre de usuario te está esperando.

**Русский**

> Теперь тариф один: LangX Pro, и в нём всё. Месячный или годовой - первая неделя бесплатно.
> Переход на Pro встречает маленький праздник, а в профиле появляется значок PRO.
> Есть подарочный код? Введи его на экране «Тарифы» - Pro за наш счёт.
> @langx теперь может присылать короткие опросы: чтобы ответить, достаточно одного касания.
> В первую неделю каждого месяца на вкладке «Я» тебя ждут итоги прошлого месяца - ими можно поделиться.
>
> Лента теперь единая и собрана для тебя. Делись моментами своего дня: фото, видео или фразой.
> Нужна помощь с постом? Отметь «Нужно исправление» или «Нужно произношение» - только если хочешь.
> Теперь можно ответить на комментарий.
> В Эхо опубликуй карточку в Ленте - «Нужно произношение» уже отмечено.
> Местное время человека видно в его профиле.
> В чатах: реагируй любым эмодзи, ищи по переписке, отправляй сообщение позже, пересылай его или делись местоположением.
> Нажми на слово в сообщении, чтобы перевести его и сохранить в Эхо.
> У голосовых сообщений есть «Показать текст» - можно прочитать, что было сказано.
> Не знаешь, что сказать? Нажми на тему для разговора.
> В арабском и русском теперь правильные формы слов после чисел.
>
> Возвращаешься из старого приложения? Зарегистрируйся с той же почтой - твоё имя пользователя ждёт тебя.

**العربية**

> أصبحت هناك خطة واحدة: LangX Pro، وفيها كل شيء. شهريًا أو سنويًا، أسبوعك الأول مجاني.
> الانضمام إلى Pro يأتي مع احتفال صغير وشارة PRO على ملفك.
> لديك رمز هدية؟ أدخله في شاشة الخطط، وPro علينا.
> يمكن لـ @langx الآن أن يرسل إليك استطلاعات سريعة، والإجابة بلمسة واحدة.
> في الأسبوع الأول من كل شهر، ينتظرك ملخص الشهر الماضي في تبويب "أنا"، جاهزًا للمشاركة.
>
> أصبحت الأخبار خطًا زمنيًا واحدًا مرتبًا لك. شارك لحظة من يومك: صورة أو فيديو أو جملة.
> تريد مساعدة في منشور؟ اختر "أحتاج إلى تصحيح" أو "أحتاج إلى النطق" - فقط إن أردت.
> يمكنك الآن الرد على تعليق.
> في صدى، انشر بطاقة في الأخبار - وسيكون "أحتاج إلى النطق" محددًا لك.
> يظهر الوقت المحلي للشخص في ملفه الشخصي.
> في المحادثات: تفاعل بأي رمز تعبيري، وابحث داخل المحادثة، وأرسل رسالة لاحقًا، وأعد توجيهها أو شارك موقعك.
> اضغط على كلمة في رسالة لترجمتها وحفظها في صدى.
> في الرسائل الصوتية زر "إظهار النص" لتقرأ ما قيل.
> لا تعرف ماذا تقول؟ اضغط على فكرة للحديث.
> صيغ الأعداد بالعربية والروسية صحيحة الآن.
>
> عائد من التطبيق القديم؟ سجّل بالبريد الإلكتروني الذي استخدمته من قبل - اسم المستخدم الخاص بك في انتظارك.

**Français**

> Une seule formule désormais : LangX Pro, avec tout dedans. Mensuelle ou annuelle, votre première semaine est offerte.
> Passer Pro, c'est une petite fête à l'écran et un badge PRO sur votre profil.
> Vous avez un code cadeau ? Saisissez-le sur l'écran Formules : le Pro est pour nous.
> @langx peut maintenant vous envoyer de petits sondages - une touche suffit pour répondre.
> La première semaine de chaque mois, le bilan du mois précédent vous attend dans l'onglet Moi, prêt à être partagé.
>
> Le Fil est maintenant une seule chronologie, triée pour vous. Partagez un moment de votre journée : une photo, une vidéo ou une phrase.
> Besoin d'aide sur une publication ? Cochez Besoin d'une correction ou Besoin de la prononciation - seulement si vous voulez.
> Vous pouvez maintenant répondre à un commentaire.
> Dans Echo, publiez une carte dans le Fil - Besoin de la prononciation est déjà coché.
> L'heure locale de chacun s'affiche sur son profil.
> Dans les conversations, réagissez avec n'importe quel emoji, cherchez dans une conversation, envoyez un message plus tard, transférez-le ou partagez où vous êtes.
> Touchez un mot dans un message pour le traduire et le garder dans Echo.
> Les messages vocaux ont Afficher le texte, pour lire ce qui a été dit.
> Vous ne savez pas quoi dire ? Touchez une idée de conversation.
> Les quantités en arabe et en russe s'écrivent maintenant correctement.
>
> Vous revenez de l'ancienne app ? Inscrivez-vous avec l'e-mail utilisé auparavant - votre nom d'utilisateur vous attend.

**Deutsch**

> Jetzt gibt es einen Tarif: LangX Pro, mit allem drin. Monatlich oder jährlich - deine erste Woche ist gratis.
> Wer Pro wird, bekommt eine kleine Feier und ein PRO-Abzeichen im Profil.
> Du hast einen Geschenkcode? Gib ihn im Bildschirm „Tarife“ ein - Pro geht auf uns.
> @langx kann dir jetzt kurze Umfragen schicken - antworten mit einem Tipp.
> In der ersten Woche jedes Monats wartet im Tab „Ich“ dein Rückblick auf den Vormonat, bereit zum Teilen.
>
> Der Feed ist jetzt eine einzige Timeline, für dich sortiert. Teile einen Moment aus deinem Tag: ein Foto, ein Video oder einen Satz.
> Hilfe bei einem Beitrag? Hake Korrektur gewünscht oder Aussprache gewünscht an - nur wenn du willst.
> Du kannst jetzt auf einen Kommentar antworten.
> Poste in Echo eine Karte in den Feed - Aussprache gewünscht ist schon angehakt.
> Die Ortszeit einer Person steht in ihrem Profil.
> In Chats reagierst du mit jedem Emoji, suchst in einer Unterhaltung, sendest eine Nachricht später, leitest sie weiter oder teilst, wo du bist.
> Tippe auf ein Wort in einer Nachricht, um es zu übersetzen und in Echo zu behalten.
> Sprachnachrichten haben Text anzeigen, damit du lesen kannst, was gesagt wurde.
> Keine Idee, was du sagen sollst? Tippe auf eine Gesprächsidee.
> Mengenangaben auf Arabisch und Russisch stimmen jetzt.
>
> Kommst du von der alten App? Registriere dich mit der E-Mail, die du vorher genutzt hast - dein Benutzername wartet auf dich.

**Português do Brasil**

> Agora é um plano só: o LangX Pro, com tudo dentro. Mensal ou anual, sua primeira semana é grátis.
> Virar Pro vem com uma pequena comemoração e um selo PRO no seu perfil.
> Tem um código de presente? Digite na tela Planos e o Pro fica por nossa conta.
> O @langx agora pode mandar enquetes rápidas - é só um toque para responder.
> Na primeira semana de cada mês, o resumo do mês anterior espera por você na aba Eu, pronto para compartilhar.
>
> O Feed agora é uma linha do tempo só, organizada para você. Compartilhe um momento do seu dia: uma foto, um vídeo ou uma frase.
> Quer ajuda com um post? Marque Preciso de correção ou Preciso da pronúncia - só se quiser.
> Agora você pode responder a um comentário.
> No Echo, publique um cartão no Feed - Preciso da pronúncia já vem marcado.
> O horário local de cada pessoa aparece no perfil dela.
> Nas conversas, reaja com qualquer emoji, pesquise numa conversa, envie uma mensagem mais tarde, encaminhe ou compartilhe onde você está.
> Toque numa palavra de uma mensagem para traduzir e guardar no Echo.
> As mensagens de voz têm Mostrar texto, para ler o que foi dito.
> Sem saber o que dizer? Toque numa ideia de conversa.
> As quantidades em árabe e russo agora aparecem do jeito certo.
>
> Voltando do app antigo? Cadastre-se com o e-mail que você usava antes - seu nome de usuário está esperando por você.

### Play release notes (500 characters)

Play's "What's new" field caps at **500 characters per language**, and Play
truncates silently. Pro takes the top three lines, the Feed keeps one, and the
returning-user line stays last; the Android fixes, the asks, comment replies,
the Echo card and local time were dropped to fit. Play has **no Russian or
Arabic listing**, so there are no notes for either.

**English**

> One plan now: LangX Pro, with everything in it. Your first week is free.
> Going Pro comes with a celebration and a PRO badge. Have a gift code? Enter it on the Plans screen.
> New: polls from @langx, and a monthly recap you can share.
> The Feed is one timeline now: share a photo, a video or a sentence, and ask for a correction only if you want.
>
> Coming back from the old app? Sign up with the email you used before - your username is waiting for you.

**Türkçe**

> Artık tek plan var: her şeyi içeren LangX Pro. İlk haftan ücretsiz.
> Pro olunca seni bir kutlama ve PRO rozeti bekliyor. Hediye kodun mu var? Planlar ekranında gir.
> Yeni: @langx'ten anketler ve paylaşabileceğin aylık özet.
> Akış artık tek bir liste: bir fotoğraf, video ya da cümle paylaş; istersen düzeltme iste.
>
> Eski uygulamadan mı dönüyorsun? Daha önce kullandığın e-postayla kaydol - kullanıcı adın seni bekliyor.

**Español**

> Ahora hay un solo plan: LangX Pro, con todo incluido. Tu primera semana es gratis.
> Hacerte Pro trae una celebración y una insignia PRO. ¿Tienes un código de regalo? Introdúcelo en Planes.
> Novedad: encuestas de @langx y un resumen mensual para compartir.
> El Muro es una sola línea de tiempo: comparte una foto, un video o una frase, y pide corrección solo si quieres.
>
> ¿Vuelves de la app anterior? Regístrate con el correo que usabas antes - tu nombre de usuario te está esperando.

**Français**

> Une seule formule désormais : LangX Pro, avec tout dedans. La première semaine est offerte.
> Passer Pro, c'est une petite fête et un badge PRO. Un code cadeau ? Saisissez-le dans Formules.
> Nouveau : des sondages de @langx et un bilan mensuel à partager.
> Le Fil est une seule chronologie : partagez photo, vidéo ou phrase, et demandez une correction si besoin.
>
> Vous revenez de l'ancienne app ? Inscrivez-vous avec l'e-mail utilisé auparavant - votre nom d'utilisateur vous attend.

**Deutsch**

> Jetzt gibt es einen Tarif: LangX Pro, mit allem drin. Die erste Woche ist gratis.
> Wer Pro wird, bekommt eine kleine Feier und ein PRO-Abzeichen. Geschenkcode? Gib ihn unter „Tarife“ ein.
> Neu: Umfragen von @langx und ein Monatsrückblick zum Teilen.
> Der Feed ist eine Timeline: Teile ein Foto, ein Video oder einen Satz und bitte um Korrektur, wenn du willst.
>
> Kommst du von der alten App? Registriere dich mit der E-Mail, die du vorher genutzt hast - dein Benutzername wartet auf dich.

**Português do Brasil**

> Agora é um plano só: o LangX Pro, com tudo dentro. A primeira semana é grátis.
> Virar Pro vem com uma comemoração e um selo PRO. Tem um código de presente? Digite em Planos.
> Novidade: enquetes do @langx e um resumo do mês para compartilhar.
> O Feed é uma linha do tempo só: compartilhe uma foto, um vídeo ou uma frase e peça correção quando quiser.
>
> Voltando do app antigo? Cadastre-se com o e-mail que você usava antes - seu nome de usuário está esperando por você.
