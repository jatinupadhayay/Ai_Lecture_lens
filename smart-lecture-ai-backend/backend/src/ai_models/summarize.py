import re
import os
import sys
import json
import nltk
from transformers import pipeline
from nltk.tokenize import sent_tokenize

nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)

# -------------------- Models --------------------
SUMMARIZER_MODEL = "philschmid/bart-large-cnn-samsum"
CLEANER_MODEL = "facebook/bart-large-cnn"

_summarizer = None
_cleaner = None


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        print("[summarize] Loading BART summarizer...", file=sys.stderr)
        _summarizer = pipeline("summarization", model=SUMMARIZER_MODEL, device=-1)
    return _summarizer


def get_cleaner():
    global _cleaner
    if _cleaner is None:
        print("[summarize] Loading BART cleaner...", file=sys.stderr)
        _cleaner = pipeline("summarization", model=CLEANER_MODEL, device=-1)
    return _cleaner


# -------------------- Preprocessing --------------------
def preprocess_transcript(text: str) -> str:
    """Clean messy transcript before summarization."""
    text = re.sub(r"\[?\d+(\.\d+)?[-–]\d+(\.\d+)?s\]?", " ", text)
    text = re.sub(r"\d+(\.\d+)?s", " ", text)
    text = re.sub(r"\b(hello everyone|welcome|thank you|subscribe|like and share)\b.*", " ", text, flags=re.I)

    lines = [l.strip() for l in text.splitlines() if len(l.strip().split()) > 3]
    seen, filtered = set(), []
    for line in lines:
        if line.lower() not in seen:
            filtered.append(line)
            seen.add(line.lower())

    text = " ".join(filtered)
    return re.sub(r"\s+", " ", text).strip()


# -------------------- Chunking --------------------
def chunk_sentences(text: str, max_chars=2000):
    """Split text into chunks for summarization."""
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
def summarize_text(text: str, use_ai_cleaner: bool = False) -> str:
    """Summarize transcript text using BART."""
    text = preprocess_transcript(text)

    if not text or len(text.split()) < 20:
        return text or "Insufficient text to summarize."

    # Optional AI cleaning
    if use_ai_cleaner and len(text.split()) > 80:
        try:
            cleaner = get_cleaner()
            cleaned = cleaner(text[:4096], max_length=1024, min_length=100, do_sample=False, truncation=True)
            text = cleaned[0]["summary_text"].strip()
        except Exception as e:
            print(f"[summarize] AI cleaning failed: {e}", file=sys.stderr)

    # Summarize
    summarizer = get_summarizer()
    chunks = chunk_sentences(text)
    summaries = []

    for chunk in chunks:
        if len(chunk.split()) < 10:
            continue
        try:
            result = summarizer(chunk, max_length=512, min_length=50, truncation=True, do_sample=False)
            summaries.append(result[0]["summary_text"])
        except Exception as e:
            print(f"[summarize] Skipped chunk: {e}", file=sys.stderr)

    if not summaries:
        return text[:500]

    merged = " ".join(summaries)

    # Structure into paragraphs
    sentences = sent_tokenize(merged)
    para_count = max(2, min(4, len(sentences) // 3))
    per_para = max(1, len(sentences) // para_count)
    structured = "\n\n".join(
        [" ".join(sentences[i:i + per_para]) for i in range(0, len(sentences), per_para)]
    )

    return structured.strip()


# -------------------- CLI --------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("")
        sys.exit(0)

    input_text = sys.argv[1]

    # If it looks like a file path, read it
    if os.path.exists(input_text):
        with open(input_text, "r", encoding="utf-8") as f:
            input_text = f.read()

    result = summarize_text(input_text)
    print(result)
