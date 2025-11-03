import re
import spacy
from pathlib import Path

# -------------------- LOAD SPACY MODEL --------------------
try:
    nlp = spacy.load("en_core_web_sm", disable=["ner", "parser", "tagger"])
except OSError:
    import os
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm", disable=["ner", "parser", "tagger"])

if "sentencizer" not in nlp.pipe_names:
    nlp.add_pipe("sentencizer")


# -------------------- BASE TEXT CLEANER --------------------
def clean_text(text: str) -> str:
    """
    Cleans transcript text for better summarization.
    Removes timestamps, filler words, duplicates, and ASR noise.
    Works across any lecture domain (networking, AI, DBMS, etc.).
    """

    # Remove timestamps like [00:12:34] or (00:12)
    text = re.sub(r"\[\d{1,2}:\d{2}(:\d{2})?\]", " ", text)
    text = re.sub(r"\(\d{1,2}:\d{2}(:\d{2})?\)", " ", text)
    text = re.sub(r"\d+(\.\d+)?s", " ", text)

    # Remove repeated dashes, equals, etc.
    text = re.sub(r"[=~]{2,}", " ", text)

    # Normalize newlines
    text = text.replace("\r\n", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    text = re.sub(r"\n+", "\n", text)

    # Remove filler words (generic)
    fillers = r"\b(um+|uh+|you know|i mean|like|so yeah|basically|actually|okay|right|well)\b"
    text = re.sub(fillers, "", text, flags=re.I)

    # Remove weird symbols and excess whitespace
    text = re.sub(r"[^a-zA-Z0-9.,!? \n]", " ", text)
    text = re.sub(r"\s{2,}", " ", text)

    # Fix repeated characters
    text = re.sub(r"(.)\1{2,}", r"\1", text)

    # Fix ASR breaks like "lay ing"
    text = re.sub(r"\b([a-z])\s+([a-z])\b", r"\1\2", text)

    # Sentence segmentation and capitalization
    doc = nlp(text)
    sentences = [s.text.strip().capitalize() for s in doc.sents if s.text.strip()]
    cleaned_text = " ".join(sentences)

    return cleaned_text.strip()


# -------------------- OPTIONAL AI CLEANER --------------------
def clean_text_with_optional_ai(text: str, use_ai: bool = False) -> str:
    """
    Optionally refines transcript text with a Hugging Face summarization model.
    Falls back silently to spaCy cleaner if AI cleaning fails.
    """
    text = clean_text(text)

    if not use_ai or len(text.split()) < 80:
        return text

    try:
        from transformers import pipeline
        summarizer = pipeline("summarization", model="philschmid/bart-large-cnn-samsum", device=-1)
        result = summarizer(text, max_length=500, min_length=150, truncation=True)
        return result[0]["summary_text"].strip()
    except Exception:
        # Silent fallback (no error to Streamlit)
        return text


# -------------------- MERGE TEXT SOURCES --------------------
def merge_texts(slides_text: str, voice_text: str) -> str:
    """Merge slide OCR text and voice transcription into one transcript."""
    merged = (slides_text.strip() + "\n\n" + voice_text.strip()).strip()
    seen = set()
    unique_lines = []
    for line in merged.splitlines():
        line = line.strip()
        if line and line not in seen:
            seen.add(line)
            unique_lines.append(line)
    return "\n".join(unique_lines)


def merge_by_timestamps(slide_segments, voice_segments, max_gap=10):
    """
    Merge OCR (slide) text and voice text based on timestamps.
    slide_segments: list of {time, text}
    voice_segments: list of {start, end, text}
    """
    merged_output = []
    for vseg in voice_segments:
        vstart, vend = vseg["start"], vseg.get("end", vseg["start"] + 5)
        vtext = vseg["text"]
        relevant_slides = [s["text"] for s in slide_segments if abs(s["time"] - vstart) <= max_gap]
        slide_text = " ".join(relevant_slides)
        section = f"[{vstart:.2f}-{vend:.2f}s] {slide_text} {vtext}".strip()
        merged_output.append(section)

    return "\n\n".join(merged_output)


# -------------------- FILE CLEANER --------------------
def clean_transcript_file(input_path: str, output_path: str):
    """Read, clean, and save transcript text."""
    text = Path(input_path).read_text(encoding="utf-8")
    cleaned = clean_text(text)
    Path(output_path).write_text(cleaned, encoding="utf-8")
    print(f"✅ Cleaned transcript saved → {output_path}")
    return cleaned
