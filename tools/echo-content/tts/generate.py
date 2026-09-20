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

**Two engines, and the language picks one.** Kokoro reads its six; every other
language the service speaks is Piper's, and the voice tables in
`packages/shared/src/speech.ts` — mirrored by `apps/tts/voices.json`, which is
what this reads — are the definition of which. Nothing here takes an engine
flag: a pack in `de` is Piper's because `de` is Piper's.

Usage:
    python3.12 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile piper-tts
    brew install espeak-ng          # the wheel's dylib looks for its build path
    # then, from the repository root:
    tools/echo-content/tts/generate.py --out <dir>
    tools/echo-content/tts/generate.py --out <dir> --lang de --lang ru

Model files:
    Kokoro's two go beside this script, or pass --model/--voices:
    https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/
    Piper's go under --piper-dir (default ./piper) at the path `voices.json`
    gives, the same layout `apps/tts/Dockerfile` builds:
    https://huggingface.co/rhasspy/piper-voices/resolve/main/<model>
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path

# Mirrors `ECHO_SYNTH_VOICES` in `packages/shared/src/echoPacks.ts`, which is
# the definition, and `LANGUAGES` in `apps/tts/server.py`, which is the other
# copy; a test in `apps/api/src/modules/tts/speech.test.ts` keeps all three
# equal. The left of each pair is what espeak-ng calls the language.
#
# **Kokoro's six.** Everything else the service speaks is Piper's, and is read
# by `PIPER` below rather than by this table. Piper's wheel compiles its build
# machine's espeak data path into the extension, so the first synthesis on a
# Mac dies in C and this half of the script can only be run on Linux — which is
# the wheel rather than us, and `load_piper` in `apps/tts/server.py` documents
# the same failure from the same cause.
KOKORO = {
    "en": ("en-us", ("af_heart", "am_michael")),
    "es": ("es", ("ef_dora", "em_alex")),
    "fr": ("fr-fr", ("ff_siwis",)),
    "it": ("it", ("if_sara", "im_nicola")),
    "pt": ("pt-br", ("pf_dora", "pm_alex")),
    "hi": ("hi", ("hf_alpha", "hm_omega")),
}

ROOT = Path(__file__).resolve().parents[3]
CONTENT = ROOT / "content" / "echo"


def piper_manifest() -> dict:
    """LangX language code to the Piper voices that read it.

    `apps/tts/voices.json`, which is the copy the service ships and the one
    `SPEECH_VOICES` is checked against — so the id written into a pack here and
    the id `echoSynthVoicesFor` answers with cannot drift apart.
    """
    with open(ROOT / "apps" / "tts" / "voices.json", encoding="utf8") as handle:
        return json.load(handle)


PIPER = piper_manifest()


def kokoro(model: Path, voices: Path):
    """Kokoro, reading through the system's espeak-ng rather than the wheel's.

    The bundled copy has its build machine's data path compiled into the
    extension and ignores every way of pointing it elsewhere: the first
    synthesis dies in C with "Error processing file
    '/Users/runner/work/espeakng-loader/.../phontab'". `load_kokoro` in
    `apps/tts/server.py` documents the same failure and the same fix — name
    both paths explicitly. Homebrew's are the defaults here; `ESPEAK_LIBRARY`
    and `ESPEAK_DATA` override them.
    """
    import ctypes.util

    from kokoro_onnx import Kokoro
    from kokoro_onnx.config import EspeakConfig

    library = (
        os.environ.get("ESPEAK_LIBRARY")
        or ctypes.util.find_library("espeak-ng")
        or "/opt/homebrew/lib/libespeak-ng.dylib"
    )
    data = os.environ.get("ESPEAK_DATA") or "/opt/homebrew/share/espeak-ng-data"
    return Kokoro(str(model), str(voices), espeak_config=EspeakConfig(lib_path=library, data_path=data))


def load_piper(path: Path):
    """One Piper voice, from the model file `voices.json` names.

    **Linux only.** See the note above `KOKORO`; there is nothing to configure
    here, the path is not a parameter and no environment variable reaches it.
    """
    from piper import PiperVoice

    return PiperVoice.load(str(path))


def piper_wav(voice, text: str, path: Path) -> None:
    """One Piper reading, written as WAV.

    Assembled from the chunks Piper yields, the way `piper_wav` in
    `apps/tts/server.py` does. Yielding nothing is a real failure mode and
    raising is the point: a zero-byte m4a uploads exactly as happily as a
    good one.
    """
    with wave.open(str(path), "wb") as out:
        written = False
        for chunk in voice.synthesize(text):
            if not written:
                out.setframerate(chunk.sample_rate)
                out.setsampwidth(chunk.sample_width)
                out.setnchannels(chunk.sample_channels)
                written = True
            out.writeframes(chunk.audio_int16_bytes)
        if not written:
            raise ValueError(f"piper produced no audio for {text!r}")


