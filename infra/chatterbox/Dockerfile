FROM python:3.11-slim-bookworm

WORKDIR /app

# ── FastAPI stack + audio ─────────────────────────────────────────────────────
RUN pip install --no-cache-dir --default-timeout=100 \
    fastapi \
    "uvicorn[standard]" \
    python-multipart \
    soundfile \
    numpy \
    aiofiles

# ── chatterbox-tts ────────────────────────────────────────────────────────────
# chatterbox-tts pins torch==2.6.0 exactly, so it will download the CUDA build
# from PyPI. We let it finish, then immediately force-reinstall the CPU wheel.
RUN pip install --no-cache-dir --default-timeout=100 chatterbox-tts

# ── Replace CUDA torch with CPU build ────────────────────────────────────────
# Force-reinstall overwrites the CUDA wheels that chatterbox pulled in.
# The nvidia_* packages remain on disk but are never loaded at runtime
# because torch.cuda.is_available() == False on CPU hosts.
RUN pip install --no-cache-dir --default-timeout=100 --force-reinstall \
    "torch==2.6.0+cpu" \
    "torchaudio==2.6.0+cpu" \
    --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --default-timeout=100 --force-reinstall \
       "torch==2.6.0+cpu" --index-url https://download.pytorch.org/whl/cpu

# Copy our CPU-safe server and pre-warm script
COPY server.py prewarm.py ./

RUN mkdir -p /app/voices

ENV PORT=4123
ENV DEVICE=cpu
ENV VOICES_DIR=/app/voices

EXPOSE 4123

# Pre-warm: load model so first request is instant
RUN python prewarm.py

CMD ["python", "server.py"]
