"""
The voice service: one sentence in, one AAC reading out.

**Why a process of its own.** The API runs on two 512 MB machines and its image
is Node and ffmpeg. Kokoro is a 300 MB ONNX model under a Python runtime with
espeak-ng beside it — nothing the API's image or memory has room for, and
nothing it needs for anything else. This process holds the model, answers on
the organisation's private network only, and scales to zero between requests;
the API's `HttpTtsProvider` and `HttpSttProvider` are its only callers.

**The same engine as `tools/echo-content/tts/generate.py`**, deliberately: a
pack's readings and a member's own card come out of the same model in the same
voices, so a card cannot tell which pipeline read it. The one difference is the
encoder — `afconvert` is macOS-only, so here the WAV goes through ffmpeg.

**Kokoro, because the licence is the whole point** — see that script's
docstring and `docs/decisions.md`: Apache-2.0 over the weights and the voice
packs alike, where the obvious alternatives are all personal-use or
non-commercial.

**And Piper beside it, for the other thirty-one languages.** Kokoro reads seven.
Piper's catalogue reaches far wider, at a quality below Kokoro's and far above
nothing, with one small model per language instead of one large model for all
of them — so they are loaded on demand and the least recently used is dropped,
rather than all two gigabytes being held at once on a 2 GB machine. The same
licence bar applies and it is what decides the list: the catalogue's only
Turkish, Arabic, Japanese and Korean voices are CC BY-NC, so this service does
not read those languages at all. `voices.json` is the manifest, generated from
`SPEECH_VOICES` in `packages/shared/src/speech.ts`, which stays the definition.

**And Whisper, the other direction: a voice note in, its words out.** Chat's
"Show text" is faster-whisper's `small`, in int8, on the CPU — the largest
multilingual Whisper that fits here beside Kokoro, and the first size that is
honestly useful beyond English; `base` is three times faster and noticeably
worse at the languages people are learning, which is the one place a wrong word
does real harm. It lives in this process rather than one of its own because
the machine is already paid for and already sleeps: a second app would be a
second machine, a second token and a second cold start for a feature used a
few times an hour. Ours rather than a cloud speech API because a voice note is
somebody's voice saying something private to one other person, and handing it
to a third party to be heard is a different privacy promise from storing it in
our own bucket. The licence bar is Kokoro's: faster-whisper, CTranslate2,
OpenAI's weights and Systran's conversion of them are all MIT.

Routes:
    GET  /health                -> 200 once the model is loaded
    POST /synthesize            -> audio/mp4
         {"text": "...", "lang": "en", "voice": "af_heart"}
         X-TTS-Secret: <TTS_SECRET>, when the service was started with one
    POST /romanize              -> application/json {"text": "..."}
         {"text": "...", "lang": "zh"}      zh or ja only; same secret header
    POST /transcribe?lang=tr,en -> application/json {"text": "...", "lang": "tr"}
         body: the voice note's bytes, as stored — AAC, MP3, Ogg or WebM;
         same secret header

`/romanize` is chat's "Show in Latin letters" for the two languages rules
cannot read, because which reading a character takes depends on the word it
sits in. It lives here because the Chinese segmenter and pinyin tables are
already in this image for Kokoro; see `romanize_zh` and `romanize_ja`.

`/synthesize`'s `lang` is a LangX language code; which engine reads it, and the espeak-ng code
Kokoro wants, are both decided here, so the API never learns what a phonemiser
is. A code or a voice this file does not know is a 400, not a guess — a reading
in the wrong accent is worse than none, and the app hides the button for
languages the API does not offer.

`/transcribe`'s `lang` is optional: the languages the note is likely to be in,
which for a language exchange is the two people's own. Whisper's open detection
is the weak part of a short note — a Turkish sentence read slowly is
confidently "English" often enough to matter, and the words that follow are
then English too — and a thread's languages are the one thing we know that it
does not. One code reads the note as that language; several pick the likeliest
of those; none leaves Whisper to decide. Codes Whisper does not know are
dropped rather than refused, because the list is a profile's languages and some
of those have no speech at all. The language it was read as comes back either
way.

Environment:
    PORT            default 8080
    TTS_SECRET      optional; when set, every POST must carry it
    TTS_MODEL       default ./kokoro-v1.0.onnx
    TTS_VOICES      default ./voices-v1.0.bin
    TTS_PIPER_DIR   where the Piper models live; default ./piper
    TTS_PIPER_CACHE how many Piper voices to hold in memory at once; default 3
    ESPEAK_LIBRARY  the espeak-ng shared library to phonemise with; see load_kokoro
    ESPEAK_DATA     its espeak-ng-data directory
    WHISPER_MODEL   a directory holding the CTranslate2 model; default ./whisper-small
    WHISPER_THREADS CPU threads for one transcription; default 4, the machine's count

Run locally:
    python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt
    brew install espeak-ng ffmpeg      # apt-get on Linux; the Dockerfile does it
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
    .venv/bin/python -c "from huggingface_hub import snapshot_download; \\
      snapshot_download('Systran/faster-whisper-small', local_dir='whisper-small')"
    PORT=8090 ESPEAK_LIBRARY=/opt/homebrew/lib/libespeak-ng.dylib \
      ESPEAK_DATA=/opt/homebrew/share/espeak-ng-data .venv/bin/python server.py
"""

