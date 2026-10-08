"""
How well a speech recogniser understands Kokoro's Japanese: the measurement
behind which two voices read the Japanese packs, kept so it can be run again.

The Mandarin voices were chosen the same way (`docs/echo.md`, _Chinese is
named by HSK_): synthesise a sample of pack sentences, hand each reading to a
recogniser, and count how many characters come back. A recogniser is a
harsher listener than a learner in one way — it has no picture and no gloss —
and a kinder one in another, since it knows Japanese; the number is a
comparison between voices and front ends, not a grade.

**Two scores, because Japanese has two ways to be right.** Whisper may hear
わたし and write 私, or the reverse. `surface` compares what it wrote with the
sentence as written; `kana` turns both into kana first (UniDic's readings,
through fugashi), which forgives a spelling and still catches a wrong sound.
The decision is made on `kana`.

Three ways to read a sentence are compared:

- `reading`: the pack's path — the reviewed kana through misaki
  (`ja_phonemes` in `../tts/generate.py`).
- `text`: the service's path for a member's own card — misaki straight from
  the sentence (`ja_phonemes` in `apps/tts/server.py`).
- `espeak`: what the service would have done without misaki, which is why
  Japanese was silent before.

Usage, in the venv `../tts/generate.py` describes plus faster-whisper (MIT):

    .venv/bin/python tools/echo-content/jlpt/listen.py --pack content/echo/ja/jlptN5.json \\
        --model <dir>/kokoro-v1.0.onnx --voices <dir>/voices-v1.0.bin --sample 30
"""

import argparse
import json
import random
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "tts"))
sys.path.insert(0, str(HERE))

from generate import ja_phonemes, kokoro  # noqa: E402

#: Every Japanese voice Kokoro v1.0 has, all Apache-2.0.
VOICES = ["jf_alpha", "jf_gongitsune", "jf_nezumi", "jf_tebukuro", "jm_kumo"]


def distance(a: str, b: str) -> int:
    """Levenshtein distance, characters."""
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, row[0] = row[0], i
        for j, cb in enumerate(b, 1):
            prev, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, prev + (ca != cb))
    return row[-1]


def accuracy(heard: str, said: str) -> float:
    """One minus the character error rate, floored at zero."""
    if not said:
        return 0.0
    return max(0.0, 1 - distance(heard, said) / len(said))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pack", action="append", required=True, type=Path)
    ap.add_argument("--model", required=True, type=Path)
    ap.add_argument("--voices", required=True, type=Path)
    ap.add_argument("--sample", type=int, default=30)
    ap.add_argument("--whisper", default="large-v3-turbo")
    ap.add_argument("--paths", default="reading,text,espeak")
    ap.add_argument("--voice", action="append", help="only these voices")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", type=Path, help="write every transcript here as JSON")
    args = ap.parse_args()

    import fugashi
    import jaconv
    import numpy as np
    from faster_whisper import WhisperModel
    from misaki.cutlet import Cutlet

    items = [item for path in args.pack for item in json.loads(path.read_text("utf8"))["items"]]
    random.Random(args.seed).shuffle(items)
    items = items[: args.sample]

    tagger = fugashi.Tagger()
    cutlet = Cutlet()

    def plain(text: str) -> str:
        text = unicodedata.normalize("NFKC", text)
        return "".join(ch for ch in text if unicodedata.category(ch)[0] in "LN")

    def kana(text: str) -> str:
        return jaconv.kata2hira("".join(w.feature.kana or w.surface for w in tagger(plain(text))))

    k = kokoro(args.model, args.voices)
    whisper = WhisperModel(args.whisper, device="cpu", compute_type="int8")

    def hear(samples, rate) -> str:
        # Whisper wants 16 kHz mono float32; Kokoro speaks at 24 kHz.
        audio = np.interp(
            np.arange(0, len(samples), rate / 16000), np.arange(len(samples)), samples
        ).astype("float32")
        segments, _ = whisper.transcribe(audio, language="ja", beam_size=5, condition_on_previous_text=False)
        return "".join(segment.text for segment in segments).strip()

    paths = args.paths.split(",")
    rows, scores = [], {}
    for voice in args.voice or VOICES:
        for path in paths:
            surface_total = kana_total = 0.0
            for item in items:
                if path == "reading":
                    samples, rate = k.create(ja_phonemes(item["text"], item["reading"]), voice=voice, is_phonemes=True)
                elif path == "text":
                    samples, rate = k.create(cutlet(item["text"])[0], voice=voice, is_phonemes=True)
                else:
                    samples, rate = k.create(item["text"], voice=voice, lang="ja")
                heard = hear(samples, rate)
                s = accuracy(plain(heard), plain(item["text"]))
                kn = accuracy(kana(heard), kana(item["text"]))
                surface_total += s
                kana_total += kn
                rows.append({"voice": voice, "path": path, "text": item["text"], "heard": heard, "surface": s, "kana": kn})
            scores[(voice, path)] = (surface_total / len(items), kana_total / len(items))
            print(
                f"{voice:14} {path:8} surface {100 * scores[(voice, path)][0]:5.1f}%  kana {100 * scores[(voice, path)][1]:5.1f}%",
                flush=True,
            )
    if args.out:
        args.out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), "utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
