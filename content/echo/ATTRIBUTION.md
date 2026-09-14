# Where the content came from

Each pack file lists its own sources in a `sources` array, which is the
authoritative record — this file is the human-readable version of the same
thing, plus the reasoning about what was left out.

## In use

Nothing yet. The first pack is still a draft; see "Drafts" below.

## Chosen, and why

| Source                                                                      | Gives                                                        | Licence      | Use                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------ | ---------------------------------------------------- |
| [NGSL](https://www.newgeneralservicelist.com/) (Browne, Culligan, Phillips) | English: 2,801 core words with frequency                     | CC BY-SA 4.0 | The English word list and its ordering               |
| [Lexique 3](http://www.lexique.org/)                                        | French: 142k words with frequency, part of speech, phonetics | CC BY-SA 4.0 | The French word list and its ordering                |
| [English Wiktionary](https://en.wiktionary.org/)                            | Senses, and per-sense translations into many languages       | CC BY-SA 4.0 | Draft glosses in the eight interface locales         |
| [Tatoeba](https://tatoeba.org/)                                             | Example sentences with translations                          | CC BY 2.0 FR | Example sentences, where we have not written our own |

## Rejected

| Source                                 | Why not                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Kelly lists (Leeds)                    | CC BY-NC-ND-SA. Non-commercial and no derivatives; a pack is a derivative and this is a commercial app. Offline since 2026 in any case. |
| Anki shared decks                      | No stated licence and no provenance. A deck with an unknown author is a deck we cannot relicense.                                       |
| Machine translation of a bare headword | Not a licensing problem, a correctness one — see below.                                                                                 |

## Drafts

A draft is a pack file with `"reviewed": false`. **The seed script refuses to
write one**, and that refusal is the whole quality gate.

The reason it exists is worth stating plainly, because the obvious shortcut is
very tempting and it does not work. Wiktionary's translation tables are
sense-carrying, which is exactly what a gloss needs — but picking a sense
mechanically gets it wrong often enough to be useless. Measured on eight
beginner words, taking the first translation block gave:

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
into no result instead of a wrong one, because the tables are not always
inside the section they belong to.

So the pipeline drafts and a person decides. `build-pack.mjs` writes the sense
it chose beside every gloss precisely so that reading the file is a possible
thing to do, rather than a matter of trusting it.
