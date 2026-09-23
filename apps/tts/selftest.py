"""Load every voice the image was built with and encode a word in it.

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

import json
import sys

from server import kokoro_wav, load_kokoro, load_piper, piper_wav, to_aac, zh_phonemes


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
