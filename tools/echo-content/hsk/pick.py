"""
Drafts the six Mandarin packs, one per HSK 2.0 level, from Tatoeba.

A pack is phrases at every level, and this is the same pipeline as
`pick-phrases.mjs` with the two things Chinese does not share with the
languages before it.

**There are no spaces, so there are no words until somebody draws them.**
`pick-phrases.mjs` finds a phrase's words with `[\\p{L}']+`, which on a Chinese
sentence answers with the whole clause. Here a sentence is segmented against
the HSK list itself: the fewest HSK words that spell it, and among those the
easiest. Fewest first, because that is how a reader groups it — 大家 is
*everyone* at HSK 2, and splitting it into 大 and 家 to call the sentence HSK 1
would be a lie the level label then tells. A sentence that cannot be spelled in
HSK words at all is dropped, which is also what removes the names: 汤姆 is on
a fifth of Tatoeba and in no word list.

The method has one blind spot: a word the list does not have, spelled with
characters it does, passes as those characters — 少年 would read as 少 and 年.
jieba (MIT) is asked for a second opinion, and a sentence carrying a noun or an
idiom it knows and the list does not is dropped; any other disagreement is
written into `review.unlisted` for the reading pass. See `unlisted`.

**The level is HSK's, not a frequency band.** Every other language outside
English is levelled by frequency because nothing better is licensed; Chinese has
a published syllabus, and the list used here is MIT. A sentence belongs to the
level of its hardest word, exactly as elsewhere.

**Every item carries its pinyin**, grouped into the words a reader sees —
`Wǒ bú shì xuésheng.` rather than a syllable at a time. A word the list has
one reading for takes the list's, because the list is what carries the neutral
tones (朋友 is *péngyou*; pypinyin says *péngyǒu*). Everything else is
pypinyin's (MIT), which reads the sentence whole and so knows 睡觉 from 觉得,
with three particles and the 不/一 tone changes decided by rules here. It is
still wrong sometimes, and a wrong reading is on a card, so the reading pass
reads this column too.

**Glosses are Tatoeba's, direct first.** Turkish has 1,254 direct links into
Mandarin and Arabic 152, so direct-only would leave those two columns nearly
empty. Where a locale has no direct translation, the translation of the English
gloss is taken instead, and the item's `review.indirect` names every column
that came that way: it is a translation of a translation, written by a person
both times, and it is the first place the reading looks.

Usage (from the repository root, with the inputs downloaded once — see
`--data` below):

    python3 -m venv .venv && .venv/bin/pip install pypinyin jieba
    .venv/bin/python tools/echo-content/hsk/pick.py --data ./hsk-data --out content/echo/zh
    pnpm prettier --write 'content/echo/zh/*.json'

`--data` holds:

- `old-1.json` … `old-6.json`: `wordlists/exclusive/old/<n>.json` from
  https://github.com/drkameleon/complete-hsk-vocabulary (MIT), whose HSK 2.0
  levels are https://github.com/clem109/hsk-vocabulary (MIT).
- `cmn_sentences.tsv`, and `cmn-<code>_links.tsv` for each locale's code, from
  https://downloads.tatoeba.org/exports/per_language/cmn/ (decompressed).
- `<code>_sentences.tsv` for each locale's code, and `eng-<code>_links.tsv`,
  from the same place.
- `cmn_transcriptions.tsv`: the `cmn` rows of
  https://downloads.tatoeba.org/exports/transcriptions.tar.bz2 — read for one
  thing only, which script a sentence is written in.

Writes `hsk1.json` … `hsk6.json` into `--out`, `"reviewed": false`, which the
seed refuses until somebody has read them.
"""

import argparse
import json
import re
from pathlib import Path

import jieba
import jieba.posseg as pseg
from pypinyin import Style, pinyin

#: Interface locale → Tatoeba code. The eight the app speaks; Chinese is not one.
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

#: HSK 2.0 was published against CEFR A1–C2, one band per level. Mirrors
#: `hskLanguageLevel` in `packages/shared/src/echoPacks.ts`.
LEVELS = {
    1: "absoluteBeginner",
    2: "beginner",
    3: "intermediate",
    4: "intermediate",
    5: "fluent",
    6: "fluent",
}

