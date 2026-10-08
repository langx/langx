"""
Drafts the Japanese packs, one per JLPT level, from Tatoeba.

The Mandarin picker (`../hsk/pick.py`) with the things Japanese does not share
with Chinese.

**A tagger draws the words, not the word list.** Japanese has no spaces either,
but unlike Chinese it inflects — 飲みませんか is one verb, two auxiliaries and a
particle — so spelling a sentence out of list entries, the way the HSK picker
does, would find nothing. fugashi (MIT) over UniDic (unidic-lite, MIT; the
dictionary BSD) splits each sentence into short units and names each one's
dictionary form, and the dictionary form is what the list is looked up by.

**The level is the hardest word's, on Jonathan Waller's JLPT lists.** There is
no official JLPT vocabulary list — the Japan Foundation stopped publishing one
in 2010 — and Waller's are the ones the field uses (jisho.org reads them too).
They are CC BY. Taken here through stephenmk/yomitan-jlpt-vocab (CC BY-SA 4.0),
which keeps Waller's levels and modernises a handful of spellings (歯磨 →
歯磨き). Grammar is free — particles, auxiliaries, punctuation — and a word no
list has counts as above every level, which is what drops the names: トム is on
a fifth of Tatoeba and in no word list.

A word written in kanji is matched by its kanji, and one written in kana by
its kana. The asymmetry is on purpose: はし is a bridge and chopsticks, both
N5, and a homophone is only a problem when the spelling has been thrown away.
The one exception is a word Waller lists in kana only — あびる, not 浴びる —
which matches its kana whichever way the sentence writes it.

**One grammar gate, for the first pack.** Levelling by vocabulary alone would
put 食べられる in N5, because 食べる is N5 and られる is grammar. The passive,
causative and potential auxiliaries and the conditional ば are N4 grammar in
every syllabus, so a sentence using one is filed no lower than N4. Every other
grammar point is left to the reading pass.

**Every item carries its reading in kana, spaced by phrase.** See
`docs/echo.md`, _Japanese is named by JLPT_, for why kana and not romaji. The
reading is the whole sentence in kana: hiragana for anything written in kanji,
katakana left as katakana, spaced between bunsetsu the way a children's book
or the first chapters of a textbook are (わたしは がくせいです。). The spaces are
the one thing the sentence does not show and a beginner most needs.

**Two readings, and a person's wins.** UniDic reads 私 as わたくし and 日本 as
にっぽん, which a dictionary may and a beginner's card should not. Tatoeba
holds a furigana transcription for almost every Japanese sentence, and 108,259
of them carry the name of the member who wrote or corrected it. Where that
person's reading disagrees with UniDic's, the person's is used, and every
token where the two disagree is written into `review.readingDiffers` — the
first place the reading pass looks. Where nobody has signed the transcription,
it is Tatoeba's own machine draft, and a sentence is taken only if that draft
and UniDic agree on every word: two machines agreeing is weak evidence, one
alone was measured as worse (その箱 read そのばこ, 土曜日 どようひ). `kana.py`
is how the two are lined up.

**Glosses are Tatoeba's, direct first**, exactly as for Mandarin: a column with
no direct translation takes the translation of the English gloss, and
`review.indirect` names it.

Usage (from the repository root, with the inputs downloaded once — see
`--data` below):

    python3.12 -m venv .venv && .venv/bin/pip install fugashi==1.5.2 unidic-lite==1.0.8 jaconv==0.5.0
    .venv/bin/python tools/echo-content/jlpt/pick.py --data ./jlpt-data --out content/echo/ja
    pnpm prettier --write 'content/echo/ja/*.json'

With `--candidates <file>` it writes the pool instead of the packs: the first
`--pool` sentences of each level, for choosing cue pictures. With
`--cues tools/echo-content/images/cues.ja.json` it takes, per level, the first
`--limit` sentences that have a cue — a sentence with no honest picture is not
taken, and the next one is.

`--data` holds:

- `jlpt-n1.csv` … `jlpt-n5.csv`: `original_data/n<n>.csv` from
  https://github.com/stephenmk/yomitan-jlpt-vocab at commit b062d4e
  (Waller's lists, CC BY; the repository CC BY-SA 4.0).
- `jpn_sentences.tsv`, and `jpn-<code>_links.tsv` for each locale's code, from
  https://downloads.tatoeba.org/exports/per_language/jpn/ (decompressed).
- `<code>_sentences.tsv` for each locale's code, and `eng-<code>_links.tsv`,
  from the same place.
- `transcriptions.csv`, from
  https://downloads.tatoeba.org/exports/transcriptions.tar.bz2.

Writes `jlptN5.json` … into `--out`, `"reviewed": false`, which the seed
refuses until somebody has read them.
"""

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import fugashi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kana import align, hira, is_kana, spoken  # noqa: E402

