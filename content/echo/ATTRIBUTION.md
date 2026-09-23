# Where the content came from

Each pack file lists its own sources in a `sources` array, which is the
authoritative record — this file is the human-readable version of the same
thing, plus the reasoning about what was left out.

## In use

**Twenty-four packs, seven languages, 6,549 items**, all `"reviewed": true`, so
the seed script will write them:

| Language | absoluteBeginner | beginner | intermediate |
| -------- | ---------------- | -------- | ------------ |
| English  | 271              | 275      | 263          |
| Spanish  | 258              | 281      | 280          |
| German   | 267              | 283      | 282          |
| French   | 272              | 281      | 281          |
| Russian  | 252              | 268      | 278          |
| Italian  | 260              | 279      | 279          |

And Mandarin, which is named by HSK level rather than by ours — see
`docs/echo.md`, _Chinese is named by HSK_:

| Language | HSK 1 | HSK 2 | HSK 3 | HSK 4 | HSK 5 | HSK 6 |
| -------- | ----- | ----- | ----- | ----- | ----- | ----- |
| Mandarin | 281   | 283   | 281   | 285   | 259   | 250   |

The flag does not mean the same thing for English, for the other five, and for
Mandarin. The three "what that review was" sections say what each one actually
was.

### What the English review was, exactly

The flag means somebody read the file, and it is load-bearing enough that a
later reader should not believe more than was done.

**Two passes, and they found different things.** The first read the drafts as
content: it dropped fourteen items a language app should not ask anybody to
memorise, corrected the senses that had been picked mechanically — `have a
seat` had been glossed as the verb _to sit down_ when Wiktionary's own "polite
directive" sense was in the same list — repaired twelve items whose English
gloss was the scraped word "Translations", and rewrote the Turkish column
throughout.

The second pass checked the columns the first had left behind, which is where
the remaining defects were: a corrected sense that had only reached Turkish, so
`got it` still answered "verstanden?" in German and "ты понимаешь?" in Russian
— both questions — while `have a seat` was still an infinitive in five
languages; items whose Turkish was written and whose other six were empty; and
ten glosses carrying dictionary notation onto a card back (`(eu)`, `(você)`,
`(usted)`, `(-e, -a, -ye, -ya, -ne)`, `...bloss...`). Twenty-two items were
edited. Each carries `review.edited` naming the columns that are no longer what
a source wrote.

The third pass read the Russian and Arabic columns line by line, which the
second had admitted it had not, and found ninety-five defects — far more than
either earlier pass, because nobody had actually read them. Most were
orthographic and clustered by class: more than twenty Arabic words written with
a wrong hamza or alif (`إجلس` for `اِجلس`, `الى` for `إلى`), two with a Persian
_yeh_ in place of the Arabic one, a Latin comma, spaces before a question mark,
`بسهوله` for `بسهولة`. Some were not: `It's too big.` was glossed with an unrelated Tatoeba
sentence about somebody called Tom, `Count to one hundred.` said _count to
ten_, `Never say never.` was three letters of a word that does not exist, and
`I'm broke.` said _I have been broken_. The Russian was in better shape — a
hyphen where the em dash belongs, a doubled stress mark, `Это новая.` for a
neuter noun, and `is it safe here` asking whether **he** is safe. Each edited
gloss carries its locale in `review.edited`.

**Sampled, not read exhaustively.** Eight hundred and nine items across eight
locales is about 5,600 glosses. Turkish, Russian and Arabic have now been read;
Turkish was sampled at random — 45 items, 44 clean — and the other two in full.
**German, Spanish, French and Portuguese have been checked for shape, not read
line by line**; if a wrong gloss survives, that is where to look first, and the
Arabic yield suggests the number is not small. Separately, every locale has
gaps — items with no gloss at all, from 11 in German to 104 in Arabic — where
the card falls back to English.

## Chosen, and why