#: A sentence long enough to carry a pattern and short enough to read on a card.
#: Counted in HSK words, the unit the level is counted in.
MIN_WORDS = 3
MAX_WORDS = 8
#: Characters, for the production card: typed back through an input method.
MAX_CHARS = 16

HAN = re.compile("[\u4e00-\u9fff]")
#: Full-width sentence punctuation, and the only non-Han characters allowed.
PUNCT = "。，？！、：；“”"
ENDS = "。？！"
#: How the reading writes each mark. Pinyin is Latin script and takes Latin
#: punctuation; the enumeration comma has no Latin counterpart but the comma.
PUNCT_LATIN = {"。": ".", "，": ",", "？": "?", "！": "!", "、": ",", "：": ":", "；": ";", "“": '"', "”": '"'}

SOURCES = [
    {"name": "Tatoeba", "licence": "CC BY 2.0 FR", "url": "https://tatoeba.org/"},
    {
        "name": "HSK 2.0 word lists (clem109/hsk-vocabulary, via drkameleon/complete-hsk-vocabulary)",
        "licence": "MIT",
        "url": "https://github.com/drkameleon/complete-hsk-vocabulary",
    },
    {"name": "pypinyin", "licence": "MIT", "url": "https://github.com/mozillazg/python-pinyin"},
]


def load_hsk(data):
    """
    Word → (level, frequency rank), and word → its pinyin readings. No word is
    listed at two levels.
    """
    words, forms = {}, {}
    for level in range(1, 7):
        for entry in json.loads((data / f"old-{level}.json").read_text("utf8")):
            words.setdefault(entry["simplified"], (level, entry.get("frequency") or 99999))
            forms.setdefault(entry["simplified"], [f["transcriptions"]["pinyin"] for f in entry["forms"]])
    return words, forms


def cuts_of(text):
    """Where jieba ends a word, as character offsets into `text`."""
    cuts, offset = set(), 0
    for piece in jieba.lcut(text, HMM=False):
        offset += len(piece)
        cuts.add(offset)
    return cuts


def segment(clause, words, cuts):
    """
    The fewest HSK words that spell `clause`, easiest among equals; None if no
    spelling exists.

    A plain dynamic programme over the characters: `best[i]` is the best
    spelling of the first `i`, compared as (word count, hardest level).

    **Not across a boundary jieba draws**, when `cuts` holds them. Fewest-words
    alone reads 把手举起来 as 把手 (*a handle*) and 想要点蛋糕 as 要点 (*a main
    point*): real words, in the list, and not what the sentence says — and each
    one also moved the sentence up to the level of a word it does not contain.
    `tokens` asks both ways.
    """
    longest = max(len(word) for word in words)
    best = [None] * (len(clause) + 1)
    best[0] = (0, 0, [])
    for end in range(1, len(clause) + 1):
        for start in range(max(0, end - longest), end):
            if best[start] is None:
                continue
            piece = clause[start:end]
            if piece not in words or any(start < cut < end for cut in cuts):
                continue
            count, hardest, pieces = best[start]
            candidate = (count + 1, max(hardest, words[piece][0]), pieces + [piece])
            if best[end] is None or candidate[:2] < best[end][:2]:
                best[end] = candidate
    return best[-1][2] if best[-1] else None


#: What a measure word follows. 个人 is *an individual* (HSK 5), but in 一个人,
#: 这个人 and 数百个人 it is 个 and 人 — and jieba keeps 一个人 as one token, so the
#: boundary rule above cannot see it.
COUNTED_AFTER = set("零一二三四五六七八九十百千万两几这那哪每各有")