#: Interface locale → Tatoeba code. The eight the app speaks; Japanese is not one.
LOCALES = {
    "en": "eng",
    "tr": "tur",
    "de": "deu",
    "es": "spa",
    "fr": "fra",
    "pt-BR": "por",
    "ru": "rus",
    "ar": "ara",
}

#: JLPT N-level → our scale. Mirrors `jlptLanguageLevel` in
#: `packages/shared/src/echoPacks.ts`, which goes through CEFR the way HSK does.
LEVELS = {5: "absoluteBeginner", 4: "beginner", 3: "intermediate", 2: "intermediate", 1: "fluent"}

#: Counted in UniDic short units, punctuation aside: 飲みませんか is four.
MIN_WORDS = 3
MAX_WORDS = 12
#: Characters, for the card and for the production card: typed back through an
#: input method, so a kana is a keystroke or two and a kanji a conversion.
MAX_CHARS = 20

#: Kana, kanji, the iteration mark and the punctuation a pack sentence may carry.
#: No digits and no Latin: a digit is read by a rule nobody reviews, and a
#: Latin letter is a name or a brand.
ALLOWED = re.compile("^[ぁ-ゟ゠-ヿ一-鿿々ー、。？！]+$")
ENDS = "。？！"
PUNCT = "、。？！"

#: Never a word to level: grammar, and the marks around it.
FREE = {"助詞", "助動詞", "補助記号", "空白"}
#: N4 grammar in every syllabus, by UniDic lemma: the passive, causative and
#: potential auxiliaries, and the conditional ば.
N4_GRAMMAR = {("助動詞", "れる"), ("助動詞", "られる"), ("助動詞", "せる"), ("助動詞", "させる"), ("助詞", "ば")}
#: The honorific prefix お/ご is grammar too; the word it is on is levelled.
PREFIX = "接頭辞"

#: Where UniDic's first reading is the formal or the rare one and a beginner's
#: card wants the everyday one. Applied before Tatoeba's reading is compared,
#: so a person who wrote the formal one on purpose still wins.
READING = {"私": "わたし", "日本": "にほん", "明日": "あした", "何故": "なぜ"}

#: 何 is なに before these and UniDic says なん before everything: 何が, 何も,
#: 何か. Before だ, の, で and a counter it is なん, which UniDic already says.
NANI_BEFORE = {"が", "を", "も", "か", "に", "から", "まで", "より", "や"}

#: Two words Waller files above N5 that every first lesson teaches: Japan (N3
#: on his list) and thank you (N1, under the kanji 有難う nobody writes). The
#: only levels here that are not his.
LEVEL = {"日本": 5, "ありがとう": 5}

SOURCES = [
    {"name": "Tatoeba", "licence": "CC BY 2.0 FR", "url": "https://tatoeba.org/"},
    {
        "name": "JLPT word lists (Jonathan Waller, via stephenmk/yomitan-jlpt-vocab)",
        "licence": "CC BY (lists); CC BY-SA 4.0 (repository)",
        "url": "https://github.com/stephenmk/yomitan-jlpt-vocab",
    },
    {"name": "UniDic (unidic-lite)", "licence": "BSD-3-Clause", "url": "https://github.com/polm/unidic-lite"},
]


def load_jlpt(data):
    """
    Three lookups: kanji spelling → level, kana → level for a word Waller lists
    in kana only, and kana → level for any word (used only for a token the
    sentence itself writes in kana). A word on two lists takes the easier level.
    """
    by_kanji, kana_only, by_kana = {}, {}, {}

    def put(table, key, level):
        if key:
            table[key] = max(table.get(key, 0), level)

    for level in range(1, 6):
        with open(data / f"jlpt-n{level}.csv", encoding="utf8") as handle:
            for row in csv.DictReader(handle):
                kana, kanji = row["kana"].strip(), row["kanji"].strip()
                put(by_kana, hira(kana), level)
                if kanji:
                    put(by_kanji, kanji, level)
                else:
                    put(kana_only, hira(kana), level)
    return by_kanji, kana_only, by_kana