| Source                                                                                                        | Gives                                                                                                 | Licence                                                        | Use                                                               |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| [CEFR-J Vocabulary Profile 1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) (Tono Laboratory, TUFS) | English: 7,798 headwords with a CEFR level and a part of speech                                       | Free for research **and commercial** use, provided it is cited | Which English words belong to which pack                          |
| [Octanove Vocabulary Profile C1/C2 1.0](https://github.com/openlanguageprofiles/olp-en-cefrj) (Octanove Labs) | English: 2,136 headwords at C1 and C2                                                                 | CC BY-SA 4.0                                                   | The ceiling CEFR-J stops below, so `fluent` has words of its own  |
| [NGSL 1.2](https://www.newgeneralservicelist.com/) (Browne, Culligan, Phillips)                               | English: 2,801 core words with an SFI frequency rank                                                  | CC BY-SA 4.0                                                   | The order the words go in, and `freqRank`                         |
| [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (hermitdave, OpenSubtitles 2018)               | 50k word forms by frequency, per language                                                             | CC BY-SA 4.0 for the content (MIT for the code)                | Levels and ordering for every language but English                |
| [Lexique 3](http://www.lexique.org/)                                                                          | French: 142k words with frequency, part of speech, phonetics                                          | CC BY-SA 4.0                                                   | A cross-check on the French levels; not a source of any pack      |
| [Wiktionary](https://en.wiktionary.org/), via [kaikki.org](https://kaikki.org/) (wiktextract)                 | Senses with definitions and examples, per-sense translations, recordings                              | CC BY-SA 4.0                                                   | Glosses for a phrasebook entry, and its example                   |
| [Tatoeba](https://tatoeba.org/)                                                                               | Short sentences with human translations into the eight locales                                        | CC BY 2.0 FR                                                   | Sentence patterns, and their glosses                              |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (hexgrad)                                             | A synthesised reading of any line, in a choice of voices                                              | Apache-2.0                                                     | The second and third takes on a card, where a person's is missing |
| [Wiktionary `Category:<Language> phrasebook`](https://en.wiktionary.org/wiki/Category:English_phrasebook)     | Curated everyday expressions: English 460, Russian 170, German 104, French 93, Spanish 79, Italian 57 | CC BY-SA 4.0                                                   | The set expressions in a pack                                     |

### Which Wiktionary a language is read from

kaikki.org publishes one extraction per Wiktionary edition, and which one a
pack uses is not a preference. **A translation table lives only on an
English-language entry of en.wiktionary.** `kaikki.org/dictionary/<Language>`
— that wiki seen by the language of the word — therefore answers with
translations for English and with nothing at all for anything else: `buenos
días`, `guten Tag` and `bonjour` all come back with an empty `translations`.

So English is read from `kaikki.org/dictionary/English` and every other
language from its own wiki — `eswiktionary/Español`, `frwiktionary/Français`,
and so on — where its own entries are the ones carrying tables. Those editions
link a translation to a sense differently, and `build-pack.mjs` reads all
three shapes: English writes the sense as text, Spanish and French carry a
`sense_index` into `senses[]`, and Italian carries nothing, which is
attributable only where the entry has a single sense.

### Eight locales in English, English plus what exists elsewhere

The rule for a Tatoeba sentence was a human translation in all eight locales
or nothing. That rule is kept for English and could not be kept anywhere else,
and the number is the reason. Counting direct links in Tatoeba's own export:

| Pack language | Links into Arabic | Into Turkish |
| ------------- | ----------------- | ------------ |
| English       | 16,322            | plenty       |
| Russian       | 6,560             | 22,604       |
| Spanish       | 3,393             | 38,317       |
| French        | 3,104             | 12,765       |
| German        | 2,971             | 22,142       |
| Italian       | 735               | 17,186       |
| Portuguese    | 348               | 4,795        |

Requiring all eight outside English does not make a stricter pack; it makes no
pack. What replaced it is a floor and a preference: **English is required** —
it is what `glossFor` falls back to, and an item without it shows its own
front on both sides — and the picker then prefers the best-covered sentences
over the merely eligible ones, so the thin columns fill as far as the data
goes. Taking 300 of 29,000 Spanish candidates that way lands on 6.1 of 7
locales each. Portuguese is not in this wave on the strength of that table
alone.

The cost is visible and is meant to be: Arabic reaches 9% of the Italian
items and 36% of the Russian ones, where across the English packs it reaches
87%. A
reader whose locale is missing gets the English gloss, which is a worse card
than a Spanish reader gets, and better than no pack at all.

### The recordings

The `audio` on a pack item is a Wikimedia Commons file, played from Commons
rather than copied into our own storage. Which candidates exist is decided by
`build-pack.mjs` (it keeps what Wiktionary links, Lingua Libre first); which
one may be used is decided by `add-audio.mjs`, which looks every file up and
keeps only the terms below.

**Nothing is assumed from a filename.** The three English drafts draw on 107
files under five different licences — 65 of them Lingua Libre, the rest older
Wiktionary and Shtooka uploads — so "Commons audio is CC BY-SA" would have been
wrong about two thirds of them:

| Licence       | Files | Credit                                           |
| ------------- | ----- | ------------------------------------------------ |
| CC0           | 54    | Not required, and given anyway where it is named |
| CC BY-SA 4.0  | 36    | Required — Lingua Libre's default                |
| CC BY 3.0 us  | 8     | Required — the Shtooka Project recordings        |
| CC BY-SA 3.0  | 6     | Required                                         |
| Public domain | 3     | Not required                                     |

The speakers, who are the credit those licences ask for: Sapaa (31), Commander
Keane (18), Vealhurl (18), Flame, not lame (12), Association Shtooka — Judith
Franck (8), Dvortygirl (8), Paul2520 (4), Steve Shives (3), and one each from
Wreaderick, Pvanp7, Wodencafe and Back ache. Each name is stored on
the item it belongs to and drawn in the app as "Spoken by {name}" — this list is
the summary, not the mechanism.

Seven more went on 15 September: their filenames had kept an HTML entity for
the apostrophe — `you&#39;re right.wav` — and because Commons derives a file's
path from a hash of its name, the escape broke the URL as well as the name.
All seven returned 404. They are covered by a synthesised reading instead.

These counts fell when the review pass dropped items: the recordings were
vetted against the drafts as they stood, and nineteen of them belonged to items
that are no longer in a pack. The last CC BY 4.0 file and the only recording by
RGBLionGam3r17 went with them, which is why the table above has five licences
rather than six.

**A recording with no readable author is refused**, even where the licence is
otherwise fine: the credit is the term being relied on, so a file that cannot
carry one cannot go on a card. One candidate was dropped for exactly that.

### The synthesised readings

Most of a pack has no human recording and never will: Wiktionary records
dictionary entries, not the sentences a phrasebook is made of, so the Tatoeba
half of every pack was silent. Each item now carries synthesised takes as well,
generated by `tools/echo-content/tts/generate.py` — two, one in each register,
wherever [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) reads the
language, and one where Piper does.

**Apache-2.0 over the weights and the voice packs alike**, which is the reason
this model and not a better-sounding one. The alternatives were all closed in
the same way and it is worth writing down which, because each looks free until
it is read:

| Considered               | Why not                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tatoeba's own recordings | 835,383 of 851,122 English files are CC BY-NC-ND 3.0, and 6,435 more carry no licence at all. 6,663 are usable — of which 153 have both a Turkish and an Arabic translation, so a pack built from them would be a tenth of this one. |
| macOS `say`              | Apple's SLA licenses the System Voices for personal, non-commercial use, and names recording and redistribution among the things no other licence grants. It does not turn on whether the feature is sold.                           |
| Coqui XTTS v2            | CPML — non-commercial. The most-recommended answer online, and the wrong one.                                                                                                                                                        |
| espeak-ng                | GPL, and a quality nobody would learn a language from.                                                                                                                                                                               |

**All five new languages are read, but not all by the same engine.** Kokoro
reads Spanish, French and Italian, so those packs carry its takes like the
English ones do. It does not read German or Russian. Piper does, and the 1,630
German and Russian readings are its: `de_DE-thorsten-medium` for the 832 German
items and `ru_RU-denis-medium` for the 798 Russian ones, the two voices
`apps/tts/voices.json` already names for those languages.

**Those two packs carry one take each, not two.** Piper offers one voice per
language and `echoSynthVoicesFor` answers with exactly that, so the pair of
registers the English packs lead with is a thing only Kokoro's six get. A
second take would be the same voice twice, which reads as a claim rather than
as a choice.

**Piper is GPL-3 and its two voices are CC0.** The licence covers the program,
not what the program pronounces: a reading is no more a derivative work of the
synthesiser than a print-out is of the printer. The voices are the part that
could have carried a condition and neither does. What the GPL does decide is
where Piper may run, which is why `apps/tts` is its own service — see
`requirements.txt` there.

**Piper only runs on Linux, and that is the wheel rather than us.** It compiles
its build machine's espeak data path into the extension, so the first synthesis
on a Mac dies in C; `load_piper` in `apps/tts/server.py` documents the same
failure from the same cause. German and Russian readings therefore have to be
made on a Linux box. The card's "Read it aloud" answers through the service in
either case.

**A person's recording is still better and still comes first.** The card draws
it above the synthesised ones and says "Spoken by {name}"; a synthesised take
carries no name, because there is nobody to credit and a made-up one would make
the two indistinguishable. See `docs/decisions.md`.

**A pack is phrases, so the glosses come from two places.** A phrasebook entry
is a dictionary entry and kaikki glosses it. A sentence is not — nothing has an
entry for "Why do you ask?", and inventing a translation for one is the same
mistake as picking a sense by counting, one step further along. So a sentence
carries the translation a Tatoeba contributor wrote, in all eight locales or
not at all: the gloss is the half a learner cannot check, and a pack that
quietly falls back to English for its Arabic readers is worse for them without
saying so.

**Two profiles, because one stops at B2.** CEFR-J bands A1 through B2; the
Octanove profile in the same repository bands C1 and C2. Read in that order,
first band wins. Without the second, a phrase whose hardest word is C1 has no
band at all and is dropped as unlisted — `fluent` would come out empty rather
than wrong, which is a harder bug to notice.

**CEFR-J is cited, not share-alike.** Its grant is its own wording rather than a
CC licence: free for research and commercial use _provided that you cite the
dataset properly_, copyright Tono Laboratory, TUFS. The citation obligation does
not expire because the pack around it is CC BY-SA — see `LICENSE` beside this
file. The citation is:

> The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of
> Foreign Studies. Retrieved from <http://www.cefr-j.org/download.html>.

**There is no such list for French.** CEFRLex — EFLLex for English, FLELex for
French — is the resource that levels French vocabulary, and it is CC BY-NC-SA
4.0. Non-commercial rules it out for the same reason the Kelly lists are out, so
French levels have to be derived from Lexique 3 frequency and then read by a
person. That derivation is ours and is the expensive half of a French pack.

### The pictures

Every card in these packs carries a cue above the sentence. There are two
sources for them and they are kept apart on purpose — see `LICENSE`.

**Nothing in them is borrowed.** All 372 cue pictures are drawn for this app,
from the shapes in `tools/echo-content/images/drawings.mjs`, and every one of
the 6,480 cards that carries a cue points at one of them. The first 348 were
drawn for the English packs and were not added to for the five new languages —
the same set served all six, which is the point of keeping the slug rather
than the phrase as what a card stores. The 24 added after them are what those
five asked for and English never had: a horse, an apple, a bicycle, a paw
print and twenty more, each of which several cards across several languages
now share.

That is a change from how this started. The first version of the set was
mostly **OpenMoji 15.1.0** (CC BY-SA 4.0, <https://openmoji.org>, taken from
`cdn.jsdelivr.net/npm/openmoji@15.1.0` on 18 September 2026), each glyph placed
on our own plate — which made each one a derived work and put the whole set
under share-alike. They were replaced a batch at a time until none were left.
What remains of OpenMoji is `concepts.json`: a table saying what each emoji is
called, so that `💸` resolves to `money-with-wings` and names a file. A naming
convention is not artwork, but it came from somewhere and this is where.

**The pictures themselves are not committed.** They are rendered to PNG and
uploaded to the bucket; the repository keeps the decision (`cues.<lang>.json`), the
naming, which is also the manifest (`concepts.json`), and the geometry
(`drawings.mjs`). PNG rather than the vector they are drawn as because
expo-image hands an SVG to each platform's own decoder, and iOS's mishandles
the arc syntax most minifiers emit.

**Why a picture at all, and why this one.** `docs/echo.md` used to say a cue
belonged only on "a noun you can point at", with abstract items left plain. No
item in any of these packs is a noun: they are eight hundred phrases, so the
rule could never fire, and the field it described sat empty from the day it was
written. What is there now is a cue for the _meaning_ — 💸 over "I'm broke." —
which is a thing a phrase has. `tools/echo-content/images/cues.<lang>.json` is
the record of which meaning was chosen for which phrase — one file per pack
language, because the key is the phrase, and the slugs behind them are shared —
one line each, and is the half of this worth reading.

**What a cue is not.** It is not a translation and it is not a mnemonic we can
defend in eight languages; it is a hook for the eye. Where no honest picture
existed the item keeps none — "I'm straight" has no cue and should not be given
one.

**The five new languages started blanker than English, for a reason worth
keeping.** The first 348 concepts were drawn _for_ the 808 English phrases, so
near-total coverage there was true by construction; where these packs went
somewhere English never did — horses, bicycles, apples, wolves, chess — the
palette had nothing honest and 92 cards kept no picture. Twenty-four concepts
later, 4,086 of their 4,101 cards carry a cue and 15 do not, against one of
809 in English.

Those 15 are the answer rather than a backlog: abstractions with no subject to
draw, a condom, a thief, a genie, a doll, a carpet. A card without a picture
is fine. A card with the wrong one teaches a wrong association and nobody will
report it — which is why `Le citron est acide.` stopped borrowing the
tangerine and got a lemon of its own.

### Mandarin: where it came from

| Source                                                                                                                                                                                     | Gives                                                            | Licence      | Use                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| [HSK 2.0 word lists](https://github.com/clem109/hsk-vocabulary) (Clement Venard), via [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (Yanis Zafirópulos) | 4,991 words with the HSK 2.0 level each is taught at, and pinyin | MIT, both    | Which sentence goes in which pack; neutral-tone pinyin |
| [Tatoeba](https://tatoeba.org/), `cmn`                                                                                                                                                     | 89,065 Mandarin sentences and their human translations           | CC BY 2.0 FR | Every sentence, and every gloss                        |
| [pypinyin](https://github.com/mozillazg/python-pinyin)                                                                                                                                     | Contextual pinyin for a whole sentence                           | MIT          | The draft of `reading`                                 |
| [jieba](https://github.com/fxsjy/jieba)                                                                                                                                                    | Word segmentation with parts of speech                           | MIT          | A second opinion on where words end                    |

Taken on 23 September 2026, `wordlists/exclusive/old/<n>.json` from the
complete-hsk-vocabulary repository. The list is a syllabus — Hanban published
it — and what the packs keep of it is a level per sentence, not the list; the
MIT notices are the two repositories'. Only the word-to-level table and the
pinyin were read: the meanings in the same files are CC-CEDICT, and no gloss
comes from them.

**Every item is a Tatoeba sentence**, simplified characters only (a sentence
that Tatoeba holds a traditional transcription _of_ is written in simplified),
three to eight HSK words long and at most sixteen characters. Its level is its
hardest word. No phrasebook half: Wiktionary's Chinese phrasebook entries are
not what an HSK learner is measured on.

**The glosses are direct where they can be and indirect where they cannot.**
Tatoeba links 78,191 Mandarin sentences to English but 1,254 to Turkish and
152 to Arabic. Where a column has no direct translation, the pipeline takes the
translation of the English gloss — a person's translation of a person's
translation — and names that column in `review.indirect`. That is a departure
from every other pack, where a column with no direct link stays empty, and it
is made for Turkish: direct links alone would have left a Turkish reader on
the English back for four cards in five. The reading below checked the Turkish
against the Chinese, not against the English it came through.

**Cue pictures from the same 372, and no synthesised readings.** No new
concept was drawn: `tools/echo-content/images/cues.zh.json` points 1,586 of
the 1,639 sentences at a picture the other six languages already use, chosen
on 23 September by six Claude subagents, one per pack, and then thinned by
hand — ten choices that needed decoding were taken out ("mine" and "not mine"
as a raised hand or a crossed arm, 💯 over _a century is a hundred years_, a
shirt over a hat). The 53 without one are abstractions (_selfish_,
_optimist_, _monopoly_) and things the palette has no honest drawing of: a
basketball, a watermelon, a shoe, tofu, a tiger, a tent, a cave, a prison.
Those are the list to draw from when the palette next grows. No voice reads
Chinese here — `packages/shared/src/speech.ts` says why — which is the reason
`reading` exists.

### What the review of the Mandarin six was, exactly

**Read by six Claude subagents, one per pack, on 23 September — not by a
native speaker, and not by a person.** The same is worth saying about this
reading as about the others: believe no more than was done.

Every one of the 1,800 drafted items was read, in four columns: the Chinese,
the pinyin, English and Turkish. German, Spanish, French, Portuguese, Russian
and Arabic were checked for _meaning_ only — does this translate the same
sentence — and fixed where it did not; they were not read for style. The
linter's mechanical classes (Russian dashes, Arabic spacing) were repaired
without reading.

**161 dropped**, of which the kinds were: near-duplicates (56), unnatural or
non-standard Mandarin (35), slogans, positions and quotations — Sima Qian,
King, Horace, a national anthem, the Beijing Olympics song (30), violence,
insults and sexual content (17), Tatoeba nonsense (15), a harder word spelled
out of easy characters (7) — 脸书, 玩笑, 正直, 把手, 要点 — and one whose
glosses all answered a different sentence.

**174 readings corrected**, counting `méiyǒu`, `yíxià` and `yìxiē`, which
the reading left split for consistency and the generator now joins. The
reading pass named the generator's recurring mistakes — 个人 read as _gèrén_ in 一个人, the measure word 只 as
_zhǐ_, 教 as _jiào_, 过 and 着 with full tones, numbers and 没有 split
apart — and `tools/echo-content/hsk/pick.py` was changed for each, so a second
draft makes fewer of them. One of them was a levelling bug as well: 个人 is
an HSK 5 word, and eight sentences about _one person_ had been filed at HSK 5.
They were moved to the level they are.

**753 glosses corrected or added**, each naming its column in
`review.edited`. English lost its habit of a past tense the Chinese does not
have. Turkish was where most of the work was, as expected of a column that is
mostly indirect: _sen_ for 您 and _siz_ for 你, _kamera_ for a stills camera,
_erkek kardeş_ for 哥哥, and 180 Turkish glosses written where there were
none.

**What is still owed**: a native speaker's pass over the pinyin, which is the
column a learner copies without being able to check, and over Portuguese and
Arabic, which are the thinnest (50–75% and 12–33% of items).

## Rejected

| Source                                 | Why not                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Kelly lists (Leeds)                    | CC BY-NC-SA. Non-commercial, and a pack is a derivative. Offline since 2026 in any case.                   |
| CEFRLex — EFLLex, FLELex               | CC BY-NC-SA 4.0. The best French CEFR data there is, and not redistributable here.                         |
| English Vocabulary Profile (Cambridge) | No public licence and no bulk download; the terms reserve the rights. Free to read, not to ship.           |
| Oxford 3000 / 5000                     | © Oxford University Press, no grant. The GitHub mirrors that relicense it as MIT do not have the right to. |
| FreeDict                               | GPL-2.0-or-later. Free, but a copyleft that is not share-alike and does not belong in a data directory.    |
| Forvo                                  | CC BY-NC-SA, and the API forbids caching the audio. Offline review needs the file to stay on the device.   |
| Anki shared decks                      | No stated licence and no provenance. A deck with an unknown author is a deck we cannot relicense.          |
| Machine translation of a bare headword | Not a licensing problem, a correctness one — see below.                                                    |

## Drafts

A draft is a pack file with `"reviewed": false`. **The seed script refuses to
write one**, and that refusal is the whole quality gate. The three English
packs have passed it; see "In use" above for what passing meant.

**There are no drafts today.** The fifteen drafted on 20 September were read
the same night; see "What the review of the fifteen was" below.
`tools/echo-content/lint-glosses.mjs` had 92 things to say about them before
that reading — 64 Russian copula dashes written as a hyphen, 13 Arabic
sentences spaced before their punctuation, 3 Persian letters inside Arabic
words — and all 92 were repaired. It cannot see a wrong sense or a
translation of a different sentence, which is what the reading was for.

Almost all of every new pack is Tatoeba. The phrasebook categories outside
English are small to begin with, and most of their entries have no translation
table on their own wiki: 36 of the 39 Spanish phrasebook entries that reached
`absoluteBeginner` resolved to nothing. Where English is about half set
expressions, these are around one in twenty.

### What the review of the fifteen was, exactly

**Three columns of seven in every file — the front, English and Turkish —
read line by line.** 4,208 drafted items across Spanish, German, French,
Russian and Italian, of which **4,101** remain — es 819, de 832, fr 834,
ru 798, it 818. The other four columns in each
file were **linted and not read**, which is the same footing English's
German, Spanish, French and Portuguese columns are on. If a wrong gloss
survives, that is where to look first.

Why those three. The front is the card. **English is the floor** — required
on every item, what `glossFor` falls back to for every reader whose own
locale is missing, and, it turns out, the loosest column in the corpus,
because English has the most Tatoeba contributors and the most idiom. Turkish
is the column a reader of this repository can check.

**107 items dropped**, in five kinds:

- **Slogans and positions** — "¡América ha vuelto!", "Je suis Charlie.", "Le
  vite nere contano.", "Tutto il mondo odia la polizia.", "Il partito ha
  sempre ragione.", "Eigentum ist Diebstahl.", "Черные жизни важны." Four
  languages produced a "War is bad" and all four are gone.
- **Quotations** — Dante, Mozart, Leonardo, Proudhon, Genesis in three
  languages, "Houston, tenemos un problema.", "Sono un genio molto stabile."
- **Tatoeba nonsense** — "Es carne de mono.", "Dio è un elefante." in three
  languages, "Meine Katze bellt.", "La torta è una bugia.", and "Él vive en
  una manzana.", whose English gloss reads "He lives inside an apple"
  (_manzana_ is a city block).
- **Violence and obscenity** — "¿Quién la mató?", "Tom veut tuer Mary.", "Ho
  una granata.", two anatomical Italian ones, and "Voglio farmi saltare il
  cervello.", which is self-harm and exactly where the English pass drew its
  line.
- **Items that contradict themselves** — three whose glosses answer a
  different question than the front asks, and three with no English gloss at
  all and nothing worth keeping without one.

The death and illness sentences that are ordinary speech stayed, on the
precedent of the English pass: a learner who cannot say them is worse off
than one who can.

**About two hundred glosses corrected**, each naming its locale in
`review.edited`. The repeats across languages are the interesting part:

- `Tutti lo sanno.`, `Tout le monde le sait.` and `Jeder weiß das.` all
  answered "Anybody knows it." in English and "nobody knows" in Turkish. One
  English pair appears to have seeded three languages.
- **Which word for God.** German, French, Italian and Russian all mixed
  `Allah` and `Tanrı` in Turkish for the one word their front uses, sometimes
  two lines apart. They say `Tanrı` throughout now, except where the front
  itself says Allah.
- Passive for active in three languages (`Él la besó.` → "She was kissed by
  him.").
- Plain mistranslations: `en yakın banka` had become "en yakın bank", which is
  a bench; `Él tiene mucho dinero.` said he _spends_ a lot; `Je ne fais que
mon travail.` said the opposite of itself.

**Twenty-one fronts corrected**, each keeping the original in
`review.frontWas`. Fourteen were Russian sentences with a hyphen where the
language writes an em dash — the linter found sixty-four of those in the
glosses and nothing was looking at the fronts. The rest: two pre-1996 German
spellings, two Spanish accents, a French colour agreeing with its noun, and a
missing ё.

### What is still owed on the fifteen

**Readings and cue pictures are done.** All fifteen packs are read — Kokoro's
two takes for Spanish, French and Italian, Piper's one for German and Russian —
and all five have a `cues.<lang>.json`. What a reader should not take from that
is evenness: 91 of the 4,101 cards carry no picture, and German and Russian
carry one voice where the other three carry two. Both are explained above, and
both are the honest answer rather than a gap to fill.

**Four columns per file unread**, as above.