def tokens(text, words):
    """The sentence as HSK words and punctuation marks, or None."""
    out, offset = [], 0
    cuts = cuts_of(text)
    for part in re.split(f"([{PUNCT}])", text):
        if not part:
            continue
        if part in PUNCT:
            out.append(part)
            offset += len(part)
            continue
        if not all(HAN.match(ch) for ch in part):
            return None
        inside = {cut - offset for cut in cuts if offset < cut < offset + len(part)}
        # Both ways, and the easier wins. jieba is wrong sometimes too — it cuts
        # 一起来 as 一 and 起来 — and a wrong spelling of a sentence almost always
        # costs it a level: 把手, 要点 and 起来 are all harder than their pieces.
        spellings = [p for p in (segment(part, words, inside), segment(part, words, set())) if p]
        if not spellings:
            return None
        pieces = min(spellings, key=lambda p: max(words[w][0] for w in p))
        out.extend(pieces)
        offset += len(part)
    for index, tok in enumerate(out):
        if tok == "个人" and index > 0 and out[index - 1][-1] in COUNTED_AFTER:
            out[index : index + 1] = ["个", "人"]
    return out


FOURTH = set("àèìòùǜ")
MARKED = set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ")
PLAIN = str.maketrans("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ", "aaaaeeeeiiiioooouuuuüüüü")
NUMERALS = set("零一二三四五六七八九十百千万两第")
#: Before these, 得 is the modal *děi* (你得去); after a verb it is *de* (跑得快).
MODAL_BEFORE = {"我", "你", "他", "她", "它", "您", "我们", "你们", "他们", "她们", "咱们", "大家", "就", "还", "也", "都"}
#: Subjects and adverbs, after which 过 is the verb *guò* (他过马路) rather than
#: the aspect particle *guo* (我吃过).
NOT_A_VERB = MODAL_BEFORE | {"不", "没", "别", "要", "想", "会", "能", "请", "快"}
#: The complements 不 goes neutral in front of: 找不到, 受不了, 看不起.
POTENTIAL = set("到了起懂完住够动见")
#: Verbs whose doubling softens the second syllable: 看看 is *kànkan*.
DOUBLED = set("看听试等谈想走说问找坐尝猜读写学玩")
#: Never joined to a neighbour on jieba's say-so: pronouns, particles, numerals
#: and the adverbs that sit in front of anything. jieba's dictionary holds
#: phrases — 我爱你, 太好了 — and a reading that wrote *Wǒàinǐ* would teach a
#: word that is not one. 喝 is here because the reading pass kept undoing
#: *hēchá* and *hēshuǐ*.
UNJOINED = set("我你他她它您们的地得了着过吗呢吧啊呀嘛是在不没很太也都就还又再才一二三四五六七八九十两个这那哪几本张只条件位次块岁杯喝")
#: One word in every pinyin text a learner will meet, though the list files the
#: pieces apart: 没有 is *méiyǒu*, 一下 *yíxià*.
JOINED = {
    "没有", "这里", "那里", "哪里", "这个", "那个", "哪个", "这些", "那些", "哪些",
    "这样", "那样", "一下", "一些", "一点", "有点", "有些",
}
#: How jieba tags a name, which pinyin writes as one capitalised word: *Rìběn*.
NAMES = {"nr", "ns", "nt", "nz"}


