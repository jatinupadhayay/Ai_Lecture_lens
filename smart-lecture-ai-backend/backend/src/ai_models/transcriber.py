import os
import sys
import json
import wave
from vosk import Model, KaldiRecognizer
from moviepy.editor import VideoFileClip
from pathlib import Path
from pydub import AudioSegment

# ---------------- CONFIG ----------------
# Get model path from environment variable or fallback
MODEL_PATH = os.getenv(
    "VOSK_MODEL_PATH",
    r"D:\ai pin\smart-lecture-ai\smart-lecture-ai-backend\backend\models\vosk-model-small-en-us-0.15"
)

# Ensure model exists
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"❌ Vosk model not found at {MODEL_PATH}. Download from:\n"
        "https://alphacephei.com/vosk/models"
    )

# ---------------- AUDIO EXTRACTION ----------------
def extract_audio(video_path, output_audio="data/processed/audio.wav"):
    """
    Extracts audio from a video file and saves as 16kHz mono WAV for Vosk.
    """
    Path("data/processed").mkdir(parents=True, exist_ok=True)

    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(output_audio, fps=16000, nbytes=2, codec="pcm_s16le", logger=None)
    clip.close()
    return output_audio

# ---------------- SPEECH TO TEXT ----------------
def transcribe_audio(audio_path, model_path=MODEL_PATH):
    """
    Transcribes audio with timestamps using Vosk (offline).
    Returns a list of dictionaries with start, end, and text.
    """
    wf = wave.open(audio_path, "rb")
    # Convert audio to correct format if needed
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
        sound = AudioSegment.from_file(audio_path)
        sound = sound.set_channels(1).set_frame_rate(16000)
        audio_path = "data/processed/audio_16k.wav"
        sound.export(audio_path, format="wav")
        wf = wave.open(audio_path, "rb")

    model = Model(model_path)
    rec = KaldiRecognizer(model, wf.getframerate())
    rec.SetWords(True)

    results = []

    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break

        if rec.AcceptWaveform(data):
            res = json.loads(rec.Result())
            if "result" in res:
                start = res["result"][0]["start"]
                end = res["result"][-1]["end"]
                text = res["text"].strip()
