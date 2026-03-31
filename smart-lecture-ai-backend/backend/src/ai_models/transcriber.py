import os
import sys
import json
import wave
from pathlib import Path

# ---------------- CONFIG ----------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_PATH = os.getenv(
    "VOSK_MODEL_PATH",
    os.path.join(BASE_DIR, "models", "vosk-model-small-en-us-0.15")
)


# ---------------- AUDIO EXTRACTION ----------------
def extract_audio(video_path, output_audio=None):
    """Extract audio from video as 16kHz mono WAV for Vosk."""
    if output_audio is None:
        tmp_dir = os.path.join(BASE_DIR, "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        output_audio = os.path.join(tmp_dir, "audio.wav")

    from moviepy.editor import VideoFileClip
    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(output_audio, fps=16000, nbytes=2, codec="pcm_s16le", logger=None)
    clip.close()
    return output_audio


# ---------------- SPEECH TO TEXT ----------------
def transcribe_audio(audio_path, model_path=None):
    """Transcribe audio with timestamps using Vosk (offline)."""
    from vosk import Model, KaldiRecognizer

    if model_path is None:
        model_path = MODEL_PATH

    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Vosk model not found at {model_path}"}), file=sys.stderr)
        return []

    # Ensure correct audio format
    wf = wave.open(audio_path, "rb")
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
        wf.close()
        from pydub import AudioSegment
        sound = AudioSegment.from_file(audio_path)
        sound = sound.set_channels(1).set_frame_rate(16000).set_sample_width(2)
        converted_path = audio_path.replace(".wav", "_16k.wav")
        sound.export(converted_path, format="wav")
        wf = wave.open(converted_path, "rb")

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
                if text:
                    results.append({"start": round(start, 2), "end": round(end, 2), "text": text})

    # Get final partial result
    final = json.loads(rec.FinalResult())
    if "result" in final and final.get("text", "").strip():
        start = final["result"][0]["start"]
        end = final["result"][-1]["end"]
        results.append({"start": round(start, 2), "end": round(end, 2), "text": final["text"].strip()})

    wf.close()
    return results


# ---------------- CLI ENTRY POINT ----------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)

    input_path = sys.argv[1]

    # Determine if input is video or audio
    ext = os.path.splitext(input_path)[1].lower()
    video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}

    if ext in video_exts:
        audio_path = extract_audio(input_path)
    else:
        audio_path = input_path

    transcript = transcribe_audio(audio_path)
    print(json.dumps(transcript))
