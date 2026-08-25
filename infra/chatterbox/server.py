"""
Custom Chatterbox TTS FastAPI server with CPU compatibility fix.

Monkey-patches torch.load before any model is imported so that
CUDA-serialized checkpoints are transparently remapped to CPU.
"""
import os
import functools
import torch

# ── CPU Compatibility Patch ──────────────────────────────────────────────────
# The chatterbox-tts package loads models with torch.load without specifying
# map_location. On CPU machines this raises:
#   RuntimeError: Attempting to deserialize object on a CUDA device but
#   torch.cuda.is_available() is False.
# We patch torch.load to always use map_location='cpu' on CPU-only hosts.
if not torch.cuda.is_available():
    _original_torch_load = torch.load

    @functools.wraps(_original_torch_load)
    def _cpu_safe_load(*args, **kwargs):
        kwargs.setdefault('map_location', torch.device('cpu'))
        return _original_torch_load(*args, **kwargs)

    torch.load = _cpu_safe_load
    print("[CPU-PATCH] torch.load patched to map_location=cpu")
# ─────────────────────────────────────────────────────────────────────────────

import io
import time
import uuid
import tempfile
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import soundfile as sf
import numpy as np

# Import AFTER the torch patch so the model loads on CPU
from chatterbox.tts import ChatterboxTTS

# ── Config ────────────────────────────────────────────────────────────────────
PORT       = int(os.getenv("PORT", 4123))
DEVICE     = os.getenv("DEVICE", "cpu")
VOICES_DIR = Path(os.getenv("VOICES_DIR", "/app/voices"))
VOICES_DIR.mkdir(parents=True, exist_ok=True)

# ── Globals ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Chatterbox TTS API",
    description="OpenAI-compatible TTS API powered by Chatterbox — CPU-safe build",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model: Optional[ChatterboxTTS] = None
model_lock = threading.Lock()

# Status tracking
_status: dict = {"status": "idle", "is_processing": False}
_history: list = []
_stats: dict = {"total_requests": 0, "completed_requests": 0, "error_requests": 0}


def get_model() -> ChatterboxTTS:
    global model
    if model is None:
        with model_lock:
            if model is None:
                print(f"[INFO] Loading Chatterbox model on {DEVICE}…")
                model = ChatterboxTTS.from_pretrained(device=DEVICE)
                print("[INFO] Model loaded successfully.")
    return model


