# The voice service — see server.py. Built by deploy-tts.yml and by
# `flyctl deploy -c apps/tts/fly.toml`; the Docker context is this directory.
FROM python:3.12-slim

# espeak-ng for the phonemiser (the wheel bundles a library that still wants
# the data files on disk), ffmpeg for the AAC encode. Together they are most
# of the image, and both are runtime needs, so they sit in the one stage.
RUN apt-get update \
  && apt-get install -y --no-install-recommends espeak-ng ffmpeg curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# The weights and the voice packs, from the kokoro-onnx release the offline
# script uses (`tools/echo-content/tts/generate.py`), checked against the
# hashes below so a replaced asset cannot become a different voice unnoticed.
# In the image rather than on a volume: a volume pins the app to one machine
# and one region, and 330 MB in a layer is cached between builds anyway.
ARG MODEL_BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
RUN curl -fsSL -o kokoro-v1.0.onnx "$MODEL_BASE/kokoro-v1.0.onnx" \
  && curl -fsSL -o voices-v1.0.bin "$MODEL_BASE/voices-v1.0.bin" \
  && echo "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5  kokoro-v1.0.onnx" | sha256sum -c - \
  && echo "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d  voices-v1.0.bin" | sha256sum -c -

# The Piper models the manifest names, one language each, in a layer of their
# own so that editing `server.py` does not re-download two gigabytes and a
# deploy that changes no voice pushes no voice. `voices.json` is copied first
# because the layer is keyed on it, and it is the only input.
#
# One `.onnx` and its `.onnx.json` config per voice, laid out under `piper/` by
# the path the manifest gives — which is the path inside `rhasspy/piper-voices`,
# so a voice can be looked up there under the name it has here.
COPY voices.json ./
ARG PIPER_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main
# `--retry` with `--retry-all-errors`, and a pause between voices, because
# sixty-two files fetched back to back from one unauthenticated address is
# what Hugging Face throttles: the first build of this got five in and then a
# 429. curl's own backoff clears it without a token, and the second of each
# pair is a 5 KB config, so the pause is per voice rather than per file.
RUN set -eux; \
  python -c "import json;[print(v['model']) for vs in json.load(open('voices.json')).values() for v in vs]" \
    | while read -r model; do \
        mkdir -p "piper/$(dirname "$model")"; \
        curl -fsSL --retry 8 --retry-delay 5 --retry-all-errors --retry-max-time 300 \
          -o "piper/$model" "$PIPER_BASE/$model"; \
        curl -fsSL --retry 8 --retry-delay 5 --retry-all-errors --retry-max-time 300 \
          -o "piper/$model.json" "$PIPER_BASE/$model.json"; \
        sleep 1; \
      done; \
  du -sh piper

COPY server.py ./

# Debian's espeak-ng rather than the wheel's bundled copy — see load_kokoro in
# server.py for why. A full path, not the soname: ctypes would find
# `libespeak-ng.so.1` on its own, but phonemizer checks that the path it was
# given is a file before loading it, and answers a bare name with "espeak not
# installed on your system" — which is what the first deploy said. The
# symlink is where the multiarch directory is not something to spell out.
# The data directory the same way: Debian keeps it under the multiarch
# `/usr/lib/<triplet>/`, not `/usr/share`, and phonemizer answers a data path
# that is not a directory with the same "not installed" — the second thing
# the first deploy said, once the library was found.
RUN set -eux; \
  lib="$(find /usr/lib -name 'libespeak-ng.so.1' -print -quit)"; \
  data="$(dirname "$(find /usr -name phontab -path '*espeak-ng-data*' -print -quit)")"; \
  test -f "$lib" && test -f "$data/phontab"; \
  ln -s "$lib" /usr/local/lib/libespeak-ng.so.1; \
  ln -s "$data" /usr/local/share/espeak-ng-data
ENV ESPEAK_LIBRARY=/usr/local/lib/libespeak-ng.so.1 \
    ESPEAK_DATA=/usr/local/share/espeak-ng-data

# Every voice, loaded and encoded — see selftest.py for what it proves and why
# it reports all of them rather than stopping at the first.
COPY selftest.py ./
RUN python selftest.py

RUN useradd --create-home tts
USER tts
EXPOSE 8080
CMD ["python", "server.py"]