def kokoro_wav(k, text: str, voice: str, espeak: str, path: Path) -> None:
    """One Kokoro reading, written as WAV."""
    import soundfile as sf

    samples, rate = k.create(text, voice=voice, speed=1.0, lang=espeak)
    sf.write(path, samples, rate)


def to_m4a(wav: Path, target: Path) -> None:
    """The reading as AAC in MP4, which is what a card plays.

    `afconvert` is macOS's and is not on a Linux box; ffmpeg is on both and is
    what `apps/tts/server.py` already uses. Either way the output must stay AAC
    in MP4 — a card is played on a phone, over a network somebody else is
    paying for.
    """
    if shutil.which("afconvert"):
        command = ["afconvert", "-f", "mp4f", "-d", "aac", str(wav), str(target)]
    else:
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(wav),
            "-c:a", "aac", "-b:a", "64k", "-ac", "1",
            str(target),
        ]
    subprocess.run(command, check=True, capture_output=True)


def packs(only=None):
    for lang in sorted(p for p in CONTENT.iterdir() if p.is_dir()):
        if only and lang.name not in only:
            continue
        for path in sorted(lang.glob("*.json")):
            yield path, json.loads(path.read_text())


def voice_key(pack_id: str, index: int, voice: str) -> str:
    """Mirrors `packVoiceKey` in `packages/shared`, which is the definition."""
    return f"echo/packs/{pack_id.replace(':', '_')}/{index}-{voice}.m4a"


def main() -> int:
    ap = argparse.ArgumentParser()
    here = Path(__file__).resolve().parent
    ap.add_argument("--out", required=True, type=Path)
    # A pack whose readings are already made and uploaded should not be walked
    # again: the run costs an hour and `contentVersion` goes up for a file
    # nothing changed in, which is the one thing that field must not say.
    ap.add_argument("--lang", action="append", help="only these pack languages")
    ap.add_argument("--model", type=Path, default=here / "kokoro-v1.0.onnx")
    ap.add_argument("--voices", type=Path, default=here / "voices-v1.0.bin")
    ap.add_argument("--piper-dir", type=Path, default=here / "piper")
    args = ap.parse_args()

    # Loaded on first use rather than up front, because the models a run needs
    # follow from the languages it was given: `--lang de --lang ru` has no
    # business wanting Kokoro's 350 MB, and a Kokoro run none of Piper's.
    loaded = {}

    def kokoro_engine():
        if "kokoro" not in loaded:
            for f in (args.model, args.voices):
                if not f.exists():
                    raise SystemExit(f"missing {f} — see the module docstring for where to get it")
            loaded["kokoro"] = kokoro(args.model, args.voices)
        return loaded["kokoro"]

    def piper_engine(model: str):
        if model not in loaded:
            path = args.piper_dir / model
            if not path.exists():
                raise SystemExit(f"missing {path} — see the module docstring for where to get it")
            loaded[model] = load_piper(path)
        return loaded[model]

    made = skipped = 0

    for path, pack in packs(args.lang):
        # The engine follows from the language and nothing else. Kokoro's six
        # first, since those are the packs that lead with two registers;
        # everything else the service speaks is Piper's, one voice each.
        spoken = KOKORO.get(pack["lang"])
        piper = [] if spoken else PIPER.get(pack["lang"], [])
        if not spoken and not piper:
            print(f"  {pack['id']}: no voice reads {pack['lang']}, left silent", flush=True)
            continue
        espeak, voices = spoken if spoken else (None, tuple(v["id"] for v in piper))
        out = args.out / pack["id"].replace(":", "_")
        out.mkdir(parents=True, exist_ok=True)
        for item in pack["items"]:
            # Written whether or not the audio was regenerated: the key is
            # derived, so recording it is not a claim that a file exists yet —
            # `upload-echo-voices.ts` is what puts the bytes where this points.
            item["voices"] = [
                {"key": voice_key(pack["id"], item["index"], voice), "voice": voice}
                for voice in voices
            ]
            for voice in voices:
                target = out / f"{item['index']}-{voice}.m4a"
                if target.exists():
                    skipped += 1
                    continue
                wav = target.with_suffix(".wav")
                if spoken:
                    kokoro_wav(kokoro_engine(), item["text"], voice, espeak, wav)
                else:
                    model = next(v["model"] for v in piper if v["id"] == voice)
                    piper_wav(piper_engine(model), item["text"], wav)
                to_m4a(wav, target)
                wav.unlink()
                made += 1
        pack["contentVersion"] += 1
        path.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n")
        print(f"  {pack['id']}: {len(pack['items'])} items, {len(voices)} voice(s)", flush=True)

    print(f"made {made}, skipped {skipped} already there")
    print("Run prettier over content/echo, then upload-echo-voices.ts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
