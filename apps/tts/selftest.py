"""Load every voice the image was built with and encode a word in it — and load
Whisper and run a note through every step a transcription takes.

Run at build time, so a model that 404'd, arrived truncated, or needs a Piper
this image does not have fails the build rather than the first request after a
deploy. Both engines in one interpreter on purpose: each embeds its own
espeak-ng, and two copies of a C library with global state in one process is
exactly the failure that passes either test alone.

**Every voice is reported, not just the first bad one.** The first version
stopped at the first exception, which turned "which of thirty-one models does
this Piper refuse" into one round trip per model — and the answer turned out to
be a real one: `lt_LT-reginute1-medium` is built for a `lithuanian` phoneme type
that `piper-tts` 1.8.0 does not know.
"""

import io
import json
import math
import struct
import sys
import wave

from server import (
    SAMPLE_RATE,
    decode,
    kokoro_wav,
    load_kokoro,
    load_piper,
    load_whisper,
    pick_language,
    piper_wav,
    romanize_ja,
    romanize_zh,
    to_aac,
    transcribe,
    zh_phonemes,
)


def tone_wav(seconds: float = 2.0) -> bytes:
    """A second or two of a 440 Hz tone as WAV bytes — something for Whisper to decode."""
    frames = int(SAMPLE_RATE * seconds)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(
            b"".join(
                struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / SAMPLE_RATE)))
                for i in range(frames)
            )
        )
    return buffer.getvalue()


def main() -> int:
    kokoro = load_kokoro()
    samples, rate = kokoro.create("hello", voice="af_heart", lang="en-us")
    if not to_aac(kokoro_wav(samples, rate)):
        print("kokoro produced nothing", flush=True)
        return 1
    print("kokoro ok", flush=True)

    # Chinese goes through misaki rather than espeak-ng, so it is its own path
    # and can fail on its own: a wheel that did not install, or a jieba that
    # cannot write its dictionary cache.
    samples, rate = kokoro.create(zh_phonemes("你好"), voice="zf_xiaoyi", is_phonemes=True)
    if not to_aac(kokoro_wav(samples, rate)):
        print("kokoro produced nothing for chinese", flush=True)
        return 1
    print("zh ok", flush=True)

    # `/romanize` needs no model, but it needs its dictionaries: jieba's, and
    # the UniDic that cutlet reads through MeCab. A wheel that installed
    # without its data fails here rather than on the first person to ask.
    # Word by word and tone-marked, and the emoji left where it was.
    readings = {
        "zh": (romanize_zh, "我觉得睡觉很好。😀", "wǒ juéde shuìjiào hěn hǎo. 😀"),
        "ja": (romanize_ja, "東京に行きたい 😀", "Tokyo ni ikitai 😀"),
    }
    for lang, (romanize, text, expected) in readings.items():
        got = romanize(text)
        if got != expected:
            print(f"romanize {lang}: expected {expected!r}, got {got!r}", flush=True)
            return 1
        print(f"romanize {lang} ok", flush=True)

    # Whisper, in the same interpreter as both engines, for the reason the
    # docstring gives: it brings ONNX Runtime (for its silence filter) and
    # PyAV's own ffmpeg libraries, and a clash with either shows up only here.
    # A tone has no words, so this proves the model loads and every step of a
    # request runs; what comes out is `check-tts.yml`'s to ask, with a
    # sentence spoken on the runner. All three hint paths: Whisper's own
    # detection, one hint that skips it, and several that ask for the
    # distribution — with a code it does not know.
    model = load_whisper()
    samples = decode(tone_wav())
    if abs(len(samples) - 2 * SAMPLE_RATE) > SAMPLE_RATE // 10:
        print(f"decoded {len(samples)} samples from two seconds", flush=True)
        return 1
    for hints in ([], ["en"], ["tr", "en", "ase"]):
        lang = pick_language(model, samples, hints)
        if hints and lang not in hints:
            print(f"hints {hints!r} picked {lang!r}", flush=True)
            return 1
        result = transcribe(model, samples, lang)
        if not isinstance(result.get("text"), str) or not result.get("lang"):
            print(f"transcribe with hints {hints!r} returned {result!r}", flush=True)
            return 1
    print("whisper ok", flush=True)

    failures = []
    with open("voices.json", encoding="utf8") as handle:
        manifest = json.load(handle)

    for lang, voices in sorted(manifest.items()):
        for voice in voices:
            try:
                if not to_aac(piper_wav(load_piper(voice["id"], voice["model"]), "hallo")):
                    raise ValueError("produced no audio")
            except Exception as caught:  # noqa: BLE001 - the report is the point
                failures.append(f"{lang} {voice['id']}: {type(caught).__name__}: {caught}")
                print(f"{lang} FAILED", flush=True)
            else:
                print(f"{lang} ok", flush=True)

    if failures:
        print("\nvoices this image cannot use:", flush=True)
        for line in failures:
            print(f"  {line}", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