def word_syllables(tok, guess, prev, nxt, forms):
    """
    One word's syllables.

    **The word list's own pinyin first, where it has one reading.** It is what
    carries the neutral tones — 朋友 is *péngyou*, 喜欢 *xǐhuan* — which
    pypinyin prints as full tones, and a learner copies the tone they are shown.

    **Where the list has several, pypinyin chooses** — it reads the sentence
    whole, so it knows 长大 from 很长 — and where two of the list's readings
    differ only by a neutral tone, the neutral one wins: 东西 is *dōngxi* far
    more often than *east and west*, 告诉 is *gàosu*, 地方 *dìfang*.

    A handful of single characters are decided here instead, because pypinyin
    gets each wrong often enough that the reading pass of the first draft kept
    finding them: 的 as *dī*, the adverbial 地 as *dì*, the modal 得 as *dé*,
    the measure word 只 as *zhǐ*, *teach* 教 as *jiào*, the particles 着 and 过
    with full tones.
    """
    if tok == "的":
        return ["de"]
    if tok == "地":
        # 简单地说: the adverbial 地 follows a word of two syllables or more.
        return ["de"] if prev and len(prev) > 1 and nxt else ["dì"]
    if tok == "得":
        return ["děi"] if prev in MODAL_BEFORE and nxt else ["de"]
    if tok == "只" and prev and prev[-1] in COUNTED_AFTER - set("这那哪有"):
        # 两只狗 is *zhī*; 这只是 is *this is only*, and pypinyin already knows.
        return ["zhī"]
    if tok == "教":
        return ["jiāo"]
    if tok == "着" and nxt not in ("火", "急", "凉"):
        return ["zhe"]
    if tok == "过" and prev and prev not in NOT_A_VERB | {"错"} and nxt not in ("来", "去"):
        return ["guo"]
    if tok == "了":
        return ["liǎo"] if prev in ("不", "得") else ["le"]
    listed = list(dict.fromkeys(forms.get(tok, [])))
    readings = list(dict.fromkeys(form.lower() for form in listed))
    if len(readings) == 1:
        # The list files the surname beside the word — 高 as *Gāo* and *gāo*,
        # 钱 as *Qián* and *qián* — and the word is what a sentence means.
        lower = [form for form in listed if form == form.lower()]
        return (lower or listed)[0].split(" ")
    plain = " ".join(guess).translate(PLAIN)
    # Only past the first syllable: 哪 has a neutral *na* in the list, and it is
    # never the one a sentence asking *which* wants.
    softer = [
        r
        for r in readings
        if len(tok) > 1
        and r != " ".join(guess)
        and r.translate(PLAIN) == plain
        and r.split(" ")[0] == guess[0]
    ]
    if softer and sum(not set(syl) & MARKED for syl in softer[0].split(" ")) > sum(
        not set(syl) & MARKED for syl in guess
    ):
        return softer[0].split(" ")
    return list(guess)


def sandhi(ch, before, after):
    """
    不 and 一 as they are said, which is how a textbook prints them.

    不 rises before a fourth tone. 一 rises before a fourth tone and falls before
    the others, except where it is a number being counted rather than *a* —
    第一, 十一 — and at the end of a clause.
    """
    if ch == "不":
        return "bú" if after and any(c in FOURTH for c in after) else "bù"
    if not after or (before and before in NUMERALS):
        return "yī"
    rises = any(c in FOURTH for c in after) or not any(c in MARKED for c in after)
    return "yí" if rises else "yì"


def separate(syllable):
    """
    A syllable that opens with a vowel, inside a word, takes an apostrophe:
    恋爱 is *liàn'ài*, which without it reads as *lià nài*.
    """
    return "'" + syllable if syllable[:1].lower() in "aāáǎàoōóǒòeēéěè" else syllable


