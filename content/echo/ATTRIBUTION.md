# Where the content came from

Each pack file lists its own sources in a `sources` array, which is the
authoritative record — this file is the human-readable version of the same
thing, plus the reasoning about what was left out.

## In use

Nothing yet. `en/absoluteBeginner.json` is a draft; see "Drafts" below.

## Chosen, and why

| Source                                                                                                        | Gives                                                                    | Licence                                                        | Use                                                              |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| [CEFR-J Vocabulary Profile 1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) (Tono Laboratory, TUFS) | English: 7,798 headwords with a CEFR level and a part of speech          | Free for research **and commercial** use, provided it is cited | Which English words belong to which pack                         |
| [NGSL 1.2](https://www.newgeneralservicelist.com/) (Browne, Culligan, Phillips)                               | English: 2,801 core words with an SFI frequency rank                     | CC BY-SA 4.0                                                   | The order the words go in, and `freqRank`                        |
| [Lexique 3](http://www.lexique.org/)                                                                          | French: 142k words with frequency, part of speech, phonetics             | CC BY-SA 4.0                                                   | The French word list and its ordering                            |
| [Wiktionary](https://en.wiktionary.org/), via [kaikki.org](https://kaikki.org/) (wiktextract)                 | Senses with definitions and examples, per-sense translations, recordings | CC BY-SA 4.0                                                   | Draft glosses in the eight interface locales, and the examples   |
| [Tatoeba](https://tatoeba.org/)                                                                               | Example sentences with translations                                      | CC BY 2.0 FR                                                   | Unused today — kaikki carries examples. The fallback if it stops |

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
write one**, and that refusal is the whole quality gate.

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

Six out of six is not a guarantee, it is six. The senses a frequency list is
made of are the easy ones; `be` drafts as _to occupy a place_ rather than the
copula, and that is a judgement a count cannot make. So the pipeline still
drafts and a person still decides — it writes the definition, the other
candidate senses and the number of languages behind each one beside every
gloss, precisely so that reading the file is a possible thing to do rather than
a matter of trusting it.
