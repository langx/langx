# App Store growth: keywords, custom product pages, PPO

What the App Store listing does beyond the copy in [`listing.md`](listing.md):
the 2.9 keyword field, four custom product pages, one Product Page
Optimization test and the default screenshot order. The keyword strings
themselves live in [`2.9-metadata.json`](2.9-metadata.json) (`asc.<locale>.keywords`)
and in each language's section of `listing.md`; this file is the reasoning and
the page set-up. Apple only, written for 2.9 (6 October 2026). Play has no
keyword field and no equivalent of either page feature.

## The keyword field

2.8 carried the same ten concepts in every language, and three of them were
wasted: _language_, _exchange_ and _practice_ (and their translations) are in
the name or the subtitle, which the App Store indexes already and combines with
the keyword field on its own — "language" from the name plus "partner" from the
keywords still matches _language partner_. 2.9 drops them and spends the room on
the calls release (call, video, conversation) and on the words learners use when
they look for a person rather than a course (pen pal, foreigners, friends).

Rules every string follows:

- At most 100 characters, comma-separated with no spaces. All are counted by
  script, not by eye, and kept between 94 and 98.
- No word that is already in that language's name or subtitle.
- One form per word: no plural next to its singular. German keeps the plural
  _Sprachen_ because _Sprachen lernen_ is how Germans search.
- No competitor brands. _Tandem_ stays as the generic word for a language
  tandem, which is what it means in every one of these languages.
- No filler (_app_, _free_).
- German search does not split compounds, so a compound that people type is
  added whole (_Sprachpartner_, _Brieffreund_); _Partner_ on its own would not
  match either.
- Target languages are picked per market, not copied: Spain gets French and
  German, Brazil Japanese and Korean, the Arabic listing Korean and Turkish.

| Locale | 2.9 keywords                                                                                         | Chars | Why                                                                                                                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| en-US  | `language,exchange,speaking,conversation,call,video,tandem,partner,english,spanish,chat,japanese`    |    95 | The live en-US name and subtitle are "LangX                                                                                                                                                                                               | Practice Learn Succeed" / "Open Source Tandem Alternative", not the title in listing.md, so language and exchange are not indexed from them and stay; learn and practice are in the name. tandem stays so the partner page can own it. 2.9 calls words (call, video, conversation) and Japanese fill the rest. |
| tr     | `konuşma,arama,görüntülü,sesli,arkadaş,yabancı,ingilizce,ispanyolca,sohbet,öğren,almanca,korece`     |    94 | Turkish searchers say 'yabancı arkadaş' and 'görüntülü/sesli arama', not 'tandem' or 'partner'; dil/değişim/pratik are already in the name and subtitle, and German and Korean are the next most-learned languages after English.         |
| es-ES  | `hablar,conversación,llamada,videollamada,tándem,amigos,inglés,español,aprender,chat,francés,alemán` |    98 | intercambio/idiomas/practica are in the name and subtitle; the space goes to videollamada/llamada/conversación, and French and German, which outrank Japanese and Korean among learners in Spain.                                         |
| ru     | `разговорный,звонок,тандем,общение,иностранцы,английский,испанский,язык,учить,немецкий,корейский`    |    95 | обмен/практика are in the name and subtitle; 'разговорный' and 'общение с иностранцами' are how Russian learners phrase it, and German and Korean are the next targets after English and Spanish.                                         |
| ar-SA  | `محادثة,مكالمة,فيديو,صوتية,شريك,أصدقاء,أجانب,انجليزي,اسباني,تعلم,لغة,دردشة,فرنسي,ألماني,كوري,تركي`   |    96 | تبادل and تدرّب are in the name and subtitle; Arabic searchers type 'انجليزي' without the hamza and ask to talk with 'أجانب', and Korean and Turkish are unusually popular targets in the region.                                         |
| fr-FR  | `parler,conversation,appel,tandem,correspondant,anglais,espagnol,langue,apprendre,japonais,coréen`   |    96 | échange/pratiquez are in the name and subtitle; 'correspondant' is the French pen-pal word, and Japanese and Korean carry the most app-search interest after English and Spanish.                                                         |
| de-DE  | `sprechen,Anruf,Tandem,Sprachpartner,Brieffreund,Englisch,Spanisch,Sprachen,lernen,Französisch,Chat` |    98 | German search does not split compounds, so the partner intent needs 'Sprachpartner' and 'Brieffreund' as whole words; 'Sprachen lernen' is the dominant phrasing, and French is the next most-learned language after English and Spanish. |
| pt-BR  | `falar,conversação,ligação,amigos,estrangeiros,inglês,espanhol,aprender,francês,japonês,coreano`     |    94 | intercâmbio/idiomas/pratique are in the name and subtitle; Brazilians search 'conversar com estrangeiros' and 'ligação', and Japanese and Korean are big targets in Brazil.                                                               |