def reading(text, toks, forms):
    """
    Pinyin, one space-separated group per word, first letter capitalised.

    Grouped by the HSK words, which is what the level was counted in, and joined
    where a reader would join them: two single-character words jieba calls one
    word (回来 is *huílái*, 看到 *kàndào*) unless either is in `UNJOINED`, the
    words in `JOINED`, numbers (十八 is *shíbā*), the days of the week, a
    doubled verb, and a name.
    """
    base = [s[0] for s in pinyin(text, style=Style.TONE, errors=lambda chars: list(chars))]
    starts, i = [], 0
    for tok in toks:
        starts.append(i)
        i += len(tok)

    def neighbour(index, step):
        j = index + step
        return toks[j] if 0 <= j < len(toks) and toks[j] not in PUNCT else None

    syllables = {}
    for index, tok in enumerate(toks):
        if tok not in PUNCT:
            guess = base[starts[index] : starts[index] + len(tok)]
            syllables[index] = word_syllables(tok, guess, neighbour(index, -1), neighbour(index, 1), forms)

    # A second pass, because 一 and 不 depend on the syllable after them — and
    # the list prints 一起 as *yī qǐ* and 不客气 as *bù kè qi*, so words too.
    for index, tok in enumerate(toks):
        if tok in PUNCT:
            continue
        prev, nxt = neighbour(index, -1), neighbour(index, 1)
        current = syllables[index]
        if tok == "不" and prev and nxt and (prev == nxt or (nxt in POTENTIAL and prev not in NOT_A_VERB)):
            # 买不买, 找不到: neutral, and not a tone that sandhi could change.
            current[0] = "bu"
            continue
        for k, ch in enumerate(tok):
            # A neutral 不 (对不起, *duì bu qǐ*) is already what is said.
            if ch not in "一不" or not any(c in MARKED for c in current[k]):
                continue
            if k + 1 < len(tok):
                after = current[k + 1]
            else:
                after = syllables[index + 1][0] if nxt else None
            before = tok[k - 1] if k else (toks[index - 1][-1] if prev else None)
            current[k] = sandhi(ch, before, after)
        if tok in DOUBLED and prev == tok:
            current[0] = current[0].translate(PLAIN)

    pieces = _pieces(text)
    # A name is only a name when the list does not already know the word: jieba
    # tags 谢谢 and 明白 as names often enough to capitalise half a pack.
    names = [(start, start + len(piece)) for start, (piece, tag) in pieces if tag in NAMES and piece not in forms]
    phrases = {
        start + 1
        for start, (piece, _) in pieces
        if len(piece) == 2 and piece not in forms and not set(piece) & UNJOINED
    }

    def joins(index):
        prev = neighbour(index, -1)
        if prev is None:
            return False
        tok = toks[index]
        if prev + tok in JOINED:
            return True
        if all(ch in NUMERALS - {"第"} for ch in prev + tok) or (prev == "星期" and tok in NUMERALS | {"日", "天"}):
            return True
        if tok in DOUBLED and prev == tok:
            return True
        if len(tok) == 1 and len(prev) == 1 and starts[index] in phrases:
            return True
        # Inside a name jieba found: 日本 is 日 and 本 to the list.
        return any(start < starts[index] < end for start, end in names)

    out = ""
    for index, tok in enumerate(toks):
        if tok == "“":
            out += '"'
            continue
        if tok in PUNCT:
            out = out.rstrip() + PUNCT_LATIN[tok] + " "
            continue
        word = syllables[index]
        if joins(index):
            out = out.rstrip()
            word = [separate(word[0])] + word[1:]
        piece = "".join([word[0]] + [separate(syl) for syl in word[1:]])
        if any(start == starts[index] for start, _ in names):
            piece = piece[:1].upper() + piece[1:]
        out += piece + " "
    # A capital to open the sentence and each one after it: 来嘛！给我个机会。
    return re.sub(r'(^"?|[.?!] "?)(\w)', lambda m: m.group(1) + m.group(2).upper(), out.strip())


def _pieces(text):
    """jieba's words with their parts of speech, keyed by where each starts."""
    out, offset = [], 0
    for piece, tag in pseg.lcut(text, HMM=False):
        out.append((offset, (piece, tag)))
        offset += len(piece)
    return out


def unlisted(text, toks, words):
    """
    Words jieba sees that the list does not have, spelled here in HSK pieces,
    with the part of speech jieba gives them.

    The blind spot in the module docstring. Most of what this finds is a phrase
    jieba's dictionary happens to hold — 没有, 看到, 太好了 — and is exactly as
    easy as its pieces. A noun is not: 少年 is not 少 and 年, 日本 is not a day
    and a book, and a sentence carrying one is dropped (`main`). The rest is
    written into `review.unlisted` for the reviewer to judge.
    """
    bounds, i = set(), 0
    for tok in toks:
        i += len(tok)
        bounds.add(i)
    found, i = [], 0
    for piece, tag in pseg.lcut(text, HMM=False):
        start, i = i, i + len(piece)
        inside = any(b in bounds for b in range(start + 1, i))
        if len(piece) > 1 and piece not in words and inside:
            found.append((piece, tag))
    return found


def shape(text):
    """Near-duplicates: Tatoeba holds 我爱你。 and 我爱你！ separately."""
    return re.sub(f"[{PUNCT}]", "", text)


