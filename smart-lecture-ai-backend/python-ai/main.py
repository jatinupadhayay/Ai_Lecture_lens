from fastapi import FastAPI, UploadFile, File
import uvicorn
import shutil
import os
from pathlib import Path
import json
# import your scripts here (adapt to functions)

app = FastAPI()
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Call your transcriber logic (adapted to function)
    # For example, if transcriber.py exposes transcribe_audio(audio_path) -> results:
    from transcriber import extract_audio, transcribe_audio
    audio_path = extract_audio(str(file_path), output_audio=str(UPLOAD_DIR/"audio.wav"))
    results = transcribe_audio(audio_path)
    return results

@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Call extractor.extract_text_from_video
    from extractor import extract_text_from_video
    res = extract_text_from_video(str(file_path))
    # optionally store frames as images and return image URLs (we'll just return text + time)
    return {"frames": res}

@app.post("/quiz")
async def quiz(payload: dict):
    # payload: {"text": "...", "num_questions": 5}
    text = payload.get("text", "")
    num = payload.get("num_questions", 5)
    # import T5 wrapper code - assume generate_quiz(context, num_questions)
    from true_quiz_generator import generate_quiz, create_smart_fallback_questions
    quiz = generate_quiz(text, num_questions=num)
    # Optionally: include summary if your generator also produces it
    return quiz

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
