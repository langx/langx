# Where the content came from

Each pack file lists its own sources in a `sources` array, which is the
authoritative record — this file is the human-readable version of the same
thing, plus the reasoning about what was left out.

## In use

The three English packs — `en/absoluteBeginner.json` (271 items),
`en/beginner.json` (275) and `en/intermediate.json` (263).
`contentVersion: 3`, `"reviewed": true`, so the seed script will write them.

### What that review was, exactly

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

| Source                                                                                                        | Gives                                                                    | Licence                                                        | Use                                                               |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| [CEFR-J Vocabulary Profile 1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) (Tono Laboratory, TUFS) | English: 7,798 headwords with a CEFR level and a part of speech          | Free for research **and commercial** use, provided it is cited | Which English words belong to which pack                          |
| [Octanove Vocabulary Profile C1/C2 1.0](https://github.com/openlanguageprofiles/olp-en-cefrj) (Octanove Labs) | English: 2,136 headwords at C1 and C2                                    | CC BY-SA 4.0                                                   | The ceiling CEFR-J stops below, so `fluent` has words of its own  |
| [NGSL 1.2](https://www.newgeneralservicelist.com/) (Browne, Culligan, Phillips)                               | English: 2,801 core words with an SFI frequency rank                     | CC BY-SA 4.0                                                   | The order the words go in, and `freqRank`                         |
| [Lexique 3](http://www.lexique.org/)                                                                          | French: 142k words with frequency, part of speech, phonetics             | CC BY-SA 4.0                                                   | The French word list and its ordering                             |
| [Wiktionary](https://en.wiktionary.org/), via [kaikki.org](https://kaikki.org/) (wiktextract)                 | Senses with definitions and examples, per-sense translations, recordings | CC BY-SA 4.0                                                   | Glosses for a phrasebook entry, and its example                   |
| [Tatoeba](https://tatoeba.org/)                                                                               | Short sentences with human translations into the eight locales           | CC BY 2.0 FR                                                   | Sentence patterns, and their glosses                              |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (hexgrad)                                             | A synthesised reading of any line, in a choice of voices                 | Apache-2.0                                                     | The second and third takes on a card, where a person's is missing |
| [Wiktionary `Category:English phrasebook`](https://en.wiktionary.org/wiki/Category:English_phrasebook)        | 460 curated everyday expressions                                         | CC BY-SA 4.0                                                   | The set expressions in a pack                                     |

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
half of every pack was silent. Each item now carries two synthesised takes as
well — one in each register — read by [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
and generated by `tools/echo-content/tts/generate.py`.

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

**Nothing in them is borrowed.** All 348 cue pictures are drawn for this app,
from the shapes in `tools/echo-content/images/drawings.mjs`, and every one of
the 808 cards points at one of them.

That is a change from how this started. The first version of the set was
mostly **OpenMoji 15.1.0** (CC BY-SA 4.0, <https://openmoji.org>, taken from
`cdn.jsdelivr.net/npm/openmoji@15.1.0` on 18 September 2026), each glyph placed
on our own plate — which made each one a derived work and put the whole set
under share-alike. They were replaced a batch at a time until none were left.
What remains of OpenMoji is `concepts.json`: a table saying what each emoji is
called, so that `💸` resolves to `money-with-wings` and names a file. A naming
convention is not artwork, but it came from somewhere and this is where.

**The pictures themselves are not committed.** They are rendered to PNG and
uploaded to the bucket; the repository keeps the decision (`cues.json`), the
naming (`concepts.json`), the geometry (`drawings.mjs`) and the manifest
(`credits.json`). PNG rather than the vector they are drawn as because
expo-image hands an SVG to each platform's own decoder, and iOS's mishandles
the arc syntax most minifiers emit.

**Why a picture at all, and why this one.** `docs/echo.md` used to say a cue
belonged only on "a noun you can point at", with abstract items left plain. No
item in any of these packs is a noun: they are eight hundred phrases, so the
rule could never fire, and the field it described sat empty from the day it was
written. What is there now is a cue for the _meaning_ — 💸 over "I'm broke." —
which is a thing a phrase has. `tools/echo-content/images/cues.json` is the
record of which meaning was chosen for which phrase, one line each, and is the
half of this worth reading.

**What a cue is not.** It is not a translation and it is not a mnemonic we can
defend in eight languages; it is a hook for the eye. Where no honest picture
existed the item keeps none — "I'm straight" has no cue and should not be given
one.

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

The reason it exists is worth stating plainly, because the obvious shortcut is
very tempting and it does not work. Wiktionary's translation tables are
sense-carrying, which is exactly what a gloss needs — but picking a sense
mechanically gets it wrong often enough to be useless. Measured on eight
beginner words, the first version of `build-pack.mjs` — which pulled raw
wikitext and took the first `{{trans-top|…}}` block — gave:

| Word     | Sense taken                           | Wanted      |
| -------- | ------------------------------------- | ----------- |
| bread    | baked dough made from cereals         | correct     |
| tomorrow | on the day after the present day      | correct     |
| bank     | institution                           | correct     |
| train    | the elongated back portion of a dress | the vehicle |
| dog      | pursue with the intent to catch       | the animal  |
| water    | to pour water into the soil           | the liquid  |

Three wrong out of six that resolved at all, and scoping the search to the
word's part of speech did not fix it — it turned `water`, `light` and `right`
into no result instead of a wrong one, because the tables are not always inside
the section they belong to.

**The second version gets all six right, and the gate stays anyway.** It reads
kaikki.org, where each translation arrives tagged with its sense, and drafts the
sense that the most languages have a word for — a usage signal, where
Wiktionary's own order is by etymology and age. That is what puts the vehicle
ahead of the dress. On the same six words:

| Word     | Sense drafted                    | Languages | Right? |
| -------- | -------------------------------- | --------- | ------ |
| bread    | baked dough made from cereals    | 406       | yes    |
| tomorrow | on the day after the present day | 334       | yes    |
| bank     | institution                      | 187       | yes    |
| train    | line of connected cars           | 258       | yes    |
| dog      | animal                           | 953       | yes    |
| water    | inorganic compound H₂O           | 4,031     | yes    |

That machinery now runs over the phrasebook half of a pack only. A Tatoeba
sentence has no sense to choose: it arrives with its translation attached, and
what a reviewer checks there is whether the two say the same thing.

Six out of six is not a guarantee, it is six. The senses a frequency list is
made of are the easy ones; `be` drafts as _to occupy a place_ rather than the
copula, and that is a judgement a count cannot make. So the pipeline still
drafts and a person still decides — it writes the definition, the other
candidate senses and the number of languages behind each one beside every
gloss, precisely so that reading the file is a possible thing to do rather than
a matter of trusting it.
