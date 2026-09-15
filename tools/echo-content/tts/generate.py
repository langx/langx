"""
Synthesised readings for every pack item, in two voices.

**Why synthesis is allowed here and not for a gloss.** A gloss is a judgement —
which sense a word carries — and a machine gets it wrong often enough to be
useless, which is why `build-pack.mjs` drafts and a person decides. A reading is
not a judgement: the text is already fixed, and the synthesiser only pronounces
it. See `docs/decisions.md`.

**Kokoro, because the licence is the whole point.** Apache-2.0 covers the
weights and the voice packs alike, with no non-commercial clause — unlike
Tatoeba's own recordings (98% CC BY-NC-ND), macOS `say` (the system voices are
personal use only, by Apple's SLA) and Coqui XTTS (CPML).

**Two voices, because one is a claim.** A single synthetic reading reads as *the*
pronunciation; two, in different registers, read as what they are. A human
recording from Commons is better than both and stays first where it exists.

Usage:
    python3.12 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
    brew install espeak-ng          # the wheel's dylib looks for its build path
    # then, from the repository root:
    tools/echo-content/tts/generate.py --out <dir>

Model files (put them beside this script, or pass --model/--voices):
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

VOICES = ("af_heart", "am_michael")
ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "content" / "echo"


def kokoro(model: Path, voices: Path):
    # The bundled libespeak-ng has its build machine's data path compiled in, so
    # it has to be pointed at a real one before anything phonemises.
    import espeakng_loader

    espeakng_loader.make_library_available()
    os.environ.setdefault("ESPEAK_DATA_PATH", espeakng_loader.get_data_path())

    from kokoro_onnx import Kokoro

    return Kokoro(str(model), str(voices))


def packs():
    for lang in sorted(p for p in CONTENT.iterdir() if p.is_dir()):
        for path in sorted(lang.glob("*.json")):
            yield path, json.loads(path.read_text())


def voice_key(pack_id: str, index: int, voice: str) -> str:
    """Mirrors `packVoiceKey` in `packages/shared`, which is the definition."""
    return f"echo/packs/{pack_id.replace(':', '_')}/{index}-{voice}.m4a"


def main() -> int:
    ap = argparse.ArgumentParser()
    here = Path(__file__).resolve().parent
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--model", type=Path, default=here / "kokoro-v1.0.onnx")
    ap.add_argument("--voices", type=Path, default=here / "voices-v1.0.bin")
    args = ap.parse_args()

    for f in (args.model, args.voices):
        if not f.exists():
            print(f"missing {f} — see the module docstring for where to get it", file=sys.stderr)
            return 1

    import soundfile as sf

    k = kokoro(args.model, args.voices)
    made = skipped = 0

    for path, pack in packs():
        out = args.out / pack["id"].replace(":", "_")
        out.mkdir(parents=True, exist_ok=True)
        for item in pack["items"]:
            # Written whether or not the audio was regenerated: the key is
            # derived, so recording it is not a claim that a file exists yet —
            # `upload-echo-voices.ts` is what puts the bytes where this points.
            item["voices"] = [
                {"key": voice_key(pack["id"], item["index"], voice), "voice": voice}
                for voice in VOICES
            ]
            for voice in VOICES:
                target = out / f"{item['index']}-{voice}.m4a"
                if target.exists():
                    skipped += 1
                    continue
                wav = target.with_suffix(".wav")
                samples, rate = k.create(item["text"], voice=voice, speed=1.0, lang="en-us")
                sf.write(wav, samples, rate)
                # AAC rather than the WAV: a card is played on a phone, over a
                # network somebody else is paying for.
                subprocess.run(
                    ["afconvert", "-f", "mp4f", "-d", "aac", str(wav), str(target)],
                    check=True,
                    capture_output=True,
                )
                wav.unlink()
                made += 1
        pack["contentVersion"] += 1
        path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n")
        print(f"  {pack['id']}: {len(pack['items'])} items", flush=True)

    print(f"made {made}, skipped {skipped} already there")
    print("Run prettier over content/echo, then upload-echo-voices.ts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