import ctypes.util
import io
import json
import os
import re
import subprocess
import sys
import threading
import wave
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Mirrors `ECHO_SYNTH_VOICES` in `packages/shared/src/echoPacks.ts`, which is
# the definition — the API refuses before asking, this refuses in case it did
# not. The right-hand side is what espeak-ng calls the language.
#
# Kokoro's seven only. Piper's thirty-one are in `voices.json`, loaded below,
# for the reason that file exists: they are data, they change by adding a line,
# and the Dockerfile downloads exactly what the manifest names.
#
# Chinese is the exception to the right-hand side: `cmn` is what espeak-ng calls
# Mandarin, and it is never asked. See `zh_phonemes`.
LANGUAGES = {
    "en": ("en-us", {"af_heart", "am_michael"}),
    "es": ("es", {"ef_dora", "em_alex"}),
    "fr": ("fr-fr", {"ff_siwis"}),
    "it": ("it", {"if_sara", "im_nicola"}),
    "pt": ("pt-br", {"pf_dora", "pm_alex"}),
    "hi": ("hi", {"hf_alpha", "hm_omega"}),
    "zh": ("cmn", {"zf_xiaoyi", "zm_yunxi"}),
}

# The card's front is capped at 200 characters (`ECHO_FRONT_MAX_LENGTH`); a
# little over, so a stray byte does not fail a legitimate sentence, and not a
# lot over, so this cannot be made to read a novel.
MAX_TEXT = 400

# The longest message chat can send (`MAX_MESSAGE_LENGTH`), equal by hand to
# `ROMANIZE_MAX_TEXT_LENGTH` and checked by a test that reads this file. A
# reading is milliseconds of dictionary lookups, so the cap is the message's.
MAX_ROMANIZE_TEXT = 2000

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

# A thread's two people hold a handful of languages; a longer list is not a hint.
MAX_LANGUAGE_HINTS = 12

HERE = Path(__file__).resolve().parent

PIPER_DIR = Path(os.environ.get("TTS_PIPER_DIR", str(HERE / "piper")))

# How many Piper voices to keep loaded. Each is about 60 MB of ONNX session on
# a machine with 2 GB and Kokoro already resident, so this is a memory budget
# rather than a tuning knob; three covers a conversation switching between two
# languages without reloading on every message.
PIPER_CACHE_SIZE = int(os.environ.get("TTS_PIPER_CACHE", "3"))