Each string is ordered by owner: the calls page's words first, then the partner
page's, then English, Spanish, and last the words no page claims. Order inside
the field does not affect ranking; it only makes the split below auditable.

### What 2.8 had that 2.9 drops

Every 2.8 word that is not in 2.9, and why. Most are the name-and-subtitle
duplicates; the rest lost their place to a word the same searchers type more.

| Locale | Dropped       | Why                                                                                                                        |
| ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| en-US  | `practice`    | already in the live en-US name ("LangX \| Practice Learn Succeed"), which is indexed anyway                                |
| en-US  | `learn`       | already in the live en-US name, which is indexed anyway                                                                    |
| tr     | `dil`         | already in the app name, which is indexed anyway                                                                           |
| tr     | `değişim`     | already in the app name, which is indexed anyway                                                                           |
| tr     | `pratik`      | the subtitle already carries this word (or its imperative form), which is indexed anyway                                   |
| tr     | `tandem`      | Turkish searchers rarely type it; "yabancı arkadaş" is how they look for a partner                                         |
| tr     | `partner`     | the query is "dil partneri", which "partner" does not match; arkadaş and yabancı replace it                                |
| es-ES  | `idioma`      | the name has "idiomas"; singular and plural are one word to the index                                                      |
| es-ES  | `intercambio` | already in the app name, which is indexed anyway                                                                           |
| es-ES  | `practicar`   | the subtitle already carries this word (or its imperative form), which is indexed anyway                                   |
| es-ES  | `compañero`   | room went to llamada/videollamada; tándem and amigos carry the partner search, and "intercambio de idiomas" is in the name |
| ru     | `обмен`       | already in the app name, which is indexed anyway                                                                           |
| ru     | `практика`    | the subtitle already carries this word (or its imperative form), which is indexed anyway                                   |
| ru     | `разговор`    | replaced by "разговорный", the form people pair with the language ("разговорный английский")                               |
| ru     | `партнёр`     | room went to иностранцы/общение ("общение с иностранцами" is how Russian learners phrase it)                               |
| ru     | `чат`         | generic and low-intent; the room went to звонок                                                                            |
| ar-SA  | `تبادل`       | already in the app name, which is indexed anyway                                                                           |
| ar-SA  | `تدريب`       | the subtitle already has تدرّب from the same root                                                                          |
| ar-SA  | `تاندم`       | a transliteration Arabic searchers rarely type                                                                             |
| ar-SA  | `إنجليزي`     | respelled انجليزي, without the hamza, the way most people type it                                                          |
| ar-SA  | `إسباني`      | respelled اسباني, without the hamza, the way most people type it                                                           |
| fr-FR  | `échange`     | already in the app name, which is indexed anyway                                                                           |
| fr-FR  | `pratiquer`   | the subtitle already carries this word (or its imperative form), which is indexed anyway                                   |
| fr-FR  | `partenaire`  | "correspondant" is the French word for this search; there was room for only one of them                                    |
| fr-FR  | `chat`        | no room left; the field is at 96 characters                                                                                |
| de-DE  | `Sprache`     | replaced by "Sprachen": "Sprachen lernen" is the German search                                                             |
| de-DE  | `Austausch`   | the name has "Sprachaustausch", which is the query; "Austausch" alone matches nothing a learner types                      |
| de-DE  | `üben`        | the subtitle already carries this word (or its imperative form), which is indexed anyway                                   |
| de-DE  | `Partner`     | German search does not split compounds, so "Partner" never matched "Sprachpartner"; that word replaces it                  |
| pt-BR  | `idioma`      | the name has "Idiomas"; singular and plural are one word to the index                                                      |
| pt-BR  | `intercâmbio` | already in the app name, which is indexed anyway                                                                           |
| pt-BR  | `praticar`    | the subtitle already carries this word (or its imperative form), which is indexed anyway                                   |
| pt-BR  | `tandem`      | Brazilians rarely search it; "conversar com estrangeiros" is the Brazilian phrasing                                        |
| pt-BR  | `parceiro`    | room went to estrangeiros and amigos                                                                                       |
| pt-BR  | `chat`        | no room left without crowding the 100-character limit; the field is at 94                                                  |

