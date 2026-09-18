"""
The voice service: one sentence in, one AAC reading out.

**Why a process of its own.** The API runs on two 512 MB machines and its image
is Node and ffmpeg. Kokoro is a 300 MB ONNX model under a Python runtime with
espeak-ng beside it — nothing the API's image or memory has room for, and
nothing it needs for anything else. This process holds the model, answers on
the organisation's private network only, and scales to zero between requests;
the API's `HttpTtsProvider` is its only caller.

**The same engine as `tools/echo-content/tts/generate.py`**, deliberately: a
pack's readings and a member's own card come out of the same model in the same
voices, so a card cannot tell which pipeline read it. The one difference is the
encoder — `afconvert` is macOS-only, so here the WAV goes through ffmpeg.

**Kokoro, because the licence is the whole point** — see that script's
docstring and `docs/decisions.md`: Apache-2.0 over the weights and the voice
packs alike, where the obvious alternatives are all personal-use or
non-commercial.

**And Piper beside it, for the other thirty-one languages.** Kokoro reads six.
Piper's catalogue reaches far wider, at a quality below Kokoro's and far above
nothing, with one small model per language instead of one large model for all
of them — so they are loaded on demand and the least recently used is dropped,
rather than all two gigabytes being held at once on a 2 GB machine. The same
licence bar applies and it is what decides the list: the catalogue's only
Turkish, Arabic, Japanese and Korean voices are CC BY-NC, so this service does
not read those languages at all. `voices.json` is the manifest, generated from
`SPEECH_VOICES` in `packages/shared/src/speech.ts`, which stays the definition.

Routes:
    GET  /health                -> 200 once the model is loaded
    POST /synthesize            -> audio/mp4
         {"text": "...", "lang": "en", "voice": "af_heart"}
         X-TTS-Secret: <TTS_SECRET>, when the service was started with one

`lang` is a LangX language code; which engine reads it, and the espeak-ng code
Kokoro wants, are both decided here, so the API never learns what a phonemiser
is. A code or a voice this file does not know is a 400, not a guess — a reading
in the wrong accent is worse than none, and the app hides the button for
languages the API does not offer.

Environment:
    PORT            default 8080
    TTS_SECRET      optional; when set, every /synthesize must carry it
    TTS_MODEL       default ./kokoro-v1.0.onnx
    TTS_VOICES      default ./voices-v1.0.bin
    TTS_PIPER_DIR   where the Piper models live; default ./piper
    TTS_PIPER_CACHE how many Piper voices to hold in memory at once; default 3
    ESPEAK_LIBRARY  the espeak-ng shared library to phonemise with; see load_kokoro
    ESPEAK_DATA     its espeak-ng-data directory

Run locally:
    python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
    brew install espeak-ng ffmpeg      # apt-get on Linux; the Dockerfile does it
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
    PORT=8090 ESPEAK_LIBRARY=/opt/homebrew/lib/libespeak-ng.dylib \
      ESPEAK_DATA=/opt/homebrew/share/espeak-ng-data .venv/bin/python server.py
"""

import ctypes.util
import io
import json
import os
import subprocess
import sys
import threading
import wave
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Mirrors `ECHO_SYNTH_VOICES` in `packages/shared/src/echoPacks.ts`, which is
# the definition — the API refuses before asking, this refuses in case it did
# not. The right-hand side is what espeak-ng calls the language.
#
# Kokoro's six only. Piper's thirty-one are in `voices.json`, loaded below, for
# the reason that file exists: they are data, they change by adding a line, and
# the Dockerfile downloads exactly what the manifest names.
LANGUAGES = {
    "en": ("en-us", {"af_heart", "am_michael"}),
    "es": ("es", {"ef_dora", "em_alex"}),
    "fr": ("fr-fr", {"ff_siwis"}),
    "it": ("it", {"if_sara", "im_nicola"}),
    "pt": ("pt-br", {"pf_dora", "pm_alex"}),
    "hi": ("hi", {"hf_alpha", "hm_omega"}),
}

# The card's front is capped at 200 characters (`ECHO_FRONT_MAX_LENGTH`); a
# little over, so a stray byte does not fail a legitimate sentence, and not a
# lot over, so this cannot be made to read a novel.
MAX_TEXT = 400

HERE = Path(__file__).resolve().parent

PIPER_DIR = Path(os.environ.get("TTS_PIPER_DIR", str(HERE / "piper")))

# How many Piper voices to keep loaded. Each is about 60 MB of ONNX session on
# a machine with 2 GB and Kokoro already resident, so this is a memory budget
# rather than a tuning knob; three covers a conversation switching between two
# languages without reloading on every message.
PIPER_CACHE_SIZE = int(os.environ.get("TTS_PIPER_CACHE", "3"))


