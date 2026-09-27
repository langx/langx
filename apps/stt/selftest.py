"""Load the model and run one note through every step a request takes.

Run at build time, so a model that arrived truncated, a CTranslate2 that will
not load it, or a PyAV without its codecs fails the build rather than the first
request after a deploy.

What it cannot prove is that the words come out right: the image carries no
recording of anybody to test against, and a synthetic tone has no words. That
half is `check-stt.yml`, which speaks a sentence on the runner and asks the
running container what it heard.
"""

import io
import math
import struct
import sys
import wave

from server import SAMPLE_RATE, decode, load_model, pick_language, transcribe


def tone_wav(seconds: float = 2.0) -> bytes:
    """A second or two of a 440 Hz tone as WAV bytes — something to decode."""
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
    model = load_model()
    print("model ok", flush=True)

    samples = decode(tone_wav())
    if abs(len(samples) - 2 * SAMPLE_RATE) > SAMPLE_RATE // 10:
        print(f"decoded {len(samples)} samples from two seconds", flush=True)
        return 1
    print("decode ok", flush=True)

    # All three paths: Whisper's own detection, one hint that skips it, and
    # several that ask for the distribution — with a code it does not know.
    for hints in ([], ["en"], ["tr", "en", "ase"]):
        lang = pick_language(model, samples, hints)
        if hints and lang not in hints:
            print(f"hints {hints!r} picked {lang!r}", flush=True)
            return 1
        result = transcribe(model, samples, lang)
        if not isinstance(result.get("text"), str) or not result.get("lang"):
            print(f"transcribe with hints {hints!r} returned {result!r}", flush=True)
            return 1
        print(f"transcribe hints={hints!r} ok", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