def token(word):
    f = word.feature
    return {
        "surface": word.surface,
        "pos1": f.pos1,
        "pos2": f.pos2,
        "pos3": f.pos3,
        "lemma": (f.lemma or "").split("-")[0],
        "orthBase": f.orthBase or "",
        "kanaBase": hira(f.kanaBase or ""),
        "kana": READING.get(word.surface) or hira(f.kana or ""),
        "pron": hira(f.pron or ""),
        "unknown": word.is_unk,
    }


def level_of(tok, jlpt):
    """The JLPT level of one token, 6 for grammar, None for a word no list has."""
    by_kanji, kana_only, by_kana = jlpt
    if tok["pos1"] in FREE or tok["pos1"] == PREFIX:
        return 6
    if tok["surface"] in LEVEL:
        return LEVEL[tok["surface"]]
    found = [by_kanji.get(form) for form in (tok["orthBase"], tok["lemma"], tok["surface"])]
    found.append(kana_only.get(tok["kanaBase"]))
    if is_kana(tok["surface"]):
        found += [by_kana.get(hira(tok["orthBase"])), by_kana.get(tok["kanaBase"])]
    found = [level for level in found if level]
    return max(found) if found else None


def transcription(markup):
    """Tatoeba's furigana markup — `[私|わたし]は[学生|がく|せい]` — as plain kana."""
    # Neither group may contain "[": the markup never nests, and letting a group
    # run over an opening bracket is what made this regex backtrack polynomially.
    return re.sub(r"\[([^|\[\]]+)\|([^\[\]]+)\]", lambda m: m.group(2).replace("|", ""), markup)


def joins(prev, tok):
    """Whether `tok` continues the phrase `prev` is in rather than starting one."""
    if prev is None:
        return False
    if tok["pos1"] in ("助詞", "助動詞", "接尾辞", "補助記号"):
        return True
    # お茶, ご飯. Only the honorific: UniDic also files 今 in 今空港 as a prefix.
    if prev["pos1"] == PREFIX and prev["surface"] in ("お", "ご", "御"):
        return True
    # 勉強する: the verb of a noun that takes する is one phrase with it. And
    # どうして, which UniDic reads as どう + して and every reader as one word.
    if tok["lemma"] == "為る" and prev["pos1"] == "名詞" and prev["pos3"] == "サ変可能":
        return True
    if tok["lemma"] == "為る" and prev["surface"] == "どう":
        return True
    # おいしくない, 高くない: the negative of an adjective reads as one word.
    if tok["pos1"] == "形容詞" and tok["pos2"] == "非自立可能" and prev["pos1"] in ("形容詞", "助動詞"):
        return True
    # 食べなさい, 降り始める: a verb that only finishes another verb's stem.
    # After て it is a phrase of its own (して いる), and て is a particle.
    if tok["pos1"] == "動詞" and tok["pos2"] == "非自立可能" and prev["pos1"] == "動詞":
        return True
    # 日本語, 東京駅, 月曜日: nouns run together — always when the second is
    # one character, a suffix in all but name — unless either is a time word
    # or a count standing alone (明日 学校に, 一回 最初から, 誕生日 プレゼント).
    if tok["pos1"] == "名詞" and prev["pos1"] == "名詞":
        if len(tok["surface"]) == 1:
            return True
        # 私のこと 嫌いなの: a word like こと or もの ends the phrase it is in.
        if prev["surface"] in ("こと", "もの", "とき", "ところ", "ほう", "方"):
            return False
        return "副詞可能" not in (prev["pos3"], tok["pos3"]) and prev["pos3"] != "助数詞可能"
    return False


def reading_of(toks, spans):
    """The sentence in kana, spaced between phrases. `spans` is each token's kana."""
    out = ""
    for index, (tok, span) in enumerate(zip(toks, spans)):
        if tok["pos1"] == "補助記号":
            out += tok["surface"]
            continue
        piece = tok["surface"] if is_kana(tok["surface"]) else span
        if out and not joins(toks[index - 1], tok) and out[-1] not in PUNCT:
            out += " "
        out += piece
    return out


def read_tsv(path, columns):
    with open(path, encoding="utf8") as handle:
        for line in handle:
            cells = line.rstrip("\n").split("\t")
            if len(cells) >= columns:
                yield cells


