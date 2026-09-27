# The transcript service — see server.py. Built by deploy-stt.yml and by
# `flyctl deploy apps/stt`; the Docker context is this directory.
FROM python:3.12-slim

WORKDIR /app

# No apt packages: PyAV's wheel carries the ffmpeg libraries that decode a
# note, and CTranslate2's carries its own math. That is most of why this image
# is a third of the voice service's.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# The model, at a pinned revision of Systran's conversion (MIT, like the
# weights it was converted from), so a re-uploaded model cannot become a
# different transcriber unnoticed. In the image rather than on a volume, for
# the reason the voice service gives: a volume pins the app to one machine and
# one region, and 460 MB in a layer is cached between builds anyway. Its own
# layer, before the code, so editing server.py downloads nothing.
ARG MODEL_REPO=Systran/faster-whisper-small
ARG MODEL_REVISION=536b0662742c02347bc0e980a01041f333bce120
RUN python -c "from huggingface_hub import snapshot_download; \
snapshot_download('$MODEL_REPO', revision='$MODEL_REVISION', local_dir='whisper-small')" \
  && rm -rf whisper-small/.cache \
  && du -sh whisper-small

COPY server.py ./

# The model loaded and a note decoded and read — see selftest.py for what it
# proves and what it leaves to check-stt.yml.
COPY selftest.py ./
RUN python selftest.py && rm -rf __pycache__

RUN useradd --create-home stt
USER stt
EXPOSE 8080
CMD ["python", "server.py"]