def read_tsv(path, columns):
    with open(path, encoding="utf8") as handle:
        for line in handle:
            cells = line.rstrip("\n").split("\t")
            if len(cells) >= columns:
                yield cells


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=300)
    args = parser.parse_args()
    data = args.data

    words, forms = load_hsk(data)
    print(f"HSK 2.0: {len(words)} words")

    # A sentence with a traditional alternative is written in simplified.
    simplified = {cells[0] for cells in read_tsv(data / "cmn_transcriptions.tsv", 3) if cells[2] == "Hant"}

    candidates = {}
    for sid, _, text in read_tsv(data / "cmn_sentences.tsv", 3):
        text = text.strip()
        if sid not in simplified or not text or text[-1] not in ENDS or len(text) > MAX_CHARS:
            continue
        toks = tokens(text, words)
        if toks is None:
            continue
        lexical = [tok for tok in toks if tok not in PUNCT]
        if not MIN_WORDS <= len(lexical) <= MAX_WORDS:
            continue
        found = unlisted(text, toks, words)
        # A noun or an idiom the list does not have is a word of its own, not
        # the sum of its characters — see `unlisted`.
        if any(tag[:1] in ("n", "i") for _, tag in found):
            continue
        level = max(words[tok][0] for tok in lexical)
        candidates[sid] = {
            "text": text,
            "tokens": toks,
            "level": level,
            "words": lexical,
            "unlisted": [piece for piece, _ in found],
        }
    print(f"Tatoeba: {len(candidates)} simplified sentences spelled in HSK words")

    # Direct translations: the first one Tatoeba lists, per locale.
    direct = {}
    for locale, code in LOCALES.items():
        wanted = {}
        for cells in read_tsv(data / f"cmn-{code}_links.tsv", 2):
            if cells[0] in candidates:
                wanted.setdefault(cells[1], []).append(cells[0])
        for tid, _, text in read_tsv(data / f"{code}_sentences.tsv", 3):
            for sid in wanted.get(tid, []):
                direct.setdefault(sid, {}).setdefault(locale, {"id": tid, "text": text.strip()})
    print(f"glossed in English: {sum(1 for g in direct.values() if 'en' in g)}")

    by_level = {level: [] for level in range(1, 7)}
    seen = set()
    for sid, cand in candidates.items():
        gloss = direct.get(sid, {})
        if "en" not in gloss or shape(cand["text"]) in seen:
            continue
        seen.add(shape(cand["text"]))
        cand["gloss"] = gloss
        by_level[cand["level"]].append(cand)

    # Which get in: best covered, then easiest. Which order: easiest.
    def difficulty(cand):
        rarest = max(words[w][1] for w in cand["words"])
        return (len(cand["words"]), rarest, cand["text"])

    chosen = {}
    for level, pool in by_level.items():
        pool.sort(key=lambda c: (-len(c["gloss"]),) + difficulty(c))
        chosen[level] = sorted(pool[: args.limit], key=difficulty)
        print(f"HSK {level}: {len(pool)} candidates, {len(chosen[level])} taken")

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
                    "reading": reading(cand["text"], cand["tokens"], forms),
                    "gloss": {k: v["text"] for k, v in sorted(cand["gloss"].items(), key=lambda kv: list(LOCALES).index(kv[0]))},
                    "freqRank": max(words[w][1] for w in cand["words"]),
                    "review": {
                        "words": " ".join(cand["words"]),
                        **({"unlisted": cand["unlisted"]} if cand["unlisted"] else {}),
                        **({"indirect": indirect} if indirect else {}),
                    },
                }
            )
        pack = {
            "id": f"zh:hsk{level}",
            "lang": "zh",
            "level": LEVELS[level],
            "hsk": level,
            "contentVersion": 1,
            "reviewed": False,
            "sources": SOURCES,
            "items": items,
        }
        (args.out / f"hsk{level}.json").write_text(json.dumps(pack, ensure_ascii=False), "utf8")
        print(f"wrote {args.out / f'hsk{level}.json'}: {len(items)} items")


def spread(items):
    """
    Keeps neighbours from opening with the same word — `order.mjs`'s greedy
    pass, with a word being the first HSK word rather than the first run of
    letters, which in Chinese is the whole clause.
    """
    out, rest = [], list(items)
    while rest:
        last = out[-1]["words"][0] if out else None
        pick = next((i for i, c in enumerate(rest) if c["words"][0] != last), 0)
        out.append(rest.pop(pick))
    return out


if __name__ == "__main__":
    main()
