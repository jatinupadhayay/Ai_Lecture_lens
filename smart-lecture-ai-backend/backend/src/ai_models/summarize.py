import re
import os
import cv2
import nltk
import streamlit as st
from transformers import pipeline
from nltk.tokenize import sent_tokenize

# Download sentence tokenizer silently
nltk.download("punkt", quiet=True)

# ✅ Models
SUMMARIZER_MODEL = "philschmid/bart-large-cnn-samsum"
CLEANER_MODEL = "facebook/bart-large-cnn"  # public and reliable

# -------------------- Cached Model Loaders --------------------
@st.cache_resource(show_spinner=False)
def load_summarizer_model():
    """Load summarization model once and cache it."""
    return pipeline("summarization", model=SUMMARIZER_MODEL, device=-1)

@st.cache_resource(show_spinner=False)
def load_cleaner_model():
    """Load general-purpose cleaner model once and cache it."""
    return pipeline("summarization", model=CLEANER_MODEL, device=-1)

# -------------------- Text Preprocessing --------------------
def preprocess_transcript(text: str) -> str:
    """Clean messy transcript text before summarization."""
    # Remove timestamps like [00:12–00:34s] or 0.00–10.23s
    text = re.sub(r"\[?\d+(\.\d+)?[-–]\d+(\.\d+)?s\]?", " ", text)
    text = re.sub(r"\d+(\.\d+)?s", " ", text)

    # Remove intros, outros, and irrelevant instructions
    text = re.sub(r"\b(hello everyone|welcome|thank you|subscribe|like and share)\b.*", " ", text, flags=re.I)
    text = re.sub(r"\b(activity\s*time|choose an option|comment below|watch the video|follow us|quiz)\b", " ", text, flags=re.I)

    # Deduplicate short/redundant lines
    lines = [l.strip() for l in text.splitlines() if len(l.strip().split()) > 3]
    seen, filtered = set(), []
    for line in lines:
        if line.lower() not in seen:
            filtered.append(line)
            seen.add(line.lower())

    text = " ".join(filtered)
    return re.sub(r"\s+", " ", text).strip()

# -------------------- Video Duration Helper --------------------
def get_duration_minutes(video_path: str) -> float:
    """Estimate duration in minutes for summary proportion."""
    if not video_path or not os.path.exists(video_path):
        return 10
    cap = cv2.VideoCapture(video_path)
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    return frames / fps / 60 if fps > 0 else 10

# -------------------- Chunking Helper --------------------
def chunk_sentences(text: str, max_chars=2000):
    """Split transcript into coherent chunks for summarization."""
    sentences = sent_tokenize(text)
    chunks, current = [], ""
    for sent in sentences:
        if len(current) + len(sent) < max_chars:
            current += " " + sent
        else:
            chunks.append(current.strip())
            current = sent
    if current:
        chunks.append(current.strip())
    return chunks

# -------------------- Main Summarization --------------------
def summarize_text(text: str, video_path: str = None, use_ai_cleaner: bool = True) -> str:
    """
    1️⃣ Clean transcript
    2️⃣ Optionally refine text using AI cleaner
    3️⃣ Summarize proportionally to video length
    """
    text = preprocess_transcript(text)
    duration = get_duration_minutes(video_path)

    # Adjust paragraph count
    if duration < 8:
        para_count = 2
    elif duration < 15:
        para_count = 3
    else:
        para_count = 4

    # Step 1: AI Cleaning (Optional)
    if use_ai_cleaner:
        st.info("🧹 Cleaning transcript with AI...")
        cleaner = load_cleaner_model()
        try:
            cleaned = cleaner(text, max_length=1024, min_length=100, do_sample=False, truncation=True)
            text = cleaned[0]["summary_text"].strip()
        except Exception as e:
            st.warning(f"⚠️ AI cleaning failed: {e}")

    # Step 2: Summarization
    st.info("🧠 Generating structured summary...")
    summarizer = load_summarizer_model()
    chunks = chunk_sentences(text)
    summaries = []

    for chunk in chunks:
        try:
            result = summarizer(chunk, max_length=512, min_length=150, truncation=True, do_sample=False)
            summaries.append(result[0]["summary_text"])
        except Exception as e:
            st.warning(f"⚠️ Skipped one chunk due to: {e}")

    merged_summary = " ".join(summaries)

    # Step 3: Paragraph Structuring
    sentences = sent_tokenize(merged_summary)
    per_para = max(1, len(sentences) // para_count)
    structured = "\n\n".join(
        [" ".join(sentences[i:i + per_para]) for i in range(0, len(sentences), per_para)]
    )

    return structured.strip()
