import sys
import os
import shutil
from pathlib import Path

# Add ai_models directory to Python path so we can import from it
AI_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "src", "ai_models")
sys.path.insert(0, AI_MODELS_DIR)

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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
    target = UPLOAD_DIR / file.filename
    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        from transcriber import extract_audio, transcribe_audio
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcriber import failed: {e}")

    try:
        ext = os.path.splitext(file.filename)[1].lower()
        video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}

        if ext in video_exts:
            audio_path = extract_audio(str(target), output_audio=str(UPLOAD_DIR / "audio.wav"))
        else:
            audio_path = str(target)

        results = transcribe_audio(audio_path)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        if target.exists():
            target.unlink(missing_ok=True)


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    target = UPLOAD_DIR / file.filename
    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        from extractor import extract_text_from_video
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extractor import failed: {e}")

    try:
        frames = extract_text_from_video(str(target))
        return {"frames": frames}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame extraction failed: {e}")
    finally:
        if target.exists():
            target.unlink(missing_ok=True)


@app.post("/quiz")
async def quiz(payload: dict):
    text = payload.get("text", "")
    num_questions = payload.get("num_questions", 5)
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        from quiz_generator import generate_quiz
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generator import failed: {e}")

    try:
        questions = generate_quiz(text, num_questions=num_questions)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {e}")


@app.post("/summarize")
async def summarize(payload: dict):
    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        from summarize import summarize_text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarizer import failed: {e}")

    try:
        summary = summarize_text(text)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
