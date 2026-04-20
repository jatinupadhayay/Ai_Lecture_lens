import os
import sys
import json
import cv2
from PIL import Image
import imagehash
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed

# ---------------------------------------------------------------------------
# OCR backend selection
# Priority: PaddleOCR → Tesseract → disabled
# ---------------------------------------------------------------------------

PADDLE_AVAILABLE = False
TESSERACT_AVAILABLE = False
_paddle_ocr = None


def _init_paddle():
    global _paddle_ocr, PADDLE_AVAILABLE
    if _paddle_ocr is not None:
        return
    try:
        from paddleocr import PaddleOCR  # noqa: PLC0415
        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        PADDLE_AVAILABLE = True
    except Exception as e:
        print(f"[extractor] PaddleOCR unavailable: {e}", file=sys.stderr)


def _init_tesseract():
    global TESSERACT_AVAILABLE
    import shutil
    _tesseract_paths = [
        os.getenv("TESSERACT_PATH", ""),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    cmd = shutil.which("tesseract")
    if not cmd:
        for p in _tesseract_paths:
            if p and os.path.exists(p):
                cmd = p
                break
    if cmd:
        import pytesseract  # noqa: PLC0415
        pytesseract.pytesseract.tesseract_cmd = cmd
        TESSERACT_AVAILABLE = True
    else:
        print("[extractor] Warning: Tesseract not found. OCR disabled.", file=sys.stderr)


_init_paddle()
if not PADDLE_AVAILABLE:
    _init_tesseract()


# ---------------------------------------------------------------------------
# Frame preprocessing
# ---------------------------------------------------------------------------

def _preprocess(frame_bgr: np.ndarray) -> np.ndarray:
    """Crop borders + resize — runs before every OCR call."""
    h, w = frame_bgr.shape[:2]
    # Crop 10% from each edge to remove borders, speaker cam, black bars
    cropped = frame_bgr[int(h * 0.1):int(h * 0.9), int(w * 0.1):int(w * 0.9)]
    # Scale down 60% — 2–3x faster OCR with minimal accuracy loss
    resized = cv2.resize(cropped, None, fx=0.6, fy=0.6, interpolation=cv2.INTER_AREA)
    return resized


# ---------------------------------------------------------------------------
# OCR helpers
# ---------------------------------------------------------------------------

def _ocr_with_paddle(frame_bgr: np.ndarray) -> str:
    result = _paddle_ocr.ocr(frame_bgr, cls=True)
    lines = []
    if result and result[0]:
        for line in result[0]:
            if line and len(line) >= 2:
                text_conf = line[1]
                if text_conf and text_conf[1] > 0.5:
                    lines.append(text_conf[0].strip())
    return " ".join(lines)


def _ocr_with_tesseract(frame_bgr: np.ndarray) -> str:
    import pytesseract  # noqa: PLC0415
    pil_image = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
    return pytesseract.image_to_string(pil_image).strip()


def _ocr_frame(frame_bgr: np.ndarray) -> str:
    frame = _preprocess(frame_bgr)
    if PADDLE_AVAILABLE:
        return _ocr_with_paddle(frame)
    if TESSERACT_AVAILABLE:
        return _ocr_with_tesseract(frame)
    return ""


# ---------------------------------------------------------------------------
# Worker — used by thread pool
# ---------------------------------------------------------------------------

def _process_candidate(args):
    """OCR a single candidate frame. Returns (time, text) or None."""
    frame_bgr, current_time = args
    try:
        text = _ocr_frame(frame_bgr)
        # Skip frames with fewer than 5 meaningful words (logos, titles, noise)
        if text and len(text.split()) >= 5:
            return {"time": round(current_time, 2), "text": text}
    except Exception as e:
        print(f"[extractor] OCR failed at {current_time:.1f}s: {e}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# Main extraction function
# ---------------------------------------------------------------------------

def extract_text_from_video(video_path, hash_diff=5):
    """
    Extract slide text + timestamps from video frames using OCR.

    Pipeline:
    1. Sample one frame every 2 seconds (FPS-aware, works across any video).
    2. Skip visually identical frames with perceptual hashing.
    3. Preprocess unique frames: crop borders + resize 60%.
    4. OCR in parallel with ThreadPoolExecutor.
    5. Drop frames with fewer than 5 words (noise/logos).
    """
    if not PADDLE_AVAILABLE and not TESSERACT_AVAILABLE:
        print("[extractor] No OCR backend available.", file=sys.stderr)
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[extractor] Cannot open video: {video_path}", file=sys.stderr)
        return []

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30

    # Sample every 2 seconds — adapts to any FPS automatically
    frame_interval = max(1, int(fps * 2))

    prev_hash = None
    candidates = []   # (frame_bgr, time) — unique frames to OCR
    frame_id = 0

    # Phase 1: collect unique frames (fast — no OCR yet)
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
                candidates.append((frame.copy(), current_time))

        frame_id += 1

    cap.release()

    if not candidates:
        return []

    # Phase 2: OCR candidates in parallel
    results = []
    max_workers = min(4, len(candidates))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_process_candidate, c): c[1] for c in candidates}
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)

    # Re-sort by timestamp (parallel completion is unordered)
    results.sort(key=lambda r: r["time"])
    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)

    frames = extract_text_from_video(sys.argv[1])
    print(json.dumps(frames))
