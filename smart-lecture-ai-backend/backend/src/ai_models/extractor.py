import os
import sys
import json
import shutil
import cv2
from PIL import Image
import imagehash
import pytesseract

# Auto-detect Tesseract path
_tesseract_paths = [
    os.getenv("TESSERACT_PATH", ""),
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]

tesseract_cmd = shutil.which("tesseract")  # check PATH first
if not tesseract_cmd:
    for p in _tesseract_paths:
        if p and os.path.exists(p):
            tesseract_cmd = p
            break

if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
else:
    print("[extractor] Warning: Tesseract not found. OCR will fail.", file=sys.stderr)


def extract_text_from_video(video_path, frame_interval=30, hash_diff=5):
    """Extract slide text + timestamps from video frames using OCR."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[extractor] Cannot open video: {video_path}", file=sys.stderr)
        return []

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30  # fallback

    prev_hash = None
    results = []
    frame_id = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_id % frame_interval == 0:
            current_time = frame_id / fps
            pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            frame_hash = imagehash.phash(pil_image)

            if prev_hash is None or abs(frame_hash - prev_hash) > hash_diff:
                prev_hash = frame_hash
                try:
                    text = pytesseract.image_to_string(pil_image).strip()
                    if text and len(text) > 10:  # skip noise
                        results.append({"time": round(current_time, 2), "text": text})
                except Exception as e:
                    print(f"[extractor] OCR failed at {current_time:.1f}s: {e}", file=sys.stderr)

        frame_id += 1

    cap.release()
    return results


# -------------------- CLI --------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)

    video_path = sys.argv[1]
    frames = extract_text_from_video(video_path)
    print(json.dumps(frames))
