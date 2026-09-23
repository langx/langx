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

**Two engines, and the language picks one.** Kokoro reads its seven; every
other language the service speaks is Piper's, and the voice tables in
`packages/shared/src/speech.ts` — mirrored by `apps/tts/voices.json`, which is
what this reads — are the definition of which. Nothing here takes an engine
flag: a pack in `de` is Piper's because `de` is Piper's.

**Chinese is read from its pinyin, not its characters.** Every other language
goes through espeak-ng, and espeak strips Mandarin's tones; the service reads a
member's Chinese card through misaki instead, which guesses a polyphone wrong
now and then (你得去 as *dé*). A pack item carries `reading` — pinyin that
somebody read — so the tones here are the reviewed ones, turned into Kokoro's
phonemes by misaki's own pinyin table. See `zh_phonemes`.

Usage:
    python3.12 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile piper-tts 'misaki[zh]'
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
    "zh": ("cmn", ("zf_xiaoyi", "zm_yunxi")),
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


def zh_words(text: str, reading: str) -> list[list[str]]:
    """The reading as words of `TONE3` syllables (`de5`, `dei3`), one per character.

    The reading is written the way a textbook writes it — words joined,
    `xǐhuan`, `liàn'ài` — so its syllables are not found by splitting but by
    aligning it against the characters: each character's possible readings,
    stripped of tone, are tried against what is left of the current word, and
    the tone is read off the letters that matched. Word by word, because across
    a word boundary the longest reading can eat the next word's initial —
    母亲高 is *mǔqīn gāo*, and 亲 may also be *qìng*.

    A syllable ending in `r` where the character is 儿 is erhua (一会儿,
    *yíhuìr*): the `r` belongs to the syllable before it and is returned there,
    as `huir4`.
    """
    import re
    import unicodedata

    from pypinyin import Style, pinyin

    marks = {"\u0304": "1", "\u0301": "2", "\u030c": "3", "\u0300": "4"}

    def bare(s: str) -> str:
        decomposed = unicodedata.normalize("NFD", s.lower())
        return "".join(c for c in decomposed if c.isascii() and c.isalpha())

    def tone3(syllable: str) -> str:
        decomposed = unicodedata.normalize("NFD", syllable.lower())
        tone = next((marks[c] for c in decomposed if c in marks), "5")
        base = "".join(c for c in decomposed if c not in marks).replace("u\u0308", "v")
        return base + tone

    chars = iter(ch for ch in text if "\u4e00" <= ch <= "\u9fff")
    words = []
    for group in re.findall(r"[^\s.,?!:;\"]+", reading):
        rest = unicodedata.normalize("NFC", group.replace("'", ""))
        word: list[str] = []
        while bare(rest):
            ch = next(chars)
            if ch == "儿" and word and bare(rest) == "r":
                word[-1] = word[-1][:-1] + "r" + word[-1][-1]
                rest = ""
                break
            candidates = sorted(
                {bare(c) for c in pinyin(ch, style=Style.TONE, heteronym=True)[0]},
                key=len,
                reverse=True,
            )
            match = next((c for c in candidates if bare(rest).startswith(c)), None)
            if match is None:
                raise ValueError(f"{text}: the reading does not spell {ch} at {rest!r}")
            taken = ""
            while bare(taken) != match:
                taken += rest[len(taken)]
            word.append(tone3(taken))
            rest = rest[len(taken) :]
        words.append(word)
    if next(chars, None) is not None:
        raise ValueError(f"{text}: the reading ends before the characters do")
    return words


def zh_phonemes(text: str, reading: str) -> str:
    """A pack item's pinyin as Kokoro's phonemes, one word per word of the reading.

    misaki's `py2ipa` is the table the service's own phonemiser ends in, so a
    pack and a member's card are the same phoneme set — only the choice of tone
    differs, and here it is the reviewed one. The word breaks matter: Kokoro
    reads `ni↓ xau↓` as two words and `ni↓xau↓` as one.
    """
    import re

    from misaki import zh

    def syllable(py: str) -> str:
        # misaki has no erhua, so the r is read onto the syllable before the
        # tone: huìr is `xwei` + `ɻ` + `↘`.
        erhua = py[-2:-1] == "r" and py[:-2] not in ("e", "")
        ipa = zh.ZHG2P.py2ipa(py[:-2] + py[-1] if erhua else py).replace("\u032f", "")
        if erhua:
            ipa = re.sub(r"([→↗↓↘]?)$", "ɻ\\1", ipa, count=1)
        return ipa

    punctuation = [m for m in re.findall(r"[^\s.,?!:;\"]+|[.,?!:;]", reading)]
    words = iter(zh_words(text, reading))
    out: list[str] = []
    for token in punctuation:
        if token in ".,?!:;":
            if out:
                out[-1] += token
            continue
        out.append("".join(syllable(py) for py in next(words)))
    return " ".join(out)


