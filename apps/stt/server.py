"""
The transcript service: one voice note in, its words out.

**Why a process of its own**, for the reason `apps/tts` is one: the API runs on
two 512 MB machines and its image is Node and ffmpeg. Whisper is a 460 MB model
under CTranslate2 in a Python runtime, which neither the image nor the memory
has room for. This process holds the model, answers on the organisation's
private network only, and scales to zero between requests; the API's
`HttpSttProvider` is its only caller.

**Ours rather than a cloud speech API**, because a voice note is somebody's
voice saying something private to one other person, and handing it to a third
party to be heard is a different privacy promise from storing it in our own
bucket. See `docs/decisions.md` for the rest of that argument.

**faster-whisper, because the licence is the whole point** — the same bar
`apps/tts` holds. faster-whisper is MIT, OpenAI's Whisper weights are MIT, and
Systran's CTranslate2 conversion of them is MIT too. PyAV, which decodes the
note, is BSD over an LGPL ffmpeg it ships as shared libraries.

**`small`, in int8, on the CPU.** It is the largest multilingual Whisper that
fits the 2 GB machine with room to spare — about a gigabyte resident once
loaded — and it is the first size that is honestly useful beyond English.
`base` is three times faster and noticeably worse at the languages people are
learning, which is the one place a wrong word does real harm.

Routes:
    GET  /health                   -> 200 once the model is loaded
    POST /transcribe?lang=tr,en    -> application/json {"text": "...", "lang": "tr"}
         body: the voice note's bytes, as stored — AAC, MP3, Ogg or WebM
         X-STT-Secret: <STT_SECRET>, when the service was started with one

`lang` is optional: the languages the note is likely to be in, which for a
language exchange is the two people's own. Whisper's open detection is the
weak part of a short note — a Turkish sentence read slowly is confidently
"English" often enough to matter, and the words that follow are then English
too — and a thread's languages are the one thing we know that it does not. One
code reads the note as that language; several pick the likeliest of those;
none leaves Whisper to decide. Codes Whisper does not know are dropped rather
than refused, because the list is a profile's languages and some of those have
no speech at all. The language it was read as comes back either way.

Environment:
    PORT          default 8080
    STT_SECRET    optional; when set, every /transcribe must carry it
    STT_MODEL     a directory holding the CTranslate2 model; default ./whisper-small
    STT_THREADS   CPU threads for one transcription; default 4, the machine's count

Run locally:
    python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python -c "from huggingface_hub import snapshot_download; \\
      snapshot_download('Systran/faster-whisper-small', local_dir='whisper-small')"
    PORT=8091 .venv/bin/python server.py
"""

import io
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# The longest voice note chat can send (`MAX_AUDIO_SECONDS` in
# `packages/shared/src/media.ts`), equal by hand and checked by a test that
# reads this file. The duration on the row is the phone's claim; this is
# measured from the decoded samples, so a note that lied about its length is
# still refused rather than read for ten minutes.
MAX_AUDIO_SECONDS = 120

# And its byte ceiling (`MAX_AUDIO_BYTES`), for the same reason and checked by
# the same test. Read before anything is decoded, so a body this large is never
# held in memory at all.
MAX_AUDIO_BYTES = 16 * 1024 * 1024

# What Whisper resamples everything to, and so what a sample count divides by.
SAMPLE_RATE = 16000

HERE = Path(__file__).resolve().parent


def load_model():
    from faster_whisper import WhisperModel

    path = os.environ.get("STT_MODEL", str(HERE / "whisper-small"))
    threads = int(os.environ.get("STT_THREADS", "4"))
    # int8 is what makes `small` fit and run at a usable speed on shared CPUs;
    # its accuracy against float32 is within noise for this model.
    return WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=threads)


def decode(audio: bytes):
    """The note as 16 kHz mono float samples, whatever container it came in."""
    from faster_whisper.audio import decode_audio

    return decode_audio(io.BytesIO(audio), sampling_rate=SAMPLE_RATE)


# A thread's two people hold a handful of languages; a longer list is not a hint.
MAX_LANGUAGE_HINTS = 12


def pick_language(model, samples, langs: "list[str]") -> "str | None":
    """Which of the likely languages the note is in, or `None` to let Whisper decide.

    Several candidates cost one extra pass of the encoder over the first thirty
    seconds: the price of asking Whisper for its whole distribution rather than
    only its favourite — and the favourite is what goes wrong.
    """
    known = [code for code in langs if code in model.supported_languages]
    if len(known) <= 1:
        return known[0] if known else None
    _, _, probabilities = model.detect_language(samples)
    ranked = dict(probabilities)
    return max(known, key=lambda code: ranked.get(code, 0.0))


def transcribe(model, samples, lang: "str | None") -> dict:
    """Whisper over decoded samples: the words, and the language they were read as.

    Greedy (`beam_size=1`) rather than the default beam of five: on a shared CPU
    the beam is most of the wait, and on a voice note — one person, a phone
    held close — it changes a word now and then rather than the sentence.

    `vad_filter` drops the silence before Whisper sees it. A note is often a
    few seconds of breath around a sentence, and silence is where Whisper
    invents words, so this is accuracy as much as speed.

    `condition_on_previous_text=False` so one misheard segment cannot talk the
    next into the same mistake — the failure that turns a long note into one
    phrase repeated to the end.
    """
    segments, info = model.transcribe(
        samples,
        language=lang,
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    text = " ".join(segment.text.strip() for segment in segments).strip()
    return {"text": text, "lang": info.language}


class Handler(BaseHTTPRequestHandler):
    model = None
    # One transcription at a time. CTranslate2 would take a second on the same
    # model, but both would share the machine's four threads and each would
    # take twice as long; Fly's concurrency limit keeps the queue short.
    lock = threading.Lock()
    secret = os.environ.get("STT_SECRET") or None

    def log_message(self, fmt, *args):  # one line per request, to stdout, for `fly logs`
        sys.stdout.write("%s %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/transcribe":
            return self._json(404, {"error": "not found"})
        if self.secret and self.headers.get("X-STT-Secret") != self.secret:
            return self._json(401, {"error": "bad secret"})

        hints = [code for code in (parse_qs(url.query).get("lang") or [""])[0].split(",") if code]
        if len(hints) > MAX_LANGUAGE_HINTS:
            return self._json(400, {"error": "too many languages"})

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"error": "bad content length"})
        if length <= 0 or length > MAX_AUDIO_BYTES:
            return self._json(413, {"error": "audio is empty or too large"})

        try:
            samples = decode(self.rfile.read(length))
        except Exception as caught:  # noqa: BLE001 - PyAV raises a family of its own
            return self._json(400, {"error": f"could not decode audio: {type(caught).__name__}"})
        # A little over the cap, so a note the phone stopped at 120.0 seconds
        # and the container rounds up is still read.
        if len(samples) > (MAX_AUDIO_SECONDS + 2) * SAMPLE_RATE:
            return self._json(413, {"error": "audio is too long"})

        with self.lock:
            result = transcribe(self.model, samples, pick_language(self.model, samples, hints))
        self._json(200, result)


def main() -> int:
    Handler.model = load_model()
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"transcript service listening on :{port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