def shape(text):
    """Near-duplicates: Tatoeba holds 行こう。 and 行こう！ separately."""
    return re.sub(f"[{PUNCT}]", "", text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--levels", default="5,4", help="JLPT N-levels to draft, e.g. 5,4,3")
    parser.add_argument("--limit", type=int, default=300)
    parser.add_argument("--pool", type=int, default=700)
    parser.add_argument("--candidates", type=Path, help="write the pool here instead of packs")
    parser.add_argument("--cues", type=Path, help="cues.ja.json: take only sentences with a cue")
    args = parser.parse_args()
    data = args.data
    levels = [int(n) for n in args.levels.split(",")]

    jlpt = load_jlpt(data)
    tagger = fugashi.Tagger()

    transcribed = {}
    for cells in read_tsv(data / "transcriptions.csv", 5):
        if cells[1] == "jpn":
            transcribed[cells[0]] = (transcription(cells[4]), cells[3])

    candidates, stats = {}, {"read": 0, "shape": 0, "unknown": 0, "unlisted": 0, "length": 0, "align": 0}
    for sid, _, text in read_tsv(data / "jpn_sentences.tsv", 3):
        text = text.strip()
        stats["read"] += 1
        if not text or text[-1] not in ENDS or len(text) > MAX_CHARS or not ALLOWED.match(text):
            stats["shape"] += 1
            continue
        toks = [token(word) for word in tagger(text)]
        for tok, after in zip(toks, toks[1:]):
            if tok["surface"] == "何" and after["surface"] in NANI_BEFORE:
                tok["kana"] = "なに"
        if any(tok["unknown"] for tok in toks):
            stats["unknown"] += 1
            continue
        words = [tok for tok in toks if tok["pos1"] != "補助記号"]
        if not MIN_WORDS <= len(words) <= MAX_WORDS:
            stats["length"] += 1
            continue
        found = [level_of(tok, jlpt) for tok in words]
        if None in found:
            stats["unlisted"] += 1
            continue
        level = min(found)
        if level == 5 and any((tok["pos1"], tok["lemma"]) in N4_GRAMMAR for tok in words):
            level = 4
        if level not in levels:
            continue

        # The reading: UniDic's, unless a person on Tatoeba wrote another.
        own = [tok["kana"] if not is_kana(tok["surface"]) else hira(tok["surface"]) for tok in toks]
        spans, differs, source = own, [], "unidic"
        if sid in transcribed:
            theirs, person = transcribed[sid]
            lined = align([(tok["surface"], tok["kana"]) for tok in toks], theirs)
            # Two neighbours that both disagree is almost always one word UniDic
            # split where the person did not — 昨日本 as 昨 + 日本 — and the
            # spans then straddle the boundary (日本 → じつほん). Rare, and
            # not worth a reading somebody has to untangle.
            flags = [changed for _, changed in lined] if lined else []
            if lined is None or any(a and b for a, b in zip(flags, flags[1:])):
                stats["align"] += 1
                continue
            differs = [
                f"{tok['surface']}: {tok['kana']} → {span}"
                for tok, (span, changed) in zip(toks, lined)
                if changed
            ]
            if person:
                spans, source = [span for span, _ in lined], "tatoeba"
        # With no person behind either reading, two machines must agree. The
        # first draft took UniDic alone here, and the cue pass found what that
        # costs: その箱 as そのばこ, 土曜日 as どようひ, 御茶 as ごちゃ — each a
        # word UniDic split and then read in pieces.
        if source == "unidic" and (sid not in transcribed or differs):
            stats["align"] += 1
            continue
        candidates[sid] = {
            "text": text,
            "level": level,
            "tokens": toks,
            "words": [tok["lemma"] or tok["surface"] for tok in words if tok["pos1"] not in FREE],
            "reading": reading_of(toks, spans),
            "readingFrom": source,
            "readingDiffers": differs,
        }
    print(f"Tatoeba: {stats['read']} sentences; dropped {stats}", file=sys.stderr)
    print(f"candidates at N{levels}: {len(candidates)}", file=sys.stderr)

    # Direct translations: the first one Tatoeba lists, per locale.
    direct = {}
    for locale, code in LOCALES.items():
        wanted = {}
        for cells in read_tsv(data / f"jpn-{code}_links.tsv", 2):
            if cells[0] in candidates:
                wanted.setdefault(cells[1], []).append(cells[0])
        for tid, _, text in read_tsv(data / f"{code}_sentences.tsv", 3):
            for sid in wanted.get(tid, []):
                direct.setdefault(sid, {}).setdefault(locale, {"id": tid, "text": text.strip()})

    by_level = {level: [] for level in levels}
    seen = set()
    for sid, cand in candidates.items():
        gloss = direct.get(sid, {})
        if "en" not in gloss or shape(cand["text"]) in seen:
            continue
        seen.add(shape(cand["text"]))
        cand["gloss"] = gloss
        by_level[cand["level"]].append(cand)

    def difficulty(cand):
        lexical = [tok for tok in cand["tokens"] if tok["pos1"] != "補助記号"]
        return (len(lexical), len(cand["text"]), cand["text"])

    # Which get in: best covered, then a person's reading over a machine's,
    # then easiest. Which order: easiest.
    pools = {}
    for level, pool in by_level.items():
        pool.sort(key=lambda c: (-len(c["gloss"]), c["readingFrom"] != "tatoeba") + difficulty(c))
        pools[level] = pool
        print(f"N{level}: {len(pool)} glossed in English", file=sys.stderr)

    if args.candidates:
        rows = [
            {
                "level": level,
                "text": c["text"],
                "reading": c["reading"],
                "en": c["gloss"]["en"]["text"],
                "readingFrom": c["readingFrom"],
                "readingDiffers": c["readingDiffers"],
            }
            for level, pool in pools.items()
            for c in pool[: args.pool]
        ]
        args.candidates.write_text(json.dumps(rows, ensure_ascii=False, indent=1), "utf8")
        print(f"wrote {len(rows)} candidates to {args.candidates}", file=sys.stderr)
        return

    cues = json.loads(args.cues.read_text("utf8")) if args.cues else None
    chosen = {}
    for level, pool in pools.items():
        taken = [c for c in pool if cues is None or cues.get(c["text"])]
        chosen[level] = sorted(taken[: args.limit], key=difficulty)
        print(f"N{level}: {len(taken)} with a cue, {len(chosen[level])} taken", file=sys.stderr)

    # The columns direct links left empty, from the English gloss's translations.
    english = {c["gloss"]["en"]["id"]: c for picked in chosen.values() for c in picked}
    for locale, code in LOCALES.items():
        if locale == "en":
            continue
        wanted = {}
        for cells in read_tsv(data / f"eng-{code}_links.tsv", 2):
            cand = english.get(cells[0])
            if cand and locale not in cand["gloss"]:
                wanted.setdefault(cells[1], []).append(cand)
        for tid, _, text in read_tsv(data / f"{code}_sentences.tsv", 3):
            for cand in wanted.get(tid, []):
                if locale not in cand["gloss"]:
                    cand["gloss"][locale] = {"id": tid, "text": text.strip(), "indirect": True}

    args.out.mkdir(parents=True, exist_ok=True)
    for level, picked in chosen.items():
        items = []
        for index, cand in enumerate(spread(picked)):
            indirect = sorted(k for k, v in cand["gloss"].items() if v.get("indirect"))
            items.append(
                {
                    "index": index,
                    "kind": "phrase",
                    "text": cand["text"],
                    "reading": cand["reading"],
                    "gloss": {
                        k: v["text"]
                        for k, v in sorted(cand["gloss"].items(), key=lambda kv: list(LOCALES).index(kv[0]))
                    },
                    "review": {
                        "words": " ".join(cand["words"]),
                        "readingFrom": cand["readingFrom"],
                        **({"readingDiffers": cand["readingDiffers"]} if cand["readingDiffers"] else {}),
                        **({"indirect": indirect} if indirect else {}),
                    },
                }
            )
        pack = {
            "id": f"ja:jlptN{level}",
            "lang": "ja",
            "level": LEVELS[level],
            "jlpt": level,
            "contentVersion": 1,
            "reviewed": False,
            "sources": SOURCES,
            "items": items,
        }
        path = args.out / f"jlptN{level}.json"
        path.write_text(json.dumps(pack, ensure_ascii=False) + "\n", "utf8")
        print(f"wrote {path}: {len(items)} items", file=sys.stderr)


def opening(text):
    """What `packContent.test.ts` calls a sentence's first word: its first run of letters."""
    return re.match(r"[^、。？！]+", text).group(0)


def spread(items):
    """
    Keeps neighbours from opening with the same word: the first lexical
    token, and the first run of letters, which is what the content test reads
    and which in Japanese is the whole first clause.
    """
    def first(c):
        return next((t["surface"] for t in c["tokens"] if t["pos1"] not in FREE), "")

    out, rest = [], list(items)
    while rest:
        last = out[-1] if out else None
        pick = next(
            (
                i
                for i, c in enumerate(rest)
                if last is None or (first(c) != first(last) and opening(c["text"]) != opening(last["text"]))
            ),
            0,
        )
        out.append(rest.pop(pick))
    return out


if __name__ == "__main__":
    main()