def load_piper_manifest() -> dict:
    """LangX language code to the Piper voices that read it, from `voices.json`.

    Missing or unreadable is not fatal: the service still reads Kokoro's six and
    answers 400 for the rest, which is exactly what it did before Piper existed.
    A half-built image should degrade to the old service, not fail to boot.
    """
    try:
        with open(HERE / "voices.json", encoding="utf8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as caught:
        print(f"no piper manifest, reading six languages only: {caught}", flush=True)
        return {}


PIPER_LANGUAGES = load_piper_manifest()


def load_kokoro():
    from kokoro_onnx import Kokoro
    from kokoro_onnx.config import EspeakConfig

    # The system's espeak-ng, not the one the wheel bundles. The bundled
    # library has its build machine's data path compiled in and, on macOS at
    # least, ignores every way of pointing it elsewhere — the first request
    # died in C with "Error processing file '/Users/runner/.../phontab'". The
    # Dockerfile installs espeak-ng from apt and names both paths below; a
    # local run names Homebrew's. Left unset, the wheel's own copy is tried,
    # which is where the offline script started too.
    library = os.environ.get("ESPEAK_LIBRARY") or ctypes.util.find_library("espeak-ng")
    data = os.environ.get("ESPEAK_DATA")
    espeak = EspeakConfig(lib_path=library, data_path=data) if library else None

    model = os.environ.get("TTS_MODEL", str(HERE / "kokoro-v1.0.onnx"))
    voices = os.environ.get("TTS_VOICES", str(HERE / "voices-v1.0.bin"))
    return Kokoro(model, voices, espeak_config=espeak)


_piper_voices: "OrderedDict[str, object]" = OrderedDict()


def load_piper(voice_id: str, model: str):
    """A Piper voice, loaded on demand and kept until something newer crowds it out.

    Thirty-one models at 60 MB each do not fit beside Kokoro on this machine, and
    almost nobody needs the thirty-first. The cost of the miss is a second or so
    of ONNX session start, on a request that is already waiting on synthesis.

    Called only under `Handler.lock`, so the dict needs no lock of its own.
    """
    found = _piper_voices.get(voice_id)
    if found is not None:
        _piper_voices.move_to_end(voice_id)
        return found

    from piper import PiperVoice

    path = PIPER_DIR / model
    voice = PiperVoice.load(str(path))
    _piper_voices[voice_id] = voice
    while len(_piper_voices) > PIPER_CACHE_SIZE:
        _piper_voices.popitem(last=False)
    return voice


def piper_wav(voice, text: str) -> bytes:
    """One Piper reading as WAV bytes, assembled from the chunks it yields."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        written = False
        for chunk in voice.synthesize(text):
            if not written:
                out.setframerate(chunk.sample_rate)
                out.setsampwidth(chunk.sample_width)
                out.setnchannels(chunk.sample_channels)
                written = True
            out.writeframes(chunk.audio_int16_bytes)
        if not written:
            raise ValueError("piper produced no audio")
    return buffer.getvalue()


def kokoro_wav(samples, rate: int) -> bytes:
    """One Kokoro reading as WAV bytes."""
    import soundfile as sf

    wav = io.BytesIO()
    sf.write(wav, samples, rate, format="WAV")
    return wav.getvalue()


def to_aac(wav: bytes) -> bytes:
    """WAV in memory to fragmented MP4/AAC on stdout — no file touches the disk."""
    # 64 kb/s mono: a card is played on a phone, over a network somebody else is
    # paying for. `frag_keyframe+empty_moov` is what lets MP4 be written to a
    # pipe at all — the default layout needs to seek back to write its index.
    done = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "wav", "-i", "pipe:0",
            "-c:a", "aac", "-b:a", "64k", "-ac", "1",
            "-movflags", "frag_keyframe+empty_moov",
            "-f", "mp4", "pipe:1",
        ],
        input=wav,
        capture_output=True,
        check=True,
    )
    return done.stdout


class Handler(BaseHTTPRequestHandler):
    kokoro = None
    # One synthesis at a time. The model is not thread-safe under ONNX Runtime's
    # default session, and a 2 GB machine has no second model to spare; Fly's
    # concurrency limit keeps the queue short from the outside.
    lock = threading.Lock()
    secret = os.environ.get("TTS_SECRET") or None

    def log_message(self, fmt, *args):  # one line per request, to stdout, for `fly logs`
        sys.stdout.write("%s %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: dict) -> None:
        self._send(status, json.dumps(payload).encode(), "application/json")

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/synthesize":
            return self._json(404, {"error": "not found"})
        if self.secret and self.headers.get("X-TTS-Secret") != self.secret:
            return self._json(401, {"error": "bad secret"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            text = str(body.get("text", "")).strip()
            lang = str(body.get("lang", ""))
            voice = str(body.get("voice", ""))
        except (ValueError, TypeError):
            return self._json(400, {"error": "bad json"})

        if not text or len(text) > MAX_TEXT:
            return self._json(400, {"error": "text is empty or too long"})

        # Kokoro first: it reads the six it was trained for better than Piper
        # does, and those six are the keys already in the cache upstream.
        if lang in LANGUAGES:
            espeak_lang, voices = LANGUAGES[lang]
            if voice not in voices:
                return self._json(400, {"error": f"voice {voice!r} does not read {lang!r}"})
            with self.lock:
                samples, rate = self.kokoro.create(
                    text, voice=voice, speed=1.0, lang=espeak_lang
                )
                wav = kokoro_wav(samples, rate)
            return self._send(200, to_aac(wav), "audio/mp4")

        model = next(
            (entry["model"] for entry in PIPER_LANGUAGES.get(lang, []) if entry["id"] == voice),
            None,
        )
        if model is None:
            if lang not in PIPER_LANGUAGES:
                return self._json(400, {"error": f"no voice for language {lang!r}"})
            return self._json(400, {"error": f"voice {voice!r} does not read {lang!r}"})

        with self.lock:
            wav = piper_wav(load_piper(voice, model), text)
        self._send(200, to_aac(wav), "audio/mp4")


def main() -> int:
    Handler.kokoro = load_kokoro()
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"voice service listening on :{port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