def load_piper_manifest() -> dict:
    """LangX language code to the Piper voices that read it, from `voices.json`.

    Missing or unreadable is not fatal: the service still reads Kokoro's seven and
    answers 400 for the rest, which is exactly what it did before Piper existed.
    A half-built image should degrade to the old service, not fail to boot.
    """
    try:
        with open(HERE / "voices.json", encoding="utf8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as caught:
        print(f"no piper manifest, reading seven languages only: {caught}", flush=True)
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


_zh_g2p = None


def zh_phonemes(text: str) -> str:
    """A Chinese sentence as the phonemes Kokoro's Chinese voices were trained on.

    **Not through espeak-ng**, which is how every other Kokoro language is read
    and why Chinese was silent until now. espeak's Mandarin comes out with its
    tones stripped — `wˈo mˈən χˈən` for 我们很 — and a reading without tones
    is a reading of a different sentence. Measured on thirty-six sentences from
    the HSK packs, a speech recogniser got back 41% of the characters from
    espeak's reading and 97% from this one.

    misaki (Apache-2.0) is Kokoro's own front end: jieba to find the words and
    pypinyin to read them, then pinyin to the phoneme set. It still guesses a
    polyphone wrong now and then — 你得去 as *dé* for *děi* — which is why the
    packs are read from their reviewed pinyin instead (see
    `tools/echo-content/tts/generate.py`); a member's own card has no pinyin,
    and this is the best reading there is for it.

    Loaded on first use: jieba builds its dictionary in about a second, which a
    service that never hears Chinese has no reason to pay.
    """
    global _zh_g2p
    if _zh_g2p is None:
        from misaki import zh

        _zh_g2p = zh.ZHG2P()
    phonemes, _ = _zh_g2p(text)
    return phonemes


# Chinese punctuation in its ASCII form, so the pinyin line reads as a line
# of Latin text rather than of Latin words between full-width marks.
# The marks that end a clause carry the space the full-width form had room for.
ZH_PUNCTUATION = str.maketrans({
    "，": ", ", "。": ". ", "！": "! ", "？": "? ", "：": ": ", "；": "; ", "、": ", ",
    "“": '"', "”": '"', "‘": "'", "’": "'", "（": "(", "）": ")", "《": '"', "》": '"',
})

# A pinyin syllable that starts with a vowel takes an apostrophe inside a word,
# so 西安 is `xī'ān` and not the one syllable `xiān`.
ZH_VOWEL_START = set("aāáǎàoōóǒòeēéěè")


def _is_han(char: str) -> bool:
    code = ord(char)
    return 0x3400 <= code <= 0x9FFF or 0xF900 <= code <= 0xFAFF or 0x20000 <= code <= 0x3134F


def romanize_zh(text: str) -> str:
    """Chinese as tone-marked pinyin, one Latin word per Chinese word.

    jieba finds the words and pypinyin reads each one as a whole, which is what
    picks 觉 as *jué* in 觉得 and *jiào* in 睡觉 — reading character by
    character gets polyphones wrong far more often. Both are MIT and already
    installed through `misaki[zh]`. Tones are the dictionary's: the sandhi of
    不 and 一 is not written, as it is not in textbook pinyin either.

    Anything that is not Han passes through as it was written: Latin, digits,
    emoji, spaces.
    """
    import jieba
    from pypinyin import Style, pinyin

    out = []
    words = jieba.lcut(text)
    for index, word in enumerate(words):
        if not any(_is_han(char) for char in word):
            out.append(word.translate(ZH_PUNCTUATION))
            continue
        syllables = [
            reading[0]
            for reading in pinyin(word, style=Style.TONE, errors=lambda chars: list(chars))
        ]
        latin = syllables[0] + "".join(
            ("'" + syllable) if syllable[:1] in ZH_VOWEL_START else syllable
            for syllable in syllables[1:]
        )
        # A space between words, but not after an opening bracket or quote.
        if out and not out[-1][-1:].isspace() and out[-1][-1:] not in "(\"'":
            latin = " " + latin
        following = words[index + 1] if index + 1 < len(words) else ""
        if following[:1].isalnum() and not any(_is_han(char) for char in following):
            latin += " "
        out.append(latin)
    return "".join(out).rstrip()


_cutlet = None
# Kana, the CJK block, and the full-width forms and punctuation cutlet writes.
_JA_RUN = re.compile("[\u3000-\u30ff\u31f0-\u31ff\u3400-\u9fff\uf900-\ufaff\uff01-\uff9f]+")


def romanize_ja(text: str) -> str:
    """Japanese as Hepburn romaji, through cutlet (MIT) and unidic-lite (MIT;
    the dictionary is BSD) — not pykakasi or unidecode, which are GPL.

    Only the Japanese runs go through cutlet. It rewrites anything it does not
    recognise as `?`, which would turn an emoji in a message into a question
    mark. Katakana loanwords are written as romaji (`koohii`), not as the English
    they came from: the point is how it reads in Japanese.

    Loaded on first use, like `zh_phonemes`: building the tagger reads the
    dictionary, which a service that never sees Japanese need not pay for.
    """
    global _cutlet
    if _cutlet is None:
        import cutlet

        _cutlet = cutlet.Cutlet()
        _cutlet.use_foreign_spelling = False

    def one(match: "re.Match[str]") -> str:
        latin = _cutlet.romaji(match.group(0), capitalize=match.start() == 0)
        # Japanese needs no space before `Anna`; the romaji beside it does.
        if text[match.start() - 1 : match.start()].isalnum():
            latin = " " + latin
        if text[match.end() : match.end() + 1].isalnum():
            latin += " "
        return latin

    return _JA_RUN.sub(one, text)


ROMANIZERS = {"zh": romanize_zh, "ja": romanize_ja}


_piper_voices: "OrderedDict[str, object]" = OrderedDict()


def load_piper(voice_id: str, model: str):
    """A Piper voice, loaded on demand and kept until something newer crowds it out.

    Thirty-one models at 60 MB each do not fit beside Kokoro on this machine, and
    almost nobody needs the thirty-first. The cost of the miss is a second or so
    of ONNX session start, on a request that is already waiting on synthesis.

    Called only under `Handler.lock`, so the dict needs no lock of its own.

    **This path does not work on a Mac, and that is the wheel rather than us.**
    Piper ships espeak-ng inside its own extension module with the data beside
    it, and on Linux the extension builds the data path at run time from what
    `initialize()` is handed. The macOS wheel has its build machine's directory
    compiled in instead, so the first synthesis dies in C with
    "Error processing file '/Users/runner/work/piper1-gpl/.../phontab'" — which
    is the same failure, from the same cause, that `load_kokoro` below
    documents for kokoro-onnx. There is nothing to point at it from here: the
    path is not a parameter and no environment variable reaches it. Test the
    Piper languages in the container; the Dockerfile loads every voice at build
    time precisely so this cannot reach a deploy.
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


def load_whisper():
    from faster_whisper import WhisperModel

    path = os.environ.get("WHISPER_MODEL", str(HERE / "whisper-small"))
    threads = int(os.environ.get("WHISPER_THREADS", "4"))
    # int8 is what makes `small` fit beside Kokoro and run at a usable speed on
    # shared CPUs; its accuracy against float32 is within noise for this model.
    return WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=threads)


_whisper = None


def whisper():
    """The Whisper model, loaded by the first transcription rather than at boot.

    Kokoro is what `/health` waits for, and a cold boot is already twenty-odd
    seconds of it; loading Whisper there too would put its seconds in front of
    every reading after a deploy, for a feature most wake-ups never use. Here
    they are paid once, by the first note, inside a two-minute timeout — and
    after that the model is in the suspended snapshot like Kokoro is. A Whisper
    that cannot load fails that request, not the service: a reading still works.

    Called only under `Handler.transcribe_lock`, so two first notes load it once.
    """
    global _whisper
    if _whisper is None:
        _whisper = load_whisper()
    return _whisper


def decode(audio: bytes):
    """The note as 16 kHz mono float samples, whatever container it came in."""
    from faster_whisper.audio import decode_audio

    return decode_audio(io.BytesIO(audio), sampling_rate=SAMPLE_RATE)


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
    kokoro = None
    # One synthesis at a time. The model is not thread-safe under ONNX Runtime's
    # default session, and the machine has room for one Kokoro, not two; Fly's
    # concurrency limit keeps the queue short from the outside.
    lock = threading.Lock()
    # Its own lock, not the synthesis one: a reading takes milliseconds and must
    # not queue behind a cold Kokoro. One at a time because neither jieba's
    # lazy dictionary load nor MeCab's tagger is safe to share across threads.
    romanize_lock = threading.Lock()
    # And its own again for Whisper, both ways round: a two-minute note is tens
    # of seconds of CPU and must not hold up a one-sentence reading, and a
    # reading must not make a note wait. One at a time within it, because a
    # second transcription on the same four threads only makes both slower.
    transcribe_lock = threading.Lock()
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
        url = urlparse(self.path)
        if url.path not in ("/synthesize", "/romanize", "/transcribe"):
            return self._json(404, {"error": "not found"})
        if self.secret and self.headers.get("X-TTS-Secret") != self.secret:
            return self._json(401, {"error": "bad secret"})
        if url.path == "/transcribe":
            return self._transcribe(url.query)
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            text = str(body.get("text", "")).strip()
            lang = str(body.get("lang", ""))
            voice = str(body.get("voice", ""))
        except (ValueError, TypeError, AttributeError):
            return self._json(400, {"error": "bad json"})

        if url.path == "/romanize":
            romanizer = ROMANIZERS.get(lang)
            if romanizer is None:
                return self._json(400, {"error": f"cannot romanize language {lang!r}"})
            if not text or len(text) > MAX_ROMANIZE_TEXT:
                return self._json(400, {"error": "text is empty or too long"})
            with self.romanize_lock:
                latin = romanizer(text)
            return self._json(200, {"text": latin})

        if not text or len(text) > MAX_TEXT:
            return self._json(400, {"error": "text is empty or too long"})

        # Kokoro first: it reads the seven it was trained for better than Piper
        # does, and those seven are the keys already in the cache upstream.
        if lang in LANGUAGES:
            espeak_lang, voices = LANGUAGES[lang]
            if voice not in voices:
                return self._json(400, {"error": f"voice {voice!r} does not read {lang!r}"})
            with self.lock:
                if lang == "zh":
                    samples, rate = self.kokoro.create(
                        zh_phonemes(text), voice=voice, speed=1.0, is_phonemes=True
                    )
                else:
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

    def _transcribe(self, query: str) -> None:
        # The note's bytes as the body, not JSON: up to 16 MB, and base64 would
        # add a third to it on both ends for nothing.
        hints = [code for code in (parse_qs(query).get("lang") or [""])[0].split(",") if code]
        if len(hints) > MAX_LANGUAGE_HINTS:
            return self._json(400, {"error": "too many languages"})

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"error": "bad content length"})
        if length <= 0 or length > MAX_AUDIO_BYTES:
            return self._json(413, {"error": "audio is empty or too large"})

        # Decoded before the lock: it needs no model, and a note that will not
        # decode should not wait behind one that does.
        try:
            samples = decode(self.rfile.read(length))
        except Exception as caught:  # noqa: BLE001 - PyAV raises a family of its own
            return self._json(400, {"error": f"could not decode audio: {type(caught).__name__}"})
        # A little over the cap, so a note the phone stopped at 120.0 seconds
        # and the container rounds up is still read.
        if len(samples) > (MAX_AUDIO_SECONDS + 2) * SAMPLE_RATE:
            return self._json(413, {"error": "audio is too long"})

        with self.transcribe_lock:
            model = whisper()
            result = transcribe(model, samples, pick_language(model, samples, hints))
        self._json(200, result)


def main() -> int:
    Handler.kokoro = load_kokoro()
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"voice service listening on :{port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
