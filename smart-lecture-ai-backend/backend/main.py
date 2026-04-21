import sys
import os
import shutil
import asyncio
import uuid
import traceback
from pathlib import Path

AI_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "src", "ai_models")
sys.path.insert(0, AI_MODELS_DIR)

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from transcriber import extract_audio, transcribe_audio
except Exception as _e:
    extract_audio = transcribe_audio = None
    print(f"[main] WARNING: transcriber import failed: {_e}", file=sys.stderr)

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
    from document_processor import process_document, chunk_text as _chunk_text
except Exception as _e:
    process_document = None
    _chunk_text = None
    print(f"[main] WARNING: document_processor import failed: {_e}", file=sys.stderr)

try:
    from vector_store import ingest, query as vs_query, delete as vs_delete, collection_exists
except Exception as _e:
    ingest = vs_query = vs_delete = collection_exists = None
    print(f"[main] WARNING: vector_store import failed: {_e}", file=sys.stderr)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Lecture Lens - Python AI Services")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "python-ai",
        "python": sys.executable,
        "vector_store": "available" if ingest is not None and vs_query is not None else "unavailable",
    }