def _wav_bytes(audio: np.ndarray, sample_rate: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, audio, sample_rate, format="WAV")
    buf.seek(0)
    return buf.read()


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Pre-load the model so the first request is fast."""
    import asyncio, concurrent.futures
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(concurrent.futures.ThreadPoolExecutor(), get_model)


# ── TTS Endpoints ─────────────────────────────────────────────────────────────
@app.post("/v1/audio/speech")
async def generate_speech(
    input: str = Form(...),
    voice: Optional[str] = Form(None),
    exaggeration: float = Form(0.5),
    cfg_weight: float  = Form(0.5),
    temperature: float = Form(0.8),
    voice_file: Optional[UploadFile] = File(None),
):
    """OpenAI-compatible TTS endpoint with optional voice upload."""
    req_id = uuid.uuid4().hex[:8]
    start  = time.time()

    _status.update({"status": "generating_audio", "is_processing": True,
                    "request_id": req_id, "start_time": start,
                    "text_preview": input[:80]})
    _stats["total_requests"] += 1

    try:
        tts = get_model()

        # Resolve voice sample path
        voice_sample_path: Optional[str] = None

        if voice_file:
            # Inline upload: save to temp file
            suffix = Path(voice_file.filename or "voice.wav").suffix or ".wav"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(await voice_file.read())
                voice_sample_path = tmp.name
        elif voice:
            # Named voice from library
            candidate = VOICES_DIR / f"{voice}.wav"
            if candidate.exists():
                voice_sample_path = str(candidate)

        wav = tts.generate(
            input,
            audio_prompt_path=voice_sample_path,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            temperature=temperature,
        )

        audio_bytes = _wav_bytes(wav.squeeze().numpy(), tts.sr)

        duration = time.time() - start
        _stats["completed_requests"] += 1
        _history.insert(0, {
            "request_id": req_id, "status": "completed",
            "duration_seconds": round(duration, 2),
            "text_preview": input[:60], "voice": voice or "default",
        })
        if len(_history) > 50:
            _history.pop()

        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/wav")

    except Exception as exc:
        _stats["error_requests"] += 1
        _history.insert(0, {"request_id": req_id, "status": "error", "error": str(exc)})
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        _status.update({"status": "idle", "is_processing": False})


@app.post("/v1/audio/speech/json")
async def generate_speech_json(body: dict):
    """Legacy JSON endpoint (backward-compat)."""
    return await generate_speech(
        input=body.get("input", ""),
        voice=body.get("voice"),
        exaggeration=body.get("exaggeration", 0.5),
        cfg_weight=body.get("cfg_weight", 0.5),
        temperature=body.get("temperature", 0.8),
        voice_file=None,
    )


@app.post("/v1/audio/speech/stream")
async def generate_speech_stream(
    input: str = Form(...),
    voice: Optional[str] = Form(None),
    exaggeration: float = Form(0.5),
    cfg_weight: float  = Form(0.5),
    temperature: float = Form(0.8),
    voice_file: Optional[UploadFile] = File(None),
    streaming_strategy: Optional[str] = Form(None),
    streaming_chunk_size: Optional[str] = Form(None),
):
    """OpenAI-compatible streaming TTS endpoint with optional voice upload."""
    return await generate_speech(
        input=input,
        voice=voice,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
        temperature=temperature,
        voice_file=voice_file,
    )


# ── Voice Library ─────────────────────────────────────────────────────────────
@app.post("/voices")
async def upload_voice(
    voice_name: str = Form(...),
    language: Optional[str] = Form("en"),
    voice_file: UploadFile = File(...),
):
    """Upload a named voice to the library."""
    suffix = Path(voice_file.filename or "voice.wav").suffix or ".wav"
    dest = VOICES_DIR / f"{voice_name}.wav"
    content = await voice_file.read()

    # Convert to WAV if needed (store as WAV for consistency)
    if suffix.lower() != ".wav":
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        data, sr = sf.read(tmp_path)
        sf.write(str(dest), data, sr, format="WAV")
        Path(tmp_path).unlink(missing_ok=True)
    else:
        dest.write_bytes(content)

    return {"voice_name": voice_name, "language": language, "path": str(dest)}


@app.get("/voices")
async def list_voices():
    voices = []
    for p in VOICES_DIR.glob("*.wav"):
        voices.append({"voice_name": p.stem, "path": str(p)})
    return {"voices": voices}


@app.delete("/voices/{voice_name}")
async def delete_voice(voice_name: str):
    target = VOICES_DIR / f"{voice_name}.wav"
    if not target.exists():
        raise HTTPException(status_code=404, detail="Voice not found")
    target.unlink()
    return {"deleted": voice_name}


# ── Status API ────────────────────────────────────────────────────────────────
@app.get("/status")
@app.get("/v1/status")
async def get_status(include_stats: bool = False, include_history: bool = False):
    payload = dict(_status)
    if include_stats:
        payload["statistics"] = _stats
    if include_history:
        payload["request_history"] = _history[:10]
    return payload


@app.get("/status/progress")
@app.get("/v1/status/progress")
async def get_progress():
    if _status.get("is_processing"):
        return {
            "is_processing": True,
            "status": _status.get("status", "generating_audio"),
            "current_step": _status.get("status", "Generating audio…"),
            "progress_percentage": 50.0,   # Single-chunk: no sub-step granularity
            "text_preview": _status.get("text_preview", ""),
        }
    return {"is_processing": False, "status": "idle", "message": "No active TTS requests"}


@app.get("/status/statistics")
@app.get("/v1/status/statistics")
async def get_statistics():
    total = _stats["total_requests"]
    completed = _stats["completed_requests"]
    return {
        **_stats,
        "success_rate": round(completed / total * 100, 1) if total else 0,
    }


@app.get("/status/history")
@app.get("/v1/status/history")
async def get_history(limit: int = 10):
    limit = min(max(limit, 1), 50)
    return {"request_history": _history[:limit], "total_records": len(_history), "limit": limit}


@app.post("/status/history/clear")
async def clear_history(confirm: bool = False):
    if not confirm:
        raise HTTPException(status_code=400, detail="Pass ?confirm=true to clear history")
    _history.clear()
    return {"cleared": True}


@app.get("/info")
@app.get("/v1/info")
async def get_info():
    return {
        "api_name": "Chatterbox TTS API",
        "version": "1.0.0",
        "status": "operational",
        "device": DEVICE,
        "model_loaded": model is not None,
        "tts_status": _status,
        "statistics": _stats,
        "recent_requests": _history[:3],
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
