# `fluent`: what the data allows

Measured on 7 October 2026 against the Tatoeba per-language exports dated
3 October 2026, hermitdave's FrequencyWords 2018 `<lang>_50k.txt`, and, for
English, CEFR-J 1.5 + the Octanove C1/C2 profile + NGSL 1.2. Step 1 of the
`fluent` packs: how many candidates exist, and how the gloss columns fill.

## What `fluent` means outside English

`pick-phrases.mjs` bands a word by its rank in the frequency list. Until this
change the bands stopped at B1 (rank 10,000), so a phrase with a rarer word was
unlisted and dropped, and `fluent` could not come out of the picker at all.
The bands now continue: **C1 to rank 25,000, C2 to rank 50,000** (the end of
the file), both `fluent`. The three bands below are unchanged, so no existing
pack would pick differently.

**A name does not make a phrase fluent.** The first pool with those bands was
_Vivo en Atenas._, _Soy Susan Greene._, _Chipre es una isla._ — A1 sentences
whose rarest word was a place or a person. At `fluent` a phrase whose hardest
word is capitalised is now not taken (`restsOnName`). German is exempt,
because German capitalises every noun; review has to catch its names.

What is left is still **rarer vocabulary or a rarer inflection**, not C1
grammar: _Te ves pálido._, _Mangi e beva._, _Lui stava volando._ A frequency
list cannot see syntax, and the eight-word ceiling keeps the long subordinate
sentences that would carry it out of the pool anyway. In Russian and German a
declined form of an everyday word can rank past 10,000 and make its phrase
"fluent" by its ending alone. That is the honest description of these packs,
and the reviewer should read them as "the long tail of everyday vocabulary".

## Candidates

All rules but the picture: level `fluent`, 3–8 words, ending in `.?!`,
writable, not resting on a name (except German), and the gloss rule. Outside
English the gloss rule is **English required**, as for the other three levels.
"Top 300" is the 300 the picker would take — best-covered first.

| Pack | Tatoeba candidates | Phrasebook entries | > 40 chars | Avg locales, top 300 | tr  | de  | es  | fr  | pt-BR | ru  | ar  |
| ---- | -----------------: | -----------------: | ---------: | -------------------: | --- | --- | --- | --- | ----- | --- | --- |
| es   |             37,296 |                  5 |      8,065 |                5.3/7 | 50% | 97% | —   | 92% | 87%   | 92% | 13% |
| fr   |             31,419 |                  4 |      6,541 |                5.1/7 | 24% | 98% | 97% | —   | 82%   | 97% | 11% |
| it   |             59,854 |                  1 |      9,001 |                4.6/7 | 15% | 76% | 83% | 85% | 47%   | 46% | 6%  |
| de   |             70,578 |                 21 |     22,966 |                5.4/7 | 49% | —   | 98% | 99% | 79%   | 97% | 16% |
| ru   |            120,537 |                 32 |     18,340 |                5.3/7 | 48% | 98% | 98% | 99% | 66%   | —   | 20% |

English is 100% in every row and is omitted. Every language has a hundred
times the candidates a pack needs, so the gloss rule is not what limits
`fluent` outside English; the columns fill about as well as at
`intermediate`, Arabic and Turkish worst and Italian thinnest throughout.

**English, measured only — not built:**

| Rule for an English sentence                                | Candidates |
| ----------------------------------------------------------- | ---------: |
| All seven other locales (the rule English is held to today) |          3 |
| All but Arabic                                              |         63 |
| Turkish only (the floor, nothing else required)             |      2,540 |

Under the eight-locale rule English `fluent` is three sentences, and relaxing
only Arabic still leaves 63 — under the 200 floor below. An English `fluent`
pack exists only if English moves to the rule the other five use (one column
required, the rest preferred): taking the best-covered 300 of the 2,540 would
average 5.1 of 7 locales, with Turkish 100%, Russian 93%, French 88%, German
85%, Spanish 74%, Portuguese 64% and **Arabic 6%**. That is Behic's decision,
not this branch's.

