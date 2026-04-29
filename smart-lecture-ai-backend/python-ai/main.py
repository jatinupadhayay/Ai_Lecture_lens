import sys
import os
import shutil
import asyncio
import uuid
import subprocess
from pathlib import Path

# Add ai_models directory to Python path — local copy (Docker) or dev sibling path
_here = os.path.dirname(os.path.abspath(__file__))
_local_models = os.path.join(_here, "ai_models")
_dev_models = os.path.join(_here, "..", "backend", "src", "ai_models")
AI_MODELS_DIR = _local_models if os.path.isdir(_local_models) else _dev_models
sys.path.insert(0, AI_MODELS_DIR)

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Lazy-load heavy modules — only import at startup if lightweight.
# faster-whisper / torch are NOT imported here to avoid OOM on startup.
# They load on first /transcribe request instead.

extract_audio = transcribe_audio = None  # loaded lazily in /transcribe

try:
    from extractor import extract_text_from_video
except Exception as _e:
    extract_text_from_video = None
    print(f"[main] WARNING: extractor import failed: {_e}", file=sys.stderr)

try:
    from quiz_generator import generate_quiz
except Exception as _e:
    generate_quiz = None
    print(f"[main] WARNING: quiz_generator import failed: {_e}", file=sys.stderr)

try:
    from cleaner import clean_text
except Exception as _e:
    clean_text = None
    print(f"[main] WARNING: cleaner import failed: {_e}", file=sys.stderr)

try:
    from summarize import summarize_text
except Exception as _e:
    summarize_text = None
    print(f"[main] WARNING: summarize import failed: {_e}", file=sys.stderr)

try:
    from vector_store import ingest, query as vs_query, collection_exists
    from document_processor import chunk_text as _chunk_text  # no DocumentProcessor class exists
    VECTOR_STORE_AVAILABLE = True
except Exception as _e:
    ingest = vs_query = collection_exists = _chunk_text = None
    VECTOR_STORE_AVAILABLE = False
    print(f"[main] WARNING: vector_store import failed: {_e}", file=sys.stderr)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _get_ffmpeg():
    """Return path to ffmpeg binary (bundled imageio_ffmpeg or system)."""
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _extract_audio_ffmpeg(input_path: str, output_wav: str):
    """Convert any audio/video file to 16kHz mono WAV using ffmpeg."""
    ffmpeg = _get_ffmpeg()
    result = subprocess.run(
        [ffmpeg, "-y", "-i", input_path, "-vn",
         "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", output_wav],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:500]}")


app = FastAPI(title="Lecture Lens - Python AI Services")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "python-ai"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    global transcribe_audio, extract_audio
    if transcribe_audio is None:
        try:
            from transcriber import extract_audio as _ea, transcribe_audio as _ta
            extract_audio = _ea
            transcribe_audio = _ta
        except Exception as _e:
            raise HTTPException(status_code=500, detail=f"Transcriber unavailable: {_e}")

    req_id = uuid.uuid4().hex
    suffix = os.path.splitext(file.filename)[1] or ".bin"
    target = UPLOAD_DIR / f"{req_id}{suffix}"
    wav_out = UPLOAD_DIR / f"{req_id}.wav"

    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        ext = suffix.lower()
        audio_exts = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}
        video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}

        def _run():
            if ext in video_exts or ext in audio_exts:
                _extract_audio_ffmpeg(str(target), str(wav_out))
                audio_path = str(wav_out)
            else:
                audio_path = str(target)
            return transcribe_audio(audio_path)

        results = await asyncio.to_thread(_run)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        for p in (target, wav_out):
            if p.exists():
                p.unlink(missing_ok=True)


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if extract_text_from_video is None:
        raise HTTPException(status_code=500, detail="Extractor module unavailable")

    req_id = uuid.uuid4().hex
    suffix = os.path.splitext(file.filename)[1] or ".bin"
    target = UPLOAD_DIR / f"{req_id}{suffix}"

    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        frames = await asyncio.to_thread(extract_text_from_video, str(target))
        return {"frames": frames}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame extraction failed: {e}")
    finally:
        target.unlink(missing_ok=True)


@app.post("/quiz")
async def quiz(payload: dict):
    if generate_quiz is None:
        raise HTTPException(status_code=500, detail="Quiz generator module unavailable")

    text = payload.get("text", "")
    num_questions = payload.get("num_questions", 5)
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        questions = await asyncio.to_thread(generate_quiz, text, num_questions)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {e}")


@app.post("/clean")
async def clean(payload: dict):
    if clean_text is None:
        raise HTTPException(status_code=500, detail="Cleaner module unavailable")

    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        result = await asyncio.to_thread(clean_text, text)
        return {"text": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {e}")


@app.post("/summarize")
async def summarize(payload: dict):
    if summarize_text is None:
        raise HTTPException(status_code=500, detail="Summarizer module unavailable")

    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        summary = await asyncio.to_thread(summarize_text, text)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {e}")


@app.post("/ingest-text")
async def ingest_text(payload: dict):
    if not VECTOR_STORE_AVAILABLE:
        raise HTTPException(status_code=500, detail="Vector store unavailable")

    document_id = payload.get("document_id", "")
    text = payload.get("text", "")
    title = payload.get("title", document_id)

    if not document_id or not text:
        raise HTTPException(status_code=400, detail="`document_id` and `text` are required")

    def _run():
        chunks = _chunk_text(text, chunk_size=400, overlap=50)
        return ingest(document_id, chunks, {"title": title})

    try:
        count = await asyncio.to_thread(_run)
        return {"ok": True, "chunks_stored": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {e}")


@app.post("/query-document")
async def query_document(payload: dict):
    if not VECTOR_STORE_AVAILABLE:
        raise HTTPException(status_code=500, detail="Vector store unavailable")

    document_id = payload.get("document_id", "")
    query_text = payload.get("query", "")
    top_k = int(payload.get("top_k", 5))

    if not document_id or not query_text:
        raise HTTPException(status_code=400, detail="`document_id` and `query` are required")

    try:
        chunks = await asyncio.to_thread(vs_query, document_id, query_text, top_k)
        return {"chunks": chunks}
    except ValueError as e:
        # Document not yet ingested — return empty rather than 500
        return {"chunks": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=2)
