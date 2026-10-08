"""
How a Japanese sentence's tokens line up with a kana reading of it.

Shared by `pick.py`, which drafts the reading, and `../tts/generate.py`, which
reads the pack aloud from it. Both have the same problem from opposite ends:
a tagger (fugashi over UniDic) splits the sentence and offers a reading for
each piece, and a second reading of the whole sentence exists that may
disagree with it — Tatoeba's furigana when drafting, the reviewed `reading`
when synthesising. Neither says which kana belong to which kanji.

**Kana anchor the alignment; kanji are where readings may differ.** A token
written in kana is read as it is written, so it must match the reading
exactly. A token with a kanji in it may take any span, at a cost of one when
the span is not the tagger's own reading, and the alignment is the one with
the fewest such tokens. Its okurigana constrain it too: 書き must end in き.
That is enough to make the answer unique on every sentence a pack holds — a
pack sentence is short and mostly kana.

`jaconv` (MIT) folds katakana to hiragana, so ケーキ in a reading and ケーキ
in the sentence compare equal whichever script either side used.
"""

import re
from functools import lru_cache

import jaconv

#: Kana, the long-vowel mark and the iteration marks a kana word can carry.
KANA = re.compile("^[ぁ-ゟ゠-ヿー]+$")
#: What a reading keeps besides kana, and what is ignored when comparing.
NOT_SPOKEN = re.compile("[\\s、。？！?!「」『』・…〜～ー]")
#: How far a kanji token's reading may stray from the tagger's, in kana.
SLACK = 4


def hira(text: str) -> str:
    return jaconv.kata2hira(text)


def is_kana(text: str) -> bool:
    return bool(KANA.match(text))


def spoken(text: str) -> str:
    """A reading as the string the alignment compares: hiragana, no spaces or marks.

    The long-vowel mark is dropped too, because a katakana word in a reading
    (コーヒー) and its tagger reading (コーヒー) agree on it, while a pron form
    (センセー) would not agree with the orthographic one (せんせい) — and only
    the orthographic one is ever compared.
    """
    return NOT_SPOKEN.sub("", hira(text))


def align(tokens, target):
    """
    Each token's kana inside `target`, and whether it differs from the token's own.

    `tokens` is a list of `(surface, kana)` — the token as written and the
    tagger's reading of it — and `target` a reading of the whole sentence.
    Returns a list of `(span, differs)` in token order, or None if no
    alignment exists (the reading spells a different sentence).
    """
    goal = spoken(target)
    pieces = [(surface, spoken(kana or surface)) for surface, kana in tokens]

    @lru_cache(maxsize=None)
    def best(index, at):
        if index == len(pieces):
            return (0, ()) if at == len(goal) else None
        surface, own = pieces[index]
        written = spoken(surface)
        if not written:
            # Punctuation: nothing to read.
            found = best(index + 1, at)
            return None if found is None else (found[0], (("", False),) + found[1])
        if is_kana(surface):
            if not goal.startswith(written, at):
                return None
            found = best(index + 1, at + len(written))
            return None if found is None else (found[0], ((written, False),) + found[1])
        options = []
        # The tagger's own reading first, so a tie keeps it.
        lengths = [len(own)] + [n for n in range(1, len(own) + SLACK + 1) if n != len(own)]
        head = re.match("^[ぁ-ゟ]*", hira(surface)).group(0)
        tail = re.search("[ぁ-ゟ]*$", hira(surface)).group(0)
        for n in lengths:
            span = goal[at : at + n]
            if len(span) < n or not span.startswith(head) or not span.endswith(tail):
                continue
            found = best(index + 1, at + n)
            if found is None:
                continue
            differs = span != own
            options.append((found[0] + int(differs), ((span, differs),) + found[1]))
        return min(options, key=lambda option: option[0]) if options else None

    found = best(0, 0)
    return None if found is None else list(found[1])