## Recommendation

Build `es`, `fr`, `it`, `de` and `ru`, each where at least **200 items survive
every rule** — the above plus a cue picture on every item (rule 1 of the
overnight brief). The gloss and length rules leave thousands; the picture is
the binding rule, and its numbers are below once the mapping is done. Do not
build `en`.

## The picture rule

Every item carries an honest cue from `images/concepts.json`, enforced at pick
time by `pick-phrases.mjs --cues images/cues.<lang>.json`: the cue table is
written against a 700-candidate pool (the best-covered 700, about twice a
pack), and the second run takes only phrases the table maps. What survived:

| Pack | Pool | Given an honest cue | No picture | Idiom | Content | Name only | Other | Picked | In the pack |
| ---- | ---: | ------------------: | ---------: | ----: | ------: | --------: | ----: | -----: | ----------: |
| es   |  700 |           502 (72%) |        126 |    13 |      40 |         8 |    11 |    300 |         296 |
| fr   |  700 |           438 (63%) |        191 |    19 |      33 |        10 |     9 |    300 |         298 |
| it   |  700 |           430 (61%) |        197 |    12 |      39 |        22 |     0 |    300 |         299 |

All three clear the 200 floor with room, so all three are built. "Picked" to
"in the pack" is phrasebook entries kaikki had no translation table for
(_gracias de antemano_, _próspero año nuevo_, _bon app_, _cercasi personale_
and three more); `build-pack.mjs` drops those, and dropping them left no two
neighbours opening with the same word.

"Content" is what the review of the fifteen dropped at the lower levels —
slogans, quotations, violence, sexual anatomy, stereotypes, Tatoeba nonsense —
skipped at mapping time rather than left for review, and "no picture" is mostly
an animal, food or garment the closed set of 372 has no drawing of (goat,
giraffe, spider, pear, shoes, socks). Six of the mappers' cues were overruled
before the merge: a symbol heart for the organ (twice), red meat for raw
chicken, a toothbrush for toothpaste, and two sentences about states'
diplomatic and political standing.

`de` and `ru` were drafted on a sibling branch (Piper voices):

| Pack |  Pool | Given an honest cue | Taken | Built                                  |
| ---- | ----: | ------------------: | ----: | -------------------------------------- |
| de   | 1,100 |                 280 |   270 | yes — 10 phrasebook lines had no table |
| ru   |   700 |                 256 |   244 | yes — 12 phrasebook lines had no table |

German needed a second block of 400 candidates: the first 700 gave 228 cues
before near-duplicates were thinned, too close to the 200 floor once the
phrasebook lines fell out. "Taken" is after `build-pack.mjs`, which found no
translation table on de.wiktionary or ru.wiktionary for any of the 22
phrasebook entries the cue tables had kept, so both packs are all Tatoeba.

## How to repeat it

```sh
D=~/.cache/langx-echo/downloads   # a copy of Tatoeba's per_language/ under $D/tatoeba
node tools/echo-content/pick-phrases.mjs --lang es --levels fluent --limit 700 \
  --frequency $D/frequencywords/es_50k.txt --phrasebook $D/es-phrasebook.json \
  --tatoeba file://$D/tatoeba/per_language --out-dir ./pool-es
# write cues for the pool into images/cues.es.json, then:
node tools/echo-content/pick-phrases.mjs --lang es --levels fluent --limit 300 \
  --frequency $D/frequencywords/es_50k.txt --phrasebook $D/es-phrasebook.json \
  --tatoeba file://$D/tatoeba/per_language --cues tools/echo-content/images/cues.es.json \
  --out-dir ./picked-es
```

The candidate counts come from the same command with `--limit 300000`, and the
English rows from `--require tr` with the profiles named in the header of
`pick-phrases.mjs`.
