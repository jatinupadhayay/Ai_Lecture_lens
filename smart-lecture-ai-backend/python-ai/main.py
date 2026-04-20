import sys
import os
import shutil
import asyncio
from pathlib import Path

# Add ai_models directory to Python path so we can import from it
AI_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "src", "ai_models")
sys.path.insert(0, AI_MODELS_DIR)

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import AI modules at startup so models load once and stay warm
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
    return {"ok": True, "service": "python-ai"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if transcribe_audio is None:
        raise HTTPException(status_code=500, detail="Transcriber module unavailable")

    target = UPLOAD_DIR / file.filename
    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        ext = os.path.splitext(file.filename)[1].lower()
        video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}

        def _run():
            audio_path = str(target)
            if ext in video_exts:
                audio_path = extract_audio(str(target), output_audio=str(UPLOAD_DIR / "audio.wav"))
            return transcribe_audio(audio_path)

        # Run CPU-bound transcription in thread pool so event loop stays free
        results = await asyncio.to_thread(_run)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        if target.exists():
            target.unlink(missing_ok=True)


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if extract_text_from_video is None:
        raise HTTPException(status_code=500, detail="Extractor module unavailable")

    target = UPLOAD_DIR / file.filename
    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        frames = await asyncio.to_thread(extract_text_from_video, str(target))
        return {"frames": frames}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame extraction failed: {e}")
    finally:
        if target.exists():
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
        results = await asyncio.to_thread(generate_quiz, text, num_questions)

        # results is now a list of structured MCQ dicts:
        # [{"question": "...", "options": [...], "correctAnswer": 0}, ...]
        # For backward compat, also return flat text lines
        from quiz_generator import format_mcq_lines
        text_lines = format_mcq_lines(results)

        return {
            "questions": text_lines,          # backward compat (list of strings)
            "structured": results,             # new structured MCQ format
        }
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
    """
    Ingest raw text (e.g. lecture transcript) directly into ChromaDB — no file upload needed.
    Used to index lecture transcripts and slide text for semantic retrieval.
    """
    if _chunk_text is None or ingest is None:
        raise HTTPException(status_code=500, detail="Document processing modules unavailable")

    document_id = payload.get("document_id", "")
    text = payload.get("text", "")
    title = payload.get("title", "")

    if not document_id:
        raise HTTPException(status_code=400, detail="`document_id` is required")
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        def _run():
            chunks = _chunk_text(text, chunk_size=400, overlap=50)
            chunk_count = ingest(
                document_id=document_id,
                chunks=chunks,
                doc_metadata={"title": title, "source": "lecture_transcript"},
            )
            return {"chunk_count": chunk_count, "total_words": len(text.split())}

        data = await asyncio.to_thread(_run)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text ingestion failed: {e}")


@app.post("/ingest-document")
async def ingest_document(
    file: UploadFile = File(...),
    document_id: str = Form(""),
    title: str = Form(""),
):
    """
    Upload a PDF/DOCX/TXT, extract text, chunk it, embed and store in ChromaDB.
    Returns chunk count so the caller can track indexing progress.
    """
    if process_document is None or ingest is None:
        raise HTTPException(status_code=500, detail="Document processing modules unavailable")
    if not document_id:
        raise HTTPException(status_code=400, detail="`document_id` is required")

    target = UPLOAD_DIR / file.filename
    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        def _run():
            result = process_document(str(target))
            chunk_count = ingest(
                document_id=document_id,
                chunks=result["chunks"],
                doc_metadata={"title": title, "file_name": file.filename},
            )
            return {"chunk_count": chunk_count, "total_words": result["total_words"]}

        data = await asyncio.to_thread(_run)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")
    finally:
        if target.exists():
            target.unlink(missing_ok=True)


@app.post("/query-document")
async def query_document(payload: dict):
    """
    Semantic search over a document's vector store.
    Returns top-k relevant chunks for use as RAG context.
    """
    if vs_query is None:
        raise HTTPException(status_code=500, detail="Vector store module unavailable")

    document_id = payload.get("document_id", "")
    query_text = payload.get("query", "")
    top_k = int(payload.get("top_k", 5))

    if not document_id:
        raise HTTPException(status_code=400, detail="`document_id` is required")
    if not query_text:
        raise HTTPException(status_code=400, detail="`query` is required")

    try:
        chunks = await asyncio.to_thread(vs_query, document_id, query_text, top_k)
        return {"chunks": chunks}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")


@app.delete("/delete-document/{document_id}")
async def delete_document(document_id: str):
    """Remove all vectors for a document from ChromaDB."""
    if vs_delete is None:
        raise HTTPException(status_code=500, detail="Vector store module unavailable")
    ok = await asyncio.to_thread(vs_delete, document_id)
    return {"deleted": ok}


@app.get("/document-status/{document_id}")
async def document_status(document_id: str):
    """Check whether a document has been indexed in ChromaDB."""
    if collection_exists is None:
        raise HTTPException(status_code=500, detail="Vector store module unavailable")
    exists = await asyncio.to_thread(collection_exists, document_id)
    return {"indexed": exists}


if __name__ == "__main__":
    import sys
    # Windows doesn't support forked multiprocessing workers reliably.
    # Use single worker with async concurrency (asyncio.to_thread handles CPU-bound tasks).
    is_windows = sys.platform == "win32"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, workers=1 if is_windows else 2)
