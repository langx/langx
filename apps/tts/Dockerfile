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

COPY server.py ./

# Debian's espeak-ng rather than the wheel's bundled copy — see load_kokoro in
# server.py for why. A full path, not the soname: ctypes would find
# `libespeak-ng.so.1` on its own, but phonemizer checks that the path it was
# given is a file before loading it, and answers a bare name with "espeak not
# installed on your system" — which is what the first deploy said. The
# symlink is where the multiarch directory is not something to spell out.
RUN ln -s "$(find /usr/lib -name 'libespeak-ng.so.1' -print -quit)" /usr/local/lib/libespeak-ng.so.1 \
  && test -f /usr/local/lib/libespeak-ng.so.1
ENV ESPEAK_LIBRARY=/usr/local/lib/libespeak-ng.so.1 \
    ESPEAK_DATA=/usr/share/espeak-ng-data

# Read one word at build time, so an image that cannot phonemise fails here
# and not on the first request after a deploy that looked green.
RUN python -c "from server import load_kokoro; load_kokoro().create('hello', voice='af_heart', lang='en-us')"

RUN useradd --create-home tts
USER tts
EXPOSE 8080
CMD ["python", "server.py"]
