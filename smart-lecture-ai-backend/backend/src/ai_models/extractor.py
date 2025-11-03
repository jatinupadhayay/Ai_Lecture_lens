import cv2
from PIL import Image
import imagehash
import pytesseract
from pathlib import Path

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def extract_text_from_video(video_path, frame_interval=30, hash_diff=5):
    """Extracts slide text + timestamps (approx) every few seconds."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    prev_hash = None
    results = []
    frame_id = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_id % frame_interval == 0:
            current_time = frame_id / fps  # seconds
            pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            frame_hash = imagehash.phash(pil_image)

            if prev_hash is None or abs(frame_hash - prev_hash) > hash_diff:
                prev_hash = frame_hash
                text = pytesseract.image_to_string(pil_image).strip()
                if text:
                    results.append({"time": current_time, "text": text})

        frame_id += 1

    cap.release()
    return results
