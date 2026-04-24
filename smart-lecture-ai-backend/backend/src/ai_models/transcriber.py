import os
import sys
import json
from pathlib import Path

# ---------------- CONFIG ----------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")  # tiny/base/small/medium/large

_whisper_model = None


def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        print(f"[transcriber] Loading faster-whisper model '{WHISPER_MODEL_SIZE}'...", file=sys.stderr)
        _whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        print("[transcriber] Model loaded.", file=sys.stderr)
    return _whisper_model


# ---------------- AUDIO EXTRACTION ----------------
def extract_audio(video_path, output_audio=None):
    """Extract audio from video as 16kHz mono WAV."""
    if output_audio is None:
        tmp_dir = os.path.join(BASE_DIR, "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        output_audio = os.path.join(tmp_dir, "audio.wav")

    try:
        from moviepy.editor import VideoFileClip
    except ImportError:
        from moviepy import VideoFileClip
    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(output_audio, fps=16000, nbytes=2, codec="pcm_s16le", logger=None)
    clip.close()
    return output_audio


# ---------------- SPEECH TO TEXT ----------------
def transcribe_audio(audio_path, model_path=None):
    """Transcribe audio with timestamps using faster-whisper (free, local)."""
    model = get_whisper_model()

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,           # skip silence automatically
        vad_parameters={"min_silence_duration_ms": 500},
    )

    print(f"[transcriber] Detected language: {info.language} ({info.language_probability:.0%})", file=sys.stderr)

    results = []
    for seg in segments:
        text = seg.text.strip()
        if text:
            results.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": text,
            })

    print(f"[transcriber] {len(results)} segments transcribed.", file=sys.stderr)
    return results


# ---------------- CLI ENTRY POINT ----------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)

    input_path = sys.argv[1]

    ext = os.path.splitext(input_path)[1].lower()
    video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"}

    if ext in video_exts:
        audio_path = extract_audio(input_path)
    else:
        audio_path = input_path

    transcript = transcribe_audio(audio_path)
    print(json.dumps(transcript))
