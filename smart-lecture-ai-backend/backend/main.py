# python-ai/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
from pathlib import Path
import uvicorn
import json
import os

# import functions from your local scripts (ensure these scripts are in python-ai/)
# transcriber.py: extract_audio(video_path, output_audio=...)
#                 transcribe_audio(audio_path, model_path=...)
# extractor.py: extract_text_from_video(video_path, frame_interval=30, hash_diff=5)
# true_quiz_generator.py: generate_quiz(context, num_questions)
# Adjust the module names/paths if necessary.

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Smart Lecture AI - Python Services")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # save uploaded file
    target = UPLOAD_DIR / file.filename
    with open(target, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Use transcriber.py functions
    try:
        from transcriber import extract_audio, transcribe_audio
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcriber import failed: {e}")

    try:
        audio_path = extract_audio(str(target), output_audio=str(UPLOAD_DIR / "audio.wav"))
        results = transcribe_audio(audio_path)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

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
        # Optionally: return frames and not images. If you want image files, modify extractor to save images and return paths.
        return {"frames": frames}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame extraction failed: {e}")

@app.post("/quiz")
async def quiz(payload: dict):
    text = payload.get("text", "")
    num_questions = payload.get("num_questions", 5)
    if not text:
        raise HTTPException(status_code=400, detail="`text` is required")

    try:
        # Your T5 generator file should expose generate_quiz
        # If file name is true_quiz_generator.py, import accordingly:
        from true_quiz_generator import generate_quiz, create_smart_fallback_questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generator import failed: {e}")

    try:
        quiz = generate_quiz(text, num_questions=num_questions)
        # If generator returns fewer questions, optionally call fallback
        if len(quiz.get("questions", [])) < num_questions:
            needed = num_questions - len(quiz.get("questions", []))
            fallback = create_smart_fallback_questions(text, needed)
            quiz["questions"].extend(fallback["questions"])
            quiz["answers"].extend(fallback["answers"])
        return quiz
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