## Custom product pages

Four pages, each with its own keywords, promotional text, screenshot order and
deep link. A page whose keyword someone searches can be shown in place of the
default page, so **each keyword belongs to at most one page** — two pages
claiming the same word would compete with each other for the same search. The
broad core (_language_, _exchange_, _learn_, _chat_ and the extra target
languages) is left to the default page: it describes the whole app, not one
angle of it.

Two constraints decide what the operator can enter today:

- **A page's keywords can only be picked from the keyword list of the latest
  approved version.** Until 2.9 is approved that is 2.8's list, so each page
  has two sets: _Now_, exact strings from 2.8's list, and _After 2.9_, from the
  new list, entered once 2.9 is approved (assigning keywords needs no review).
  Both sets are disjoint across pages. _Now_ keeps 2.8's spellings, Arabic
  _إنجليزي_ with the hamza included, because only those strings can be picked.
  2.8's _practice_ goes to the calls page in _Now_; 2.9 drops it, as the
  subtitle already says it.
- **A page's creative assets — its screenshots and promotional text — show
  only on iOS 27 and later.** Older devices see the default page's.

Pages and why each owns its words:

- **Speaking practice and calls** owns speaking, conversation, call and video
  (and 2.8's practice and speaking until 2.9 is approved):
  the searches of someone who can read the language and wants to talk. 2.9's
  calls are the answer, so the `calls` shot leads.
- **Language partner** owns tandem, partner and pen pal (and in each language
  the local words for it — _yabancı arkadaş_, _correspondant_, _Brieffreund_,
  _estrangeiros_, _أجانب_, _иностранцы_). This is the search for a person, and
  Discover is what answers it.
- **Learn English** owns _english_. It is the biggest target language in seven
  of the eight markets, and the one most people searching in their own language
  are trying to learn.
- **Learn Spanish** owns _spanish_. Spanish was kept over Japanese or Korean as
  the fourth page because it is the second most-learned language overall, it
  is the most-learned one among English speakers, and it reads as a sensible
  target in every locale — Japanese and Korean are strong in some markets and
  absent from the keyword field in others (Spain, Germany). In the Spanish
  localization the page speaks to the other side of the exchange: someone who
  already speaks Spanish and is wanted by people learning it.

### Keywords

**Speaking practice and calls** — Speaking practice, voice and video calls

| Locale | Now (2.8 list)      | After 2.9 is approved                      |
| ------ | ------------------- | ------------------------------------------ |
| en-US  | `practice,speaking` | `speaking,conversation,call,video`         |
| tr     | `pratik,konuşma`    | `konuşma,arama,görüntülü,sesli`            |
| es-ES  | `practicar,hablar`  | `hablar,conversación,llamada,videollamada` |
| ru     | `практика,разговор` | `разговорный,звонок`                       |
| ar-SA  | `تدريب,محادثة`      | `محادثة,مكالمة,فيديو,صوتية`                |
| fr-FR  | `pratiquer,parler`  | `parler,conversation,appel`                |
| de-DE  | `üben,sprechen`     | `sprechen,Anruf`                           |
| pt-BR  | `praticar,falar`    | `falar,conversação,ligação`                |

**Language partner** — Finding a language partner / tandem / pen pal

| Locale | Now (2.8 list)      | After 2.9 is approved              |
| ------ | ------------------- | ---------------------------------- |
| en-US  | `tandem,partner`    | `tandem,partner`                   |
| tr     | `tandem,partner`    | `arkadaş,yabancı`                  |
| es-ES  | `tándem,compañero`  | `tándem,amigos`                    |
| ru     | `тандем,партнёр`    | `тандем,общение,иностранцы`        |
| ar-SA  | `تاندم,شريك`        | `شريك,أصدقاء,أجانب`                |
| fr-FR  | `tandem,partenaire` | `tandem,correspondant`             |
| de-DE  | `Tandem,Partner`    | `Tandem,Sprachpartner,Brieffreund` |
| pt-BR  | `tandem,parceiro`   | `amigos,estrangeiros`              |

**Learn English** — Practising English with native speakers

| Locale | Now (2.8 list) | After 2.9 is approved |
| ------ | -------------- | --------------------- |
| en-US  | `english`      | `english`             |
| tr     | `ingilizce`    | `ingilizce`           |
| es-ES  | `inglés`       | `inglés`              |
| ru     | `английский`   | `английский`          |
| ar-SA  | `إنجليزي`      | `انجليزي`             |
| fr-FR  | `anglais`      | `anglais`             |
| de-DE  | `Englisch`     | `Englisch`            |
| pt-BR  | `inglês`       | `inglês`              |

**Learn Spanish** — Practising Spanish with native speakers

| Locale | Now (2.8 list) | After 2.9 is approved |
| ------ | -------------- | --------------------- |
| en-US  | `spanish`      | `spanish`             |
| tr     | `ispanyolca`   | `ispanyolca`          |
| es-ES  | `español`      | `español`             |
| ru     | `испанский`    | `испанский`           |
| ar-SA  | `إسباني`       | `اسباني`              |
| fr-FR  | `espagnol`     | `espagnol`            |
| de-DE  | `Spanisch`     | `Spanisch`            |
| pt-BR  | `espanhol`     | `espanhol`            |

### Promotional text

Same voice as the version's promotional text: plain, second person, no prices
and no ranking claims. Each is under Apple's 170 characters.

**Speaking practice and calls**

| Language       | Promotional text                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| English        | Speaking is the hardest part, and you only learn it by speaking. Call your partner from the chat, voice or video, and take turns in each other's language.               |
| Türkçe         | En zor kısım konuşmak, o da ancak konuşarak öğrenilir. Pratik arkadaşını sohbetten sesli ya da görüntülü ara, sırayla birbirinizin dilinde konuşun. Herkese ücretsiz.    |
| Español        | Hablar es lo más difícil, y solo se aprende hablando. Llama a tu compañero desde el chat, con voz o vídeo, y turnaos en el idioma de cada uno. Gratis para todos.        |
| Русский        | Говорить сложнее всего, и научиться можно только в разговоре. Звони партнёру прямо из чата, голосом или по видео, и говорите по очереди на языках друг друга.            |
| العربية        | التحدث هو الجزء الأصعب، ولا يُتعلَّم إلا بالتحدث. اتصل بشريكك من الدردشة، صوتًا أو فيديو، وتناوبا على الحديث بلغة كلٍّ منكما. مجانًا للجميع.                             |
| Français       | Parler, c'est le plus dur, et ça ne s'apprend qu'en parlant. Appelez votre partenaire depuis la discussion, en vocal ou en vidéo, et passez d'une langue à l'autre.      |
| Deutsch        | Sprechen ist das Schwerste, und man lernt es nur durch Sprechen. Ruf deinen Übungspartner per Sprach- oder Videoanruf an und wechselt euch mit den Sprachen ab.          |
| Português (BR) | Falar é a parte mais difícil, e só se aprende falando. Ligue para seu parceiro direto da conversa, por voz ou vídeo, e revezem entre os dois idiomas. Grátis para todos. |

**Language partner**

| Language       | Promotional text                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English        | Meet people who speak the language you're learning and are learning yours. You help with theirs, they help with yours, and corrections are unlimited on every plan. |
| Türkçe         | Öğrendiğin dili konuşan ve senin dilini öğrenen insanlarla tanış. Sen onun diline yardım edersin, o da seninkine. Düzeltmeler her planda sınırsız.                  |
| Español        | Conoce a gente que habla el idioma que aprendes y aprende el tuyo. Os ayudáis con los dos idiomas, y las correcciones son ilimitadas en todos los planes.           |
| Русский        | Знакомься с теми, кто говорит на языке, который ты учишь, и учит твой. Ты помогаешь с их языком, они — с твоим. Исправления безлимитны на любом тарифе.             |
| العربية        | تعرّف على أشخاص يتحدثون اللغة التي تتعلمها ويتعلمون لغتك. تساعدهم في لغتهم ويساعدونك في لغتك، والتصحيحات غير محدودة في كل الخطط.                                    |
| Français       | Rencontrez des gens qui parlent la langue que vous apprenez et apprennent la vôtre. On s'entraide, et les corrections sont illimitées sur toutes les formules.      |
| Deutsch        | Lerne Leute kennen, die deine Zielsprache sprechen und deine Sprache lernen. Du hilfst ihnen, sie helfen dir, und Korrekturen sind in jedem Tarif unbegrenzt.       |
| Português (BR) | Conheça pessoas que falam o idioma que você aprende e estão aprendendo o seu. Vocês se ajudam nos dois idiomas, e as correções são ilimitadas em todos os planos.   |

**Learn English**

| Language       | Promotional text                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English        | Practice English with native speakers who want to learn your language. Write, get your mistakes corrected, and call when you're ready to talk.          |
| Türkçe         | İngilizce pratiğini, senin dilini öğrenmek isteyen ve ana dili İngilizce olan kişilerle yap. Yaz, hatalarını düzelttir, konuşmaya hazır olunca ara.     |
| Español        | Practica inglés con nativos que quieren aprender tu idioma. Escribe, deja que te corrijan y llama cuando te veas preparado para hablar.                 |
| Русский        | Практикуй английский с носителями, которые хотят выучить твой язык. Пиши, получай исправления и звони, когда будешь готов говорить.                     |
| العربية        | تدرّب على الإنجليزية مع ناطقين أصليين يريدون تعلّم لغتك. اكتب، ودعهم يصحّحون أخطاءك، واتصل حين تكون مستعدًا للكلام.                                     |
| Français       | Pratiquez l'anglais avec des natifs qui veulent apprendre votre langue. Écrivez, faites-vous corriger, et appelez quand vous vous sentez prêt à parler. |
| Deutsch        | Übe Englisch mit Muttersprachlern, die deine Sprache lernen wollen. Schreib, lass dich korrigieren und ruf an, wenn du bereit zum Sprechen bist.        |
| Português (BR) | Pratique inglês com nativos que querem aprender o seu idioma. Escreva, receba correções e ligue quando se sentir pronto para falar.                     |

**Learn Spanish**

| Language       | Promotional text                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English        | Practice Spanish with native speakers who are learning your language. Chat, get corrected as you go, and call when you want to hear it spoken.                      |
| Türkçe         | İspanyolcanı, senin dilini öğrenen ve ana dili İspanyolca olan kişilerle geliştir. Yazdıkça düzeltmeleri gör, sesli pratik yapmak istediğinde ara.                  |
| Español        | Hay quien está aprendiendo español y busca a alguien como tú. Ayúdale con el español y practica su idioma a cambio: escribe, corrige y llama cuando quieras hablar. |
| Русский        | Практикуй испанский с носителями, которые учат твой язык. Переписывайся, получай исправления и звони, когда захочешь услышать живую речь.                           |
| العربية        | تدرّب على الإسبانية مع ناطقين أصليين يتعلّمون لغتك. دردش، وتلقَّ التصحيحات أولًا بأول، واتصل حين تريد أن تسمعها منطوقة.                                             |
| Français       | Pratiquez l'espagnol avec des natifs qui apprennent votre langue. Discutez, faites-vous corriger au fil de l'eau, et appelez quand vous voulez l'entendre à l'oral. |
| Deutsch        | Übe Spanisch mit Muttersprachlern, die deine Sprache lernen. Chatte, lass dich nebenbei korrigieren und ruf an, wenn du es gesprochen hören willst.                 |
| Português (BR) | Pratique espanhol com nativos que estão aprendendo o seu idioma. Converse, receba correções na hora e ligue quando quiser ouvir a língua falada.                    |

### Screenshots and deep links

Shot ids: `1` Discover — "They need your language"; `2` Chat — "Say it wrong. Get it fixed."; `3` Feed — "Corrections are always free"; `4` Tokens, dark — "Earned by teaching"; `5` Chat, dark — "It has a night side"; `6` Feed, dark — "Ask when you're stuck"; `7` Discover, dark — "Or whoever is online now"; `8` Me — "A streak worth keeping"; `calls` NEW — "Call your partner" (voice and video calls); `camera` NEW — "Seen once, then gone" (View once chat camera).

| Page                        | Screenshot order                                                   | Deep link                       |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------- |
| Speaking practice and calls | `calls` → `2` → `1` → `3` → `camera` → `8` → `4` → `5` → `7` → `6` | `https://app.langx.io/chats`    |
| Language partner            | `1` → `7` → `2` → `3` → `calls` → `4` → `8` → `camera` → `5` → `6` | `https://app.langx.io/discover` |
| Learn English               | `1` → `2` → `calls` → `3` → `6` → `4` → `8` → `camera` → `7` → `5` | `https://app.langx.io/discover` |
| Learn Spanish               | `1` → `2` → `calls` → `3` → `6` → `4` → `8` → `camera` → `7` → `5` | `https://app.langx.io/discover` |

A page takes one deep link, for every localization. It is used when the app
is already installed and the reader taps Open. All four are universal links on `app.langx.io`, which the iOS app
claims for every path (`apps/mobile/public/.well-known/apple-app-site-association`
and `associatedDomains` in `apps/mobile/app.config.ts`); Expo Router serves
`/chats` and `/discover` from the tab routes.

- The calls page opens **`/chats`**: a call starts from a conversation, and no
  route opens a call on its own.
- The other three open **`/discover`**. The language pages are deliberately
  _not_ `/discover?learningLanguages=en`: the API answers 400 when a scope names
  a language the viewer is not learning (`scopedTo` in
  `apps/api/src/modules/discovery/discovery.ts`), and a named scope also turns
  off the cross-match fallback, so the link would fail or come back emptier
  than plain Discover for most people who tap it.

## Default product page

Order for the 2.9 default page, all ten shots:

`1` → `calls` → `2` → `3` → `4` → `camera` → `8` → `7` → `5` → `6`

Discover still says what LangX is in one frame; calls take the second slot because they are the release and the first three shots are what search results show; the dark duplicates move to the end. The camera
sits after tokens rather than near the front: view-once media is a 2.9 feature
but not the reason anyone installs a language app, and leading with it reads
like a different kind of app.

## Product Page Optimization test

**2.9 lead screenshot** — screenshots only; icon unchanged, all eight localizations.

| Arm                          | Screenshot order                                                   |
| ---------------------------- | ------------------------------------------------------------------ |
| Baseline (the default above) | `1` → `calls` → `2` → `3` → `4` → `camera` → `8` → `7` → `5` → `6` |
| A: calls first               | `calls` → `1` → `2` → `3` → `4` → `camera` → `8` → `7` → `5` → `6` |
| B: chat corrections first    | `2` → `1` → `calls` → `3` → `4` → `camera` → `8` → `7` → `5` → `6` |

Traffic proportion: **66%**. Two treatments at 66% leaves baseline and each treatment about a third of traffic: the most even split for an app with LangX's volume, which needs every visitor to reach a result.

The question is which first frame earns the install: what LangX is (Discover,
the baseline), the new thing (calls), or the moment the app is built around (a
correction in a chat). Only screenshots change, so a result is about the first
frame and nothing else. A test runs on the default page only; the custom
product pages are not part of it.