def kokoro_wav(k, item: dict, lang: str, voice: str, espeak: str, path: Path) -> None:
    """One Kokoro reading, written as WAV."""
    import soundfile as sf

    if lang == "zh":
        phonemes = zh_phonemes(item["text"], item["reading"])
        samples, rate = k.create(phonemes, voice=voice, speed=1.0, is_phonemes=True)
    else:
        samples, rate = k.create(item["text"], voice=voice, speed=1.0, lang=espeak)
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


def write_pack(path: Path, pack) -> None:
    """Writes a pack the way `build.mjs` writes one, which is prettier's way.

    **On one line, deliberately.** Prettier's JSON printer defaults to
    `objectWrap: "preserve"`: an object with a line break after its `{` keeps
    its expanded shape, and one without gets wrapped to `printWidth`. So a
    file this wrote with `indent=2` stays expanded *through* `prettier
    --write` — it is already valid prettier — while `build.mjs`, which
    formats `JSON.stringify` output, writes the compact form. Both pass
    `format:check`, and the two tools spent the German and Russian packs
    flipping between them: a four-thousand-line diff with no content in it,
    every time either one ran.

    Handing prettier the same single line `JSON.stringify` produces ends that.
    `format_packs` below is what turns it back into something readable, and
    until it runs the file on disk is one long line.
    """
    path.write_text(json.dumps(pack, ensure_ascii=False) + "\n")


def format_packs(paths) -> bool:
    """Runs the repository's prettier over the packs this run rewrote.

    Not optional and not a convenience: `write_pack` leaves one line, and the
    formatter is the half that decides where it breaks. A failure here is
    reported with the command to run by hand rather than raised, because the
    audio took an hour and the files are already correct JSON.
    """
    if not paths:
        return True
    try:
        subprocess.run(
            ["pnpm", "exec", "prettier", "--write", *(str(p) for p in paths)],
            cwd=ROOT,
            check=True,
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError) as failed:
        detail = getattr(failed, "stderr", b"") or b""
        print(f"  prettier did not run ({failed}) {detail.decode(errors='replace').strip()}")
        print(f"  The packs are written but unformatted. Run, from {ROOT}:")
        print(f"    pnpm exec prettier --write {' '.join(str(p) for p in paths)}")
        return False
    return True


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
    written: list[Path] = []

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
        changed = False
        for item in pack["items"]:
            # Written whether or not the audio was regenerated: the key is
            # derived, so recording it is not a claim that a file exists yet —
            # `upload-echo-voices.ts` is what puts the bytes where this points.
            wanted = [
                {"key": voice_key(pack["id"], item["index"], voice), "voice": voice}
                for voice in voices
            ]
            if item.get("voices") != wanted:
                item["voices"] = wanted
                changed = True
            for voice in voices:
                target = out / f"{item['index']}-{voice}.m4a"
                if target.exists():
                    skipped += 1
                    continue
                wav = target.with_suffix(".wav")
                if spoken:
                    kokoro_wav(kokoro_engine(), item, pack["lang"], voice, espeak, wav)
                else:
                    model = next(v["model"] for v in piper if v["id"] == voice)
                    piper_wav(piper_engine(model), item["text"], wav)
                to_m4a(wav, target)
                wav.unlink()
                made += 1
        # Only when a key actually changed: a second run on a machine that is
        # making the audio to upload — the keys are already committed — must
        # leave the pack as it found it, not claim a new draft of it.
        if changed:
            pack["contentVersion"] += 1
            write_pack(path, pack)
            written.append(path)
        print(f"  {pack['id']}: {len(pack['items'])} items, {len(voices)} voice(s)", flush=True)

    formatted = format_packs(written)
    print(f"made {made}, skipped {skipped} already there")
    print("Then upload-echo-voices.ts." if formatted else "Format the packs, then upload.")
    return 0 if formatted else 1


if __name__ == "__main__":
    sys.exit(main())